import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { type FormatPack, getFormatPack, type Research, researchSchema } from "@studio/contracts";
import {
  approvalIdFromScriptJobKey,
  claimJob,
  completeJob,
  countChangesRequested,
  failJob,
  findLatestRunArtifact,
  findRunApproval,
  JobStateError,
  loadJobContext,
  loadRunBrandProfile,
  type StudioDb,
  storyboardJobKeyAfterScript,
} from "@studio/db";
import { importReferenceImages } from "../assets/images/reference-images.js";
import { resolveRepoRoot } from "../cli/paths.js";
import { advanceTransition, readJsonArtifact, writeJsonArtifact } from "../jobs/job-support.js";
import { loadApprovedAssetCatalog } from "../llm/asset-catalog.js";
import { selectRelevantAssets } from "../llm/asset-selection.js";
import { LlmError } from "../llm/errors.js";
import { createGeminiAdapter } from "../llm/gemini-adapter.js";
import {
  CostCeilingError,
  createMeteredClient,
  dbUsageStore,
  llmCallCeiling,
} from "../llm/metered-client.js";
import type { CatalogEntry } from "../llm/script-v2-prompt.js";
import type { StructuredGenerateClient } from "../llm/structured-output.js";
import type { LlmUsage, ScriptV2GenerationResult, StructuredLlmAdapter } from "../llm/types.js";

/**
 * Job script (P3-04, P6-10, docs/04-AGENT-ORCHESTRATION.md). Chỉ nhận `jobId`, đọc research mới nhất của run,
 * gọi LLM một lần (cộng repair) cho hai phương án script `2` có shot list, ghi artifact `script` schema `2`,
 * rồi sang `storyboarding` và tạo job storyboard. Không bao giờ ghi `approved`. Mọi gói đều đi script `2`:
 * script `1` đã xóa (ADR-013 bổ sung (2) 2026-11-03).
 *
 * Lượt sửa: route approval tạo job script mới khi `changes_requested`; key job mang approval id,
 * job đọc note từ đó. Research không chạy lại.
 */

export type ScriptJobDeps = {
  /** Client provider thô; job bọc bằng `createMeteredClient` (trần tính chung cả run). */
  client: StructuredGenerateClient;
  /** Dựng adapter script từ client đã bọc. Mặc định adapter Gemini. */
  createLlm?: (client: StructuredGenerateClient) => StructuredLlmAdapter;
  llmCallCeiling?: number;
  dataDir: string;
  /** Kho tài sản `approved` theo slug kênh; mặc định đọc manifest motion kit (test thay bản cố định). */
  loadAssetCatalog?: (brandSlug: string) => CatalogEntry[];
  /**
   * ADR-030: đưa ảnh Director tải lên vào kho trước khi viết kịch bản; trả id và mô tả. Mặc định đọc file upload và
   * ghi tài sản vào motion kit (test thay bản giả).
   */
  importReferenceImages?: (input: {
    references: readonly { id: string; kind: string; uri: string; title: string | null }[];
    brandSlug: string;
  }) => Promise<{ id: string; description: string }[]>;
};

export type ScriptJobResult =
  | { status: "skipped"; reason: string }
  | { status: "failed"; errorCode: string }
  | {
      status: "completed";
      scriptArtifactId: string;
      usage: LlmUsage[];
      directorNote: string | null;
    };

/** Tóm tắt research đưa vào prompt: summary và fact đã qua bộ lọc nguồn. */
function researchSummaryText(research: Research): string {
  const facts = research.facts.map((fact) => `- [${fact.claimStatus}] ${fact.statement}`);
  return [research.summary, ...facts].join("\n");
}

