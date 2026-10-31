import {
  claimJob,
  completeJob,
  failJob,
  type JobContext,
  JobStateError,
  loadJobContext,
  type NewJobArtifact,
  type StudioDb,
} from "@studio/db";
import { type ApprovedScript, loadApprovedScript, renderBarrier } from "./approved-script.js";

/**
 * Khung chung của job visual và voice (P3-05). Cả hai chạy trong `producing_assets`, không đổi status run
 * khi xong; job xong sau cùng tạo job render qua rào phụ thuộc trong cùng transaction.
 */

export type AssetJobResult =
  | { status: "skipped"; reason: string }
  | { status: "failed"; errorCode: string }
  | { status: "completed"; artifactIds: string[] };

export type AssetOutput =
  | { ok: false; errorCode: string; message: string }
  | {
      ok: true;
      artifacts: NewJobArtifact[];
      dependencies?: [number, number][];
      parentArtifacts?: [number, string][];
    };

export class AssetJobError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AssetJobError";
    this.code = code;
  }
}

export async function runAssetJob(
  db: StudioDb,
  jobId: string,
  role: "visual" | "voice",
  dataDir: string,
  produce: (context: JobContext, approved: ApprovedScript) => Promise<AssetOutput>,
): Promise<AssetJobResult> {
  const context = await loadJobContext(db, jobId);
  if (context === null) {
    return { status: "skipped", reason: "job_not_found" };
  }
  if (context.agentRun.role !== role) {
    return { status: "skipped", reason: `not_${role}_job` };
  }
  if (context.job.status === "completed" || context.job.status === "cancelled") {
    return { status: "skipped", reason: `job_${context.job.status}` };
  }
  try {
    await claimJob(db, { jobId, allowedRunStatuses: ["producing_assets"] });
  } catch (error) {
    if (error instanceof JobStateError && error.code === "not_claimable") {
      return { status: "skipped", reason: error.message };
    }
    throw error;
  }

  const fail = async (errorCode: string, message: string): Promise<AssetJobResult> => {
    await failJob(db, {
      jobId,
      errorCode,
      errorMessage: message,
      runTransition: { from: "producing_assets", to: "failed" },
      resumeFrom: "producing_assets",
    });
    return { status: "failed", errorCode };
  };

  const approved = await loadApprovedScript(db, context, dataDir);
  if (!approved.ok) {
    return fail(approved.errorCode, "approved script variant is not readable");
  }
  let output: AssetOutput;
  try {
    output = await produce(context, approved.value);
  } catch (error) {
    if (error instanceof AssetJobError) {
      return fail(error.code, error.message);
    }
    throw error;
  }
  if (!output.ok) {
    return fail(output.errorCode, output.message);
  }
  const inserted = await completeJob(db, {
    jobId,
    artifacts: output.artifacts,
    ...(output.dependencies === undefined ? {} : { dependencies: output.dependencies }),
    ...(output.parentArtifacts === undefined ? {} : { parentArtifacts: output.parentArtifacts }),
    runTransition: { from: "producing_assets", to: "producing_assets" },
    barrier: renderBarrier(context.workflowRun.id, approved.value.approvalId),
  });
  return { status: "completed", artifactIds: inserted.map((row) => row.id) };
}
