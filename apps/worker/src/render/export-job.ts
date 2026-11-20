import {
  approvalIdFromExportJobKey,
  assertExportAllowed,
  ExportNotAllowedError,
  findParentArtifact,
  findRunApproval,
  getArtifactById,
  publishJobKeyAfterExport,
  type StudioDb,
} from "@studio/db";
import { stickStoryRenderPropsSchema } from "@studio/video/stick-story/props";
import { readJsonArtifact } from "../jobs/job-support.js";
import type { RenderBackend } from "./render-backend.js";
import { renderProgressRecorder } from "./render-progress.js";
import { runStageJob, type StageJobResult } from "./stage-job.js";

/** Thời điểm cắt ảnh bìa: thẻ tiêu đề đã bật xong, chưa tắt (thẻ hiện 0–2,4 giây, ADR-021). */
export const THUMBNAIL_AT_MS = 1200;

/**
 * Job export (P3-06, role `video`, queue `render`): `exporting` → `exported`. Chỉ export preview mà approval
 * `final` trong key job trỏ tới, và chỉ khi đó vẫn là decision final mới nhất (`assertExportAllowed`).
 * Export render lại đúng render props của preview đó với CRF export (P1-05), không dựng props mới.
 */
export function runExportJob(
  db: StudioDb,
  jobId: string,
  deps: { dataDir: string; backend: RenderBackend },
): Promise<StageJobResult> {
  return runStageJob(
    db,
    jobId,
    {
      role: "video",
      enter: { working: "exporting" },
      done: "exported",
      resumeFrom: "exporting",
      precheck: (context) =>
        approvalIdFromExportJobKey(context.job.idempotencyKey) === null ? "not_export_job" : null,
    },
    async (context) => {
      const runId = context.workflowRun.id;
      const approvalId = approvalIdFromExportJobKey(context.job.idempotencyKey) ?? "";
      const approval = await findRunApproval(db, runId, approvalId);
      if (approval === null || approval.gate !== "final" || approval.decision !== "approved") {
        return {
          ok: false,
          errorCode: "approval_required",
          message: "export job has no final approval",
        };
      }
      try {
        await assertExportAllowed(db, runId, approval.artifactId);
      } catch (error) {
        if (error instanceof ExportNotAllowedError) {
          return { ok: false, errorCode: error.code, message: error.message };
        }
        throw error;
      }
      const preview = await getArtifactById(db, approval.artifactId);
      const propsRow =
        preview === null ? null : await findParentArtifact(db, preview.id, "render_props");
      const props =
        propsRow === null
          ? null
          : await readJsonArtifact(deps.dataDir, propsRow.storageKey, stickStoryRenderPropsSchema);
      const audioSha = (propsRow?.metadata as { audioContentSha256?: unknown } | undefined)
        ?.audioContentSha256;
      if (preview === null || props === null || typeof audioSha !== "string") {
        return {
          ok: false,
          errorCode: "render_props_invalid",
          message: "approved preview has no readable render props",
        };
      }
      const rendered = await deps.backend.render(
        "export",
        props,
        audioSha,
        renderProgressRecorder(db, jobId),
      );
      // Ảnh bìa (ADR-021): khung lúc thẻ tiêu đề đã hiện rõ. Lỗi ảnh bìa không làm hỏng bản xuất.
      let thumbnailKey: string | null = null;
      if (deps.backend.thumbnail !== undefined) {
        const key = `artifacts/${runId}/thumbnail-${rendered.contentHash.slice(0, 16)}.jpg`;
        try {
          await deps.backend.thumbnail(rendered.storageKey, THUMBNAIL_AT_MS, key);
          thumbnailKey = key;
        } catch (error) {
          console.error(
            `export: không tạo được ảnh bìa: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      return {
        ok: true,
        artifacts: [
          {
            type: "export",
            schemaVersion: "1",
            contentHash: rendered.contentHash,
            storageKey: rendered.storageKey,
            metadata: {
              idempotencyKey: context.job.idempotencyKey,
              jobId,
              approvalId,
              previewArtifactId: preview.id,
              purpose: "export",
              cacheHit: rendered.cacheHit,
              thumbnailKey,
            },
          },
        ],
        parentArtifacts: [[0, preview.id]],
        // ADR-018: xuất xong thì viết bộ đăng bài (queue `llm`); lỗi ở đó không làm hỏng video đã xuất.
        nextJob: (exportJobId) => ({
          role: "publish",
          queue: "llm",
          idempotencyKey: publishJobKeyAfterExport(runId, exportJobId),
        }),
      };
    },
  );
}
