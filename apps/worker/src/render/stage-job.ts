import {
  claimJob,
  completeJob,
  failJob,
  type JobContext,
  JobStateError,
  loadJobContext,
  type NewJobArtifact,
  type NextJob,
  type RunTransition,
  type StudioDb,
} from "@studio/db";
import { AssetJobError } from "../assets/asset-job.js";
import { advanceTransition } from "../jobs/job-support.js";

/**
 * Khung chung của job render, QA và export (P3-06): claim (kèm cạnh vào trạng thái làm việc),
 * fail với `resume_from` đúng bước, xong thì sang trạng thái kế tiếp và tạo job tiếp theo cùng transaction.
 */

type RunStatus = JobContext["workflowRun"]["status"];
type ResumeFrom = "preview_rendering" | "qa" | "exporting";

export type StageJobResult =
  | { status: "skipped"; reason: string }
  | { status: "failed"; errorCode: string }
  | { status: "completed"; artifactIds: string[] };

export type StageOutput =
  | { ok: false; errorCode: string; message: string }
  | {
      ok: true;
      artifacts: NewJobArtifact[];
      dependencies?: [number, number][];
      parentArtifacts?: [number, string][];
      nextJob?: (jobId: string) => NextJob;
    };

export type StageSpec = {
  role: "video" | "qa";
  /** Run phải đang ở `enter.from` (cạnh vào) hoặc đã ở `working` (retry). */
  enter: { from: RunStatus; working: RunStatus } | { working: RunStatus };
  done: RunStatus;
  resumeFrom: ResumeFrom;
  /** Kiểm key/approval trước khi claim; `null` là hợp lệ. */
  precheck?: (context: JobContext) => string | null;
};

export async function runStageJob(
  db: StudioDb,
  jobId: string,
  spec: StageSpec,
  produce: (context: JobContext) => Promise<StageOutput>,
): Promise<StageJobResult> {
  const context = await loadJobContext(db, jobId);
  if (context === null) {
    return { status: "skipped", reason: "job_not_found" };
  }
  if (context.agentRun.role !== spec.role) {
    return { status: "skipped", reason: `not_${spec.role}_job` };
  }
  if (context.job.status === "completed" || context.job.status === "cancelled") {
    return { status: "skipped", reason: `job_${context.job.status}` };
  }
  const rejected = spec.precheck?.(context) ?? null;
  if (rejected !== null) {
    return { status: "skipped", reason: rejected };
  }
  const entering = "from" in spec.enter && context.workflowRun.status === spec.enter.from;
  try {
    await claimJob(db, {
      jobId,
      allowedRunStatuses: "from" in spec.enter ? [spec.enter.from, spec.enter.working] : [spec.enter.working],
      ...(entering && "from" in spec.enter
        ? { runTransition: advanceTransition(spec.enter.from, spec.enter.working) }
        : {}),
    });
  } catch (error) {
    if (error instanceof JobStateError && error.code === "not_claimable") {
      return { status: "skipped", reason: error.message };
    }
    throw error;
  }

  const working = spec.enter.working;
  const fail = async (errorCode: string, message: string): Promise<StageJobResult> => {
    await failJob(db, {
      jobId,
      errorCode,
      errorMessage: message,
      runTransition: { from: working, to: "failed" },
      resumeFrom: spec.resumeFrom,
    });
    return { status: "failed", errorCode };
  };

  let output: StageOutput;
  try {
    output = await produce(context);
  } catch (error) {
    if (error instanceof AssetJobError) {
      return fail(error.code, error.message);
    }
    throw error;
  }
  if (!output.ok) {
    return fail(output.errorCode, output.message);
  }
  const runTransition: RunTransition = advanceTransition(working, spec.done);
  const inserted = await completeJob(db, {
    jobId,
    artifacts: output.artifacts,
    ...(output.dependencies === undefined ? {} : { dependencies: output.dependencies }),
    ...(output.parentArtifacts === undefined ? {} : { parentArtifacts: output.parentArtifacts }),
    runTransition,
    ...(output.nextJob === undefined ? {} : { nextJob: output.nextJob(jobId) }),
  });
  return { status: "completed", artifactIds: inserted.map((row) => row.id) };
}