export async function runScriptJob(
  db: StudioDb,
  jobId: string,
  deps: ScriptJobDeps,
): Promise<ScriptJobResult> {
  const context = await loadJobContext(db, jobId);
  if (context === null) {
    return { status: "skipped", reason: "job_not_found" };
  }
  if (context.agentRun.role !== "script") {
    return { status: "skipped", reason: "not_script_job" };
  }
  if (context.job.status === "completed" || context.job.status === "cancelled") {
    return { status: "skipped", reason: `job_${context.job.status}` };
  }

  let claimed;
  try {
    claimed = await claimJob(db, {
      jobId,
      allowedRunStatuses: ["research_ready", "scripting"],
      ...(context.workflowRun.status === "research_ready"
        ? { runTransition: advanceTransition("research_ready", "scripting") }
        : {}),
    });
  } catch (error) {
    if (error instanceof JobStateError && error.code === "not_claimable") {
      return { status: "skipped", reason: error.message };
    }
    throw error;
  }

  const fail = async (errorCode: string, message: string): Promise<ScriptJobResult> => {
    await failJob(db, {
      jobId,
      errorCode,
      errorMessage: message,
      runTransition: { from: "scripting", to: "failed" },
      resumeFrom: "scripting",
    });
    return { status: "failed", errorCode };
  };

  const runId = context.workflowRun.id;
  const researchRow = await findLatestRunArtifact(db, runId, "research");
  const research =
    researchRow === null
      ? null
      : await readJsonArtifact(deps.dataDir, researchRow.storageKey, researchSchema);
  if (researchRow === null || research === null) {
    return fail("research_missing", "no readable research artifact for this run");
  }

  const approvalId = approvalIdFromScriptJobKey(context.job.idempotencyKey);
  const approval = approvalId === null ? null : await findRunApproval(db, runId, approvalId);
  const directorNote = approval?.decision === "changes_requested" ? approval.note : null;

  const brief = context.brief;
  const ceiling = deps.llmCallCeiling ?? llmCallCeiling(await countChangesRequested(db, runId));
  const metered = createMeteredClient(deps.client, {
    ceiling,
    store: dbUsageStore(db, { workflowRunId: runId, agentRunId: context.agentRun.id }),
  });
  const llm = (deps.createLlm ?? ((client) => createGeminiAdapter({ client })))(metered);
  const pack = getFormatPack(brief.formatId, brief.formatVersion);
  if (pack === undefined) {
    return fail(
      "configuration_missing",
      `unknown format pack ${brief.formatId} v${brief.formatVersion}`,
    );
  }
  return runScriptV2({
    db,
    jobId,
    deps,
    context,
    claimed,
    fail,
    research,
    researchRow,
    approvalId,
    directorNote,
    pack,
    llm,
  });
}

type ScriptV2Args = {
  db: StudioDb;
  jobId: string;
  deps: ScriptJobDeps;
  context: NonNullable<Awaited<ReturnType<typeof loadJobContext>>>;
  claimed: { attempt: number; maxAttempts: number };
  fail: (errorCode: string, message: string) => Promise<ScriptJobResult>;
  research: Research;
  researchRow: { id: string };
  approvalId: string | null;
  directorNote: string | null;
  pack: FormatPack;
  llm: StructuredLlmAdapter;
};

/**
 * Script `2` (P6-10): một lần gọi cho hai phương án kèm shot list, dùng tính cách và giọng điệu kênh,
 * danh sách tài sản `approved`. Ghi artifact `script` schema `2`, chuyển `scripting → storyboarding` và
 * tạo job storyboard (queue `render`) trong cùng transaction. Không ghi approval.
 */
