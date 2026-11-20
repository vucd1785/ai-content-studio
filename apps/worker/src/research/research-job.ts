import { randomUUID } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  type FactRejectionReason,
  type FetchLog,
  filterResearchFacts,
  type Research,
  type ResearchSource,
  researchSchema,
} from "@studio/contracts";
import {
  claimJob,
  completeJob,
  countChangesRequested,
  failJob,
  findResearchArtifactByInputHash,
  type JobContext,
  JobStateError,
  loadJobContext,
  type StudioDb,
  scriptJobKeyAfterResearch,
} from "@studio/db";
import {
  isInside,
  advanceTransition as nextStatus,
  readJsonArtifact,
  writeJsonArtifact,
} from "../jobs/job-support.js";
import { LlmError } from "../llm/errors.js";
import { createGeminiResearchAdapter, type ResearchLlm } from "../llm/gemini-research-adapter.js";
import {
  CostCeilingError,
  createMeteredClient,
  dbUsageStore,
  llmCallCeiling,
} from "../llm/metered-client.js";
import type { ResearchDocument } from "../llm/research-prompt.js";
import type { StructuredGenerateClient } from "../llm/structured-output.js";
import type { LlmUsage } from "../llm/types.js";
import { researchInputHash } from "./input-hash.js";
import { hostAllowlistFor, type SafeFetchResult, safeFetch } from "./safe-fetch.js";

/**
 * Job research (P3-03, docs/04-AGENT-ORCHESTRATION.md). Chỉ nhận `jobId`, đọc PostgreSQL,
 * ghi artifact `fetch_log` + `research` vào `DATA_DIR`, đổi `researching` → `research_ready`.
 *
 * Nguồn: file Director upload (md/txt) và URL Director đưa (fetch qua `safeFetch`, allowlist là host
 * của các URL đó). Không Search grounding, không tool. `sources[]` do code dựng; model chỉ trích id.
 */

export type ResearchJobDeps = {
  /** Client provider thô. Job bọc bằng `createMeteredClient` để ghi `usage_records` và chặn trần. */
  client: StructuredGenerateClient;
  /** Dựng adapter research từ client đã bọc. Mặc định adapter Gemini. */
  createLlm?: (client: StructuredGenerateClient) => ResearchLlm;
  /** Ghi đè trần gọi LLM của run (test). Mặc định `llmCallCeiling(số lượt changes_requested)`. */
  llmCallCeiling?: number;
  dataDir: string;
  /** Mặc định `safeFetch`; test thay bằng fetch giả hoặc safeFetch với resolver giả. */
  fetchUrl?: (url: string, allowedHosts: ReadonlySet<string>) => Promise<SafeFetchResult>;
};

export type ResearchJobResult =
  | { status: "skipped"; reason: string }
  | { status: "failed"; errorCode: string }
  | {
      status: "completed";
      researchArtifactId: string;
      fetchLogArtifactId: string;
      usage: LlmUsage[];
      rejectedFacts: { statement: string; reason: FactRejectionReason }[];
      /** Có khi tái sử dụng artifact research cùng hash đầu vào (P5-01); khi đó không gọi provider. */
      reusedFromArtifactId?: string;
    };

const MAX_REFERENCE_CHARS = 20_000;
const UPLOAD_KEY_PATTERN = /^uploads\/[0-9a-f-]{36}\.(md|txt|pdf)$/;

/** Đọc file upload theo key do server tạo (P2-03); từ chối key lạ và path thoát khỏi DATA_DIR. */
async function readUploadText(dataDir: string, key: string): Promise<string | null> {
  if (!UPLOAD_KEY_PATTERN.test(key) || key.endsWith(".pdf")) {
    return null;
  }
  // `uploads` là junction/symlink ra ngoài DATA_DIR thì không đọc.
  const uploadsRoot = await realpath(join(dataDir, "uploads"));
  if (!isInside(await realpath(dataDir), uploadsRoot)) {
    return null;
  }
  const real = await realpath(resolve(dataDir, key));
  if (!isInside(uploadsRoot, real)) {
    return null;
  }
  return (await readFile(real, "utf8")).slice(0, MAX_REFERENCE_CHARS);
}

type GatheredSources = {
  documents: ResearchDocument[];
  sources: ResearchSource[];
  fetchLog: FetchLog;
  userReferenceSourceIds: Set<string>;
  skippedReferences: { referenceId: string; reason: string }[];
};

