import { type Script, scriptArtifactSchema } from "@studio/contracts";
import {
  approvalIdFromAssetJobKey,
  assetJobKeyAfterScriptApproval,
  type AssetRole,
  findRunApproval,
  getArtifactById,
  type JobContext,
  renderJobKeyAfterAssets,
  type StudioDb,
} from "@studio/db";
import { readJsonArtifact } from "../jobs/job-support.js";

/**
 * Phương án đã duyệt mà job visual/voice làm việc trên đó (P3-05). Approval id lấy từ key của job;
 * artifact script và `variantIndex` lấy từ approval đó (quyết định 6), không đoán phương án.
 */
export type ApprovedScript = {
  approvalId: string;
  scriptArtifactId: string;
  variantIndex: 1 | 2;
  script: Script;
};

export type ApprovedScriptResult = { ok: true; value: ApprovedScript } | { ok: false; errorCode: string };

export async function loadApprovedScript(
  db: StudioDb,
  context: JobContext,
  dataDir: string,
): Promise<ApprovedScriptResult> {
  const approvalId = approvalIdFromAssetJobKey(context.job.idempotencyKey);
  const approval = approvalId === null ? null : await findRunApproval(db, context.workflowRun.id, approvalId);
  if (
    approvalId === null ||
    approval === null ||
    approval.gate !== "script" ||
    approval.decision !== "approved" ||
    (approval.variantIndex !== 1 && approval.variantIndex !== 2)
  ) {
    return { ok: false, errorCode: "approval_missing" };
  }
  const row = await getArtifactById(db, approval.artifactId);
  const content = row === null ? null : await readJsonArtifact(dataDir, row.storageKey, scriptArtifactSchema);
  if (row === null || content === null) {
    return { ok: false, errorCode: "script_missing" };
  }
  const script = content.variants[approval.variantIndex - 1];
  if (script === undefined) {
    return { ok: false, errorCode: "script_missing" };
  }
  return {
    ok: true,
    value: { approvalId, scriptArtifactId: row.id, variantIndex: approval.variantIndex, script },
  };
}

/** Rào phụ thuộc: render chỉ được tạo khi visual và voice của cùng approval đều xong. */
export function renderBarrier(workflowRunId: string, approvalId: string) {
  const roles: AssetRole[] = ["visual", "voice"];
  return {
    requiredJobKeys: roles.map((role) => assetJobKeyAfterScriptApproval(role, workflowRunId, approvalId)),
    nextJob: {
      role: "video" as const,
      queue: "render" as const,
      idempotencyKey: renderJobKeyAfterAssets(workflowRunId, approvalId),
    },
  };
}
