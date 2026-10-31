import { randomUUID } from "node:crypto";
import { storyboardArtifactSchema } from "@studio/contracts";
import type { StudioDb } from "@studio/db";
import { writeJsonArtifact } from "../jobs/job-support.js";
import { type AssetJobResult, runAssetJob } from "./asset-job.js";

/**
 * Job visual (P3-05): storyboard của phương án đã duyệt. Ở MVP storyboard lấy thẳng slot, chữ trên màn hình,
 * `visualIntent`, code và diagram từ script đã validate (05-VIDEO-PIPELINE); không gọi LLM, không tốn trần.
 */
export function runVisualJob(db: StudioDb, jobId: string, deps: { dataDir: string }): Promise<AssetJobResult> {
  return runAssetJob(db, jobId, "visual", deps.dataDir, async (context, approved) => {
    const parsed = storyboardArtifactSchema.safeParse({
      schemaVersion: 1,
      scriptArtifactId: approved.scriptArtifactId,
      variantIndex: approved.variantIndex,
      title: approved.script.title,
      hook: approved.script.hook,
      cta: approved.script.cta,
      scenes: approved.script.scenes,
    });
    if (!parsed.success) {
      return { ok: false, errorCode: "schema_invalid", message: parsed.error.message };
    }
    const key = `artifacts/${context.workflowRun.id}/storyboard-${randomUUID()}.json`;
    const contentHash = await writeJsonArtifact(deps.dataDir, key, parsed.data);
    return {
      ok: true,
      artifacts: [
        {
          type: "storyboard",
          schemaVersion: "1",
          contentHash,
          storageKey: key,
          metadata: {
            idempotencyKey: context.job.idempotencyKey,
            jobId,
            approvalId: approved.approvalId,
            variantIndex: approved.variantIndex,
          },
        },
      ],
      parentArtifacts: [[0, approved.scriptArtifactId]],
    };
  });
}