async function gatherSources(context: JobContext, deps: ResearchJobDeps): Promise<GatheredSources> {
  const documents: ResearchDocument[] = [];
  const sources: ResearchSource[] = [];
  const fetchLog: FetchLog = { schemaVersion: 1, requests: [] };
  const userReferenceSourceIds = new Set<string>();
  const skippedReferences: GatheredSources["skippedReferences"] = [];
  const urlReferences = context.references.filter((ref) => ref.kind === "user_url");
  const allowedHosts = hostAllowlistFor(urlReferences.map((ref) => ref.uri));
  const fetchUrl = deps.fetchUrl ?? ((url, hosts) => safeFetch(url, { allowedHosts: hosts }));

  let fileIndex = 0;
  let urlIndex = 0;
  for (const ref of context.references) {
    if (ref.kind === "user_file" && /\.(png|jpe?g|webp)$/.test(ref.uri)) {
      // ADR-030: ảnh là hình dùng trong video, không phải tài liệu để nghiên cứu.
      skippedReferences.push({ referenceId: ref.id, reason: "image_for_video" });
      continue;
    }
    if (ref.kind === "user_file") {
      const text = await readUploadText(deps.dataDir, ref.uri).catch(() => null);
      if (text === null) {
        skippedReferences.push({
          referenceId: ref.id,
          reason: ref.uri.endsWith(".pdf") ? "pdf_not_extracted" : "unreadable",
        });
        continue;
      }
      const sourceId = `ref-${++fileIndex}`;
      const title = (ref.title ?? "Tệp tham chiếu").slice(0, 200);
      documents.push({ sourceId, title, origin: "user_reference", text });
      sources.push({ id: sourceId, title, origin: "user_reference" });
      userReferenceSourceIds.add(sourceId);
    } else if (ref.kind === "user_url") {
      const result = await fetchUrl(ref.uri, allowedHosts);
      fetchLog.requests.push(result.log);
      if (result.text === undefined || result.log.finalUrl === null) {
        skippedReferences.push({ referenceId: ref.id, reason: result.log.error ?? "fetch_failed" });
        continue;
      }
      const sourceId = `url-${++urlIndex}`;
      const title = (ref.title ?? result.title ?? new URL(result.log.finalUrl).hostname).slice(
        0,
        200,
      );
      documents.push({ sourceId, title, origin: "fetched_url", text: result.text });
      sources.push({ id: sourceId, title, origin: "fetched_url", url: result.log.finalUrl });
    }
  }
  return { documents, sources, fetchLog, userReferenceSourceIds, skippedReferences };
}

