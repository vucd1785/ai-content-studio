import { randomUUID } from "node:crypto";
import { type Research, researchSchema, scriptArtifactSchema } from "@studio/contracts";
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
  type StudioDb,
} from "@studio/db";
import { advanceTransition, readJsonArtifact, writeJsonArtifact } from "../jobs/job-support.js";
import { LlmError } from "../llm/errors.js";
import { createGeminiAdapter } from "../llm/gemini-adapter.js";
import {
  CostCeilingError,
  createMeteredClient,
  dbUsageStore,
  llmCallCeiling,
} from "../llm/metered-client.js";
import type { StructuredGenerateClient } from "../llm/structured-output.js";
import type { LlmUsage, StructuredLlmAdapter } from "../llm/types.js";

/**
 * Job script (P3-04, docs/04-AGENT-ORCHESTRATION.md). Chỉ nhận `jobId`, đọc research mới nhất của run,
 * gọi LLM một lần (cộng repair) cho hai phương án, ghi artifact `script` `{ variants: [Script, Script] }`,
 * rồi dừng ở `waiting_script_approval` với agent `waiting_approval`. Không bao giờ ghi `approved`.
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
};

export type ScriptJobResult =
  | { status: "skipped"; reason: string }
  | { status: "failed"; errorCode: string }
  | { status: "completed"; scriptArtifactId: string; usage: LlmUsage[]; directorNote: string | null };

/** Tóm tắt research đưa vào prompt: summary và fact đã qua bộ lọc nguồn. */
function researchSummaryText(research: Research): string {
  const facts = research.facts.map((fact) => `- [${fact.claimStatus}] ${fact.statement}`);
  return [research.summary, ...facts].join("\n");
}

export async function runScriptJob(db: StudioDb, jobId: string, deps: ScriptJobDeps): Promise<ScriptJobResult> {
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
    researchRow === null ? null : await readJsonArtifact(deps.dataDir, researchRow.storageKey, researchSchema);
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
  let generated;
  try {
    generated = await llm.generateScriptVariants({
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
      researchSummary: researchSummaryText(research),
      ...(directorNote === null ? {} : { directorNote }),
    });
  } catch (error) {
    if (error instanceof CostCeilingError) {
      return fail("cost_ceiling", error.message);
    }
    if (error instanceof LlmError) {
      if (error.code === "schema_invalid" || error.code === "configuration_missing") {
        return fail(error.code, error.message);
      }
      if (claimed.attempt >= claimed.maxAttempts) {
        return fail(error.code, error.message);
      }
    }
    throw error;
  }

  const artifact = scriptArtifactSchema.safeParse({ variants: generated.variants });
  if (!artifact.success) {
    return fail("schema_invalid", artifact.error.message);
  }
  const key = `artifacts/${runId}/script-${randomUUID()}.json`;
  const contentHash = await writeJsonArtifact(deps.dataDir, key, artifact.data);
  const [scriptArtifact] = await completeJob(db, {
    jobId,
    artifacts: [
      {
        type: "script",
        schemaVersion: "1",
        contentHash,
        storageKey: key,
        metadata: {
          idempotencyKey: context.job.idempotencyKey,
          jobId,
          researchArtifactId: researchRow.id,
          repairCount: generated.repairCount,
          ...(approvalId === null ? {} : { changesRequestedApprovalId: approvalId }),
        },
      },
    ],
    parentArtifacts: [[0, researchRow.id]],
    runTransition: advanceTransition("scripting", "waiting_script_approval"),
    agentStatus: "waiting_approval",
  });
  if (scriptArtifact === undefined) {
    throw new Error("complete_job_failed");
  }
  return { status: "completed", scriptArtifactId: scriptArtifact.id, usage: generated.usage, directorNote };
}