async function runScriptV2(args: ScriptV2Args): Promise<ScriptJobResult> {
  const { db, jobId, deps, context, claimed, fail, research, pack, llm } = args;
  const runId = context.workflowRun.id;
  const brand = await loadRunBrandProfile(db, runId);
  if (brand === null) {
    return fail("configuration_missing", "project has no brand profile");
  }
  const brief = context.brief;
  // ADR-030 cách 1: ảnh Director tải lên thành tài sản và luôn có trong danh mục của run.
  const directorImages = await (
    deps.importReferenceImages ??
    ((input) =>
      importReferenceImages({
        ...input,
        dataDir: deps.dataDir,
        kitSrc: join(resolveRepoRoot(import.meta.url), "packages", "motion-kit", "src"),
        log: (line) => console.log(line),
      }))
  )({ references: context.references, brandSlug: brand.slug });
  const fullCatalog = (deps.loadAssetCatalog ?? loadApprovedAssetCatalog)(brand.slug);
  // ADR-017 mục 1: chỉ đưa tài sản khớp brief và research vào prompt, để danh mục không dài theo kho.
  const { selected } = selectRelevantAssets(fullCatalog, [
    brief.topic,
    brief.audience,
    brief.goal,
    brief.tone,
    brief.visualStyle,
    brief.notes,
    args.directorNote,
    researchSummaryText(research),
  ]);
  const catalog = [
    ...selected,
    ...fullCatalog.filter(
      (a) => directorImages.some((d) => d.id === a.id) && !selected.some((s) => s.id === a.id),
    ),
  ];
  const mode = context.workflowRun.creativeMode === "creative" ? "creative" : "standard";
  const cast = brand.characters.map((c) => ({
    characterKey: c.characterKey,
    speaks: c.speaks,
    displayName: c.displayName,
    role: c.role,
    personality: c.personality,
    catchphrases: c.catchphrases,
  }));
  let generated: ScriptV2GenerationResult;
  try {
    generated = await llm.generateScriptV2Variants(
      {
        brief: {
          topic: brief.topic,
          audience: brief.audience,
          goal: brief.goal,
          durationSec: brief.durationSec,
          language: "vi",
          tone: brief.tone,
          visualStyle: brief.visualStyle,
          ...(brief.notes === null ? {} : { notes: brief.notes }),
        },
        format: pack,
        cast,
        assetCatalog: catalog,
        mode,
        toneRules: brand.toneRules,
        researchSummary: researchSummaryText(research),
        researchSources: research.sources.map((source) => ({
          id: source.id,
          title: source.title,
          ...(source.url === undefined ? {} : { url: source.url }),
        })),
        ...(args.directorNote === null ? {} : { directorNote: args.directorNote }),
        ...(directorImages.length === 0
          ? {}
          : { directorImageIds: directorImages.map((d) => d.id) }),
      },
      {
        cast: cast.map((c) => ({ characterKey: c.characterKey, speaks: c.speaks })),
        assetCatalog: catalog.map((a) => ({ id: a.id, kind: a.kind })),
        format: pack,
        mode,
      },
    );
  } catch (error) {
    if (error instanceof CostCeilingError) {
      return fail("cost_ceiling", error.message);
    }
    if (error instanceof LlmError) {
      if (
        error.code === "schema_invalid" ||
        error.code === "configuration_missing" ||
        error.code === "quota_exhausted" ||
        claimed.attempt >= claimed.maxAttempts
      ) {
        return fail(error.code, error.message);
      }
    }
    throw error;
  }

  const key = `artifacts/${runId}/script-${randomUUID()}.json`;
  const contentHash = await writeJsonArtifact(deps.dataDir, key, { variants: generated.variants });
  const [scriptArtifact] = await completeJob(db, {
    jobId,
    artifacts: [
      {
        type: "script",
        schemaVersion: "2",
        contentHash,
        storageKey: key,
        metadata: {
          idempotencyKey: context.job.idempotencyKey,
          jobId,
          researchArtifactId: args.researchRow.id,
          repairCount: generated.repairCount,
          formatId: pack.id,
          formatVersion: pack.version,
          creativeMode: mode,
          brandProfileId: brand.id,
          ...(args.approvalId === null ? {} : { changesRequestedApprovalId: args.approvalId }),
        },
      },
    ],
    parentArtifacts: [[0, args.researchRow.id]],
    runTransition: advanceTransition("scripting", "storyboarding"),
    // Kịch bản đã xong và chờ Director; storyboard chỉ thêm ảnh cho màn duyệt (04 mục Phase 6).
    agentStatus: "waiting_approval",
    nextJob: {
      role: "visual",
      queue: "render",
      idempotencyKey: storyboardJobKeyAfterScript(runId, jobId),
    },
  });
  if (scriptArtifact === undefined) {
    throw new Error("complete_job_failed");
  }
  return {
    status: "completed",
    scriptArtifactId: scriptArtifact.id,
    usage: generated.usage,
    directorNote: args.directorNote,
  };
}