export async function runResearchJob(
  db: StudioDb,
  jobId: string,
  deps: ResearchJobDeps,
): Promise<ResearchJobResult> {
  const context = await loadJobContext(db, jobId);
  if (context === null) {
    return { status: "skipped", reason: "job_not_found" };
  }
  if (context.agentRun.role !== "research") {
    return { status: "skipped", reason: "not_research_job" };
  }
  // Idempotency: job đã xong thì không gọi provider lần nữa.
  if (context.job.status === "completed" || context.job.status === "cancelled") {
    return { status: "skipped", reason: `job_${context.job.status}` };
  }

  let claimed;
  try {
    claimed = await claimJob(db, {
      jobId,
      allowedRunStatuses: ["idea_submitted", "researching"],
      ...(context.workflowRun.status === "idea_submitted"
        ? { runTransition: nextStatus("idea_submitted", "researching") }
        : {}),
    });
  } catch (error) {
    // Run đã hủy/fail hoặc job đã kết thúc giữa lúc đọc và lúc khóa.
    if (error instanceof JobStateError && error.code === "not_claimable") {
      return { status: "skipped", reason: error.message };
    }
    throw error;
  }

  const fail = async (errorCode: string, message: string): Promise<ResearchJobResult> => {
    await failJob(db, {
      jobId,
      errorCode,
      errorMessage: message,
      runTransition: { from: "researching", to: "failed" },
      resumeFrom: "researching",
    });
    return { status: "failed", errorCode };
  };

  const gathered = await gatherSources(context, deps);
  const brief = context.brief;
  const briefInput = {
    topic: brief.topic,
    audience: brief.audience,
    goal: brief.goal,
    durationSec: brief.durationSec,
    language: "vi" as const,
    tone: brief.tone,
    visualStyle: brief.visualStyle,
    ...(brief.notes === null ? {} : { notes: brief.notes }),
  };
  const provenance = {
    fetchLog: gathered.fetchLog,
    userReferenceSourceIds: gathered.userReferenceSourceIds,
  };
  const inputHash = researchInputHash({
    brief: briefInput,
    documents: gathered.documents,
    sources: gathered.sources,
  });

  // Cache (P5-01): cùng nội dung brief và cùng nội dung nguồn thì dùng lại research, không gọi provider.
  // Vẫn lọc lại theo fetch log của lần này để fact `verified` chỉ đứng trên nguồn vừa fetch được.
  let outcome: {
    research: Research;
    rejected: { statement: string; reason: FactRejectionReason }[];
    usage: LlmUsage[];
    repairCount: number;
    reusedFromArtifactId?: string;
  } | null = null;
  const cached = await findResearchArtifactByInputHash(
    db,
    context.workflowRun.projectId,
    inputHash,
  );
  if (cached !== null) {
    const research = await readJsonArtifact(deps.dataDir, cached.storageKey, researchSchema);
    if (research !== null) {
      const filtered = filterResearchFacts(research, provenance);
      outcome = {
        research: filtered.research,
        rejected: filtered.rejected,
        usage: [],
        repairCount: 0,
        reusedFromArtifactId: cached.id,
      };
    }
  }

  if (outcome === null) {
    const ceiling =
      deps.llmCallCeiling ??
      llmCallCeiling(await countChangesRequested(db, context.workflowRun.id));
    const metered = createMeteredClient(deps.client, {
      ceiling,
      store: dbUsageStore(db, {
        workflowRunId: context.workflowRun.id,
        agentRunId: context.agentRun.id,
      }),
    });
    const llm = (deps.createLlm ?? ((client) => createGeminiResearchAdapter({ client })))(metered);
    let extraction;
    try {
      extraction = await llm.extractResearch({ brief: briefInput, documents: gathered.documents });
    } catch (error) {
      if (error instanceof CostCeilingError) {
        return fail("cost_ceiling", error.message);
      }
      if (error instanceof LlmError) {
        // Lỗi schema sau một lần repair và thiếu cấu hình không retry. Lỗi provider retry tới max_attempts.
        if (
          error.code === "schema_invalid" ||
          error.code === "configuration_missing" ||
          error.code === "quota_exhausted"
        ) {
          return fail(error.code, error.message);
        }
        if (claimed.attempt >= claimed.maxAttempts) {
          return fail(error.code, error.message);
        }
      }
      throw error;
    }

    const candidate = researchSchema.safeParse({
      schemaVersion: 1,
      summary: extraction.extraction.summary,
      facts: extraction.extraction.facts,
      sources: gathered.sources,
    });
    if (!candidate.success) {
      return fail("schema_invalid", candidate.error.message);
    }
    const filtered = filterResearchFacts(candidate.data, provenance);
    outcome = {
      research: filtered.research,
      rejected: filtered.rejected,
      usage: extraction.usage,
      repairCount: extraction.repairCount,
    };
  }

  const runId = context.workflowRun.id;
  const fetchLogKey = `artifacts/${runId}/fetch-log-${randomUUID()}.json`;
  const researchKey = `artifacts/${runId}/research-${randomUUID()}.json`;
  const fetchLogHash = await writeJsonArtifact(deps.dataDir, fetchLogKey, gathered.fetchLog);
  const researchHash = await writeJsonArtifact(deps.dataDir, researchKey, outcome.research);

  const metadata = { idempotencyKey: context.job.idempotencyKey, jobId };
  const [fetchLogArtifact, researchArtifact] = await completeJob(db, {
    jobId,
    artifacts: [
      {
        type: "fetch_log",
        schemaVersion: "1",
        contentHash: fetchLogHash,
        storageKey: fetchLogKey,
        metadata,
      },
      {
        type: "research",
        schemaVersion: "1",
        contentHash: researchHash,
        storageKey: researchKey,
        metadata: {
          ...metadata,
          inputHash,
          rejectedFacts: outcome.rejected,
          skippedReferences: gathered.skippedReferences,
          repairCount: outcome.repairCount,
          ...(outcome.reusedFromArtifactId === undefined
            ? {}
            : { reusedFromArtifactId: outcome.reusedFromArtifactId }),
        },
      },
    ],
    dependencies: [[1, 0]],
    runTransition: nextStatus("researching", "research_ready"),
    inputHash,
    // Job kế tiếp (P3-04): script viết hai phương án từ research này.
    nextJob: {
      role: "script",
      queue: "llm",
      idempotencyKey: scriptJobKeyAfterResearch(runId, jobId),
    },
  });
  if (fetchLogArtifact === undefined || researchArtifact === undefined) {
    throw new Error("complete_job_failed");
  }
  return {
    status: "completed",
    researchArtifactId: researchArtifact.id,
    fetchLogArtifactId: fetchLogArtifact.id,
    usage: outcome.usage,
    rejectedFacts: outcome.rejected,
    ...(outcome.reusedFromArtifactId === undefined
      ? {}
      : { reusedFromArtifactId: outcome.reusedFromArtifactId }),
  };
}
