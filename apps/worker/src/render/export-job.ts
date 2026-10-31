import {
  approvalIdFromExportJobKey,
  assertExportAllowed,
  ExportNotAllowedError,
  findParentArtifact,
  findRunApproval,
  getArtifactById,
  type StudioDb,
} from "@studio/db";
import { eduVerticalRenderPropsSchema } from "@studio/video/render-props/schema";
import { readJsonArtifact } from "../jobs/job-support.js";
import type { RenderBackend } from "./render-backend.js";
import { runStageJob, type StageJobResult } from "./stage-job.js";

/**
 * Job export (P3-06, role `video`, queue `render`): `exporting` → `exported`. Chỉ export preview mà approval
 * `final` trong key job trỏ tới, và chỉ khi đó vẫn là decision final mới nhất (`assertExportAllowed`).
 * Export render lại đúng render props của preview đó với CRF export (P1-05), không dựng props mới.
 */
export function runExportJob(db: StudioDb, jobId: string, deps: { dataDir: string; backend: RenderBackend }): Promise<StageJobResult> {
  return runStageJob(
    db,
    jobId,
    {
      role: "video",
      enter: { working: "exporting" },
      done: "exported",
      resumeFrom: "exporting",
      precheck: (context) => (approvalIdFromExportJobKey(context.job.idempotencyKey) === null ? "not_export_job" : null),
    },
    async (context) => {
      const runId = context.workflowRun.id;
      const approvalId = approvalIdFromExportJobKey(context.job.idempotencyKey) ?? "";
      const approval = await findRunApproval(db, runId, approvalId);
      if (approval === null || approval.gate !== "final" || approval.decision !== "approved") {
        return { ok: false, errorCode: "approval_required", message: "export job has no final approval" };
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
      const propsRow = preview === null ? null : await findParentArtifact(db, preview.id, "render_props");
      const props =
        propsRow === null ? null : await readJsonArtifact(deps.dataDir, propsRow.storageKey, eduVerticalRenderPropsSchema);
      const audioSha = (propsRow?.metadata as { audioContentSha256?: unknown } | undefined)?.audioContentSha256;
      if (preview === null || props === null || typeof audioSha !== "string") {
        return { ok: false, errorCode: "render_props_invalid", message: "approved preview has no readable render props" };
      }
      const rendered = await deps.backend.render("export", props, audioSha);
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
            },
          },
        ],
        parentArtifacts: [[0, preview.id]],
      };
    },
  );
}
