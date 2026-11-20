import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { type PublishCopy, publishCopySchema, publishKitSchema } from "@studio/contracts";
import {
  claimJob,
  completeJob,
  failJob,
  findLatestApprovedScript,
  findLatestRunArtifact,
  getArtifactById,
  JobStateError,
  loadJobContext,
  loadRunBrandProfile,
  type StudioDb,
} from "@studio/db";
import { stickStoryRenderPropsSchema } from "@studio/video/stick-story/props";
import { loadScriptV2Variant } from "../assets/approved-script.js";
import { resolveRepoRoot } from "../cli/paths.js";
import { readJsonArtifact, writeJsonArtifact } from "../jobs/job-support.js";
import { LlmError } from "../llm/errors.js";
import { createMeteredClient, dbUsageStore } from "../llm/metered-client.js";
import {
  generateWithSchemaRepair,
  type StructuredGenerateClient,
} from "../llm/structured-output.js";
import { imageCreditsFor } from "./image-credits.js";
import {
  buildPublishPrompt,
  PUBLISH_JSON_SCHEMA,
  PUBLISH_SYSTEM_INSTRUCTION,
} from "./publish-prompt.js";
import { buildPublishKit } from "./publish-text.js";

export type PublishJobDeps = {
  dataDir: string;
  client: StructuredGenerateClient;
  /** Model của run (Director chọn) hoặc model script mặc định. */
  model: string;
};

export type PublishJobResult =
  | { status: "skipped"; reason: string }
  | { status: "failed"; errorCode: string }
  | { status: "completed"; artifactIds: string[] };

/**
 * Job `publish` (ADR-018, queue `llm`): sau khi xuất video, viết tiêu đề, mô tả, hashtag cho YouTube, Facebook,
 * TikTok từ phương án đã duyệt; ghép phần chân cố định; ghi artifact `publish_kit`. Run giữ `exported`:
 * lỗi ở đây không làm hỏng video đã xuất, Director bấm "Tạo lại" ở tab Bản cuối.
 */
export async function runPublishJob(
  db: StudioDb,
  jobId: string,
  deps: PublishJobDeps,
): Promise<PublishJobResult> {
  const context = await loadJobContext(db, jobId);
  if (context === null) {
    return { status: "skipped", reason: "job_not_found" };
  }
  if (context.agentRun.role !== "publish") {
    return { status: "skipped", reason: "not_publish_job" };
  }
  if (context.job.status === "completed" || context.job.status === "cancelled") {
    return { status: "skipped", reason: `job_${context.job.status}` };
  }
  try {
    await claimJob(db, { jobId, allowedRunStatuses: ["exported"] });
  } catch (error) {
    if (error instanceof JobStateError && error.code === "not_claimable") {
      return { status: "skipped", reason: error.message };
    }
    throw error;
  }
  const fail = async (errorCode: string, message: string): Promise<PublishJobResult> => {
    await failJob(db, { jobId, errorCode, errorMessage: message });
    return { status: "failed", errorCode };
  };

  const runId = context.workflowRun.id;
  const approval = await findLatestApprovedScript(db, runId);
  const scriptRow = approval === null ? null : await getArtifactById(db, approval.artifactId);
  const loaded =
    approval === null || scriptRow === null || approval.variantIndex === null
      ? null
      : await loadScriptV2Variant(
          db,
          deps.dataDir,
          runId,
          scriptRow,
          approval.variantIndex as 1 | 2,
        );
  if (loaded === null) {
    return fail("script_missing", "run has no readable approved script v2 variant");
  }
  const propsRow = await findLatestRunArtifact(db, runId, "render_props");
  const props =
    propsRow === null
      ? null
      : await readJsonArtifact(deps.dataDir, propsRow.storageKey, stickStoryRenderPropsSchema);
  const durationSec = Math.max(
    1,
    Math.round((props?.audio.durationMs ?? context.brief.durationSec * 1000) / 1000),
  );
  const brand = await loadRunBrandProfile(db, runId);
  const channelName = brand?.displayName ?? "kênh";

  // Không tính vào trần lượt gọi của run (cùng lý do với vai `visual`, ADR-017 mục 4): một lượt, sau khi xuất.
  const client = createMeteredClient(deps.client, {
    ceiling: Number.MAX_SAFE_INTEGER,
    store: dbUsageStore(db, { workflowRunId: runId, agentRunId: context.agentRun.id }),
  });
  let copy: { data: PublishCopy };
  try {
    copy = await generateWithSchemaRepair(publishCopySchema, client, {
      systemInstruction: PUBLISH_SYSTEM_INSTRUCTION,
      userPrompt: buildPublishPrompt({
        channelName,
        topic: context.brief.topic,
        audience: context.brief.audience,
        goal: context.brief.goal,
        durationSec,
        script: loaded.script,
      }),
      responseJsonSchema: PUBLISH_JSON_SCHEMA,
      model: deps.model,
      thinkingLevel: "low",
    });
  } catch (error) {
    if (error instanceof LlmError) {
      return fail(error.code, error.message);
    }
    return fail("provider_error", error instanceof Error ? error.message : String(error));
  }
  const kit = publishKitSchema.parse(
    buildPublishKit(copy.data, {
      channelName,
      copyrightContact: brand?.copyrightContact ?? null,
      videoTitle: loaded.script.title,
      castNames: loaded.brand.characters.map((c) => c.displayName),
      durationSec,
      sources: loaded.script.sources,
      // ADR-030: ảnh thật trong video có giấy phép yêu cầu ghi công.
      imageCredits: imageCreditsFor(
        props?.shots ?? [],
        join(resolveRepoRoot(import.meta.url), "packages", "motion-kit", "src"),
      ),
    }),
  );
  const key = `artifacts/${runId}/publish-kit-${randomUUID()}.json`;
  const contentHash = await writeJsonArtifact(deps.dataDir, key, kit);
  const [row] = await completeJob(db, {
    jobId,
    artifacts: [
      {
        type: "publish_kit",
        schemaVersion: "1",
        contentHash,
        storageKey: key,
        metadata: { idempotencyKey: context.job.idempotencyKey, jobId, model: deps.model },
      },
    ],
    ...(scriptRow === null ? {} : { parentArtifacts: [[0, scriptRow.id]] }),
    runTransition: { from: "exported", to: "exported" },
  });
  return { status: "completed", artifactIds: row === undefined ? [] : [row.id] };
}
