import { type JobPayload, jobPayloadSchema } from "@studio/contracts";
import { failJob, type JobContext, loadJobContext, type StudioDb } from "@studio/db";
import { type ConnectionOptions, type Job, Worker } from "bullmq";
import { runVisualJob } from "../assets/visual-job.js";
import type { StructuredGenerateClient } from "../llm/structured-output.js";
import { type ResearchJobDeps, runResearchJob } from "../research/research-job.js";
import { runScriptJob, type ScriptJobDeps } from "../script/script-job.js";
import { closeQueues, createQueues, type QueueSet, reconcileQueues } from "./queues.js";

/**
 * Consumer queue `llm` (quyết định 5): research, script và visual (visual không gọi LLM nhưng nằm ở queue này).
 * Payload chỉ có `jobId`; mọi thứ khác đọc từ PostgreSQL. Job lỗi provider ném lại để BullMQ retry tới
 * `max_attempts`; job tự ghi `failed` ở lần cuối. Lỗi bất ngờ (process, bug) mà job không kịp ghi thì
 * `failStuckJob` ghi khi BullMQ hết lượt, để run không kẹt ở trạng thái làm việc.
 */

export type LlmConsumerDeps = {
  db: StudioDb;
  dataDir: string;
  /** Client provider thô; mỗi job tự bọc bằng client đo usage và trần. */
  client: StructuredGenerateClient;
  research?: Pick<ResearchJobDeps, "createLlm" | "fetchUrl">;
  script?: Pick<ScriptJobDeps, "createLlm">;
};

export type LlmJobOutcome = { role: string; status: string; detail?: string };

/** Chạy một job của queue `llm` theo role của agent. */
export async function processLlmJob(deps: LlmConsumerDeps, jobId: string): Promise<LlmJobOutcome> {
  const context = await loadJobContext(deps.db, jobId);
  if (context === null) {
    return { role: "unknown", status: "skipped", detail: "job_not_found" };
  }
  const role = context.agentRun.role;
  if (role === "research") {
    const result = await runResearchJob(deps.db, jobId, {
      client: deps.client,
      dataDir: deps.dataDir,
      ...deps.research,
    });
    return { role, status: result.status, ...detail(result) };
  }
  if (role === "script") {
    const result = await runScriptJob(deps.db, jobId, {
      client: deps.client,
      dataDir: deps.dataDir,
      ...deps.script,
    });
    return { role, status: result.status, ...detail(result) };
  }
  if (role === "visual") {
    const result = await runVisualJob(deps.db, jobId, { dataDir: deps.dataDir });
    return { role, status: result.status, ...detail(result) };
  }
  return { role, status: "skipped", detail: "not_llm_queue_role" };
}

function detail(result: { status: string; reason?: string; errorCode?: string }): {
  detail?: string;
} {
  const value = result.reason ?? result.errorCode;
  return value === undefined ? {} : { detail: value };
}

/** Trạng thái làm việc và `resume_from` của từng role queue `llm` (04-AGENT-ORCHESTRATION). */
const ROLE_STAGE: Partial<
  Record<JobContext["agentRun"]["role"], "researching" | "scripting" | "producing_assets">
> = {
  research: "researching",
  script: "scripting",
  visual: "producing_assets",
};

/**
 * BullMQ đã hết lượt mà job trong PostgreSQL vẫn `queued`/`running`: ghi `failed` với `resume_from` đúng bước.
 * Job đã tự ghi kết quả (completed, failed, cancelled) thì không làm gì.
 */
export async function failStuckJob(db: StudioDb, jobId: string, error: unknown): Promise<boolean> {
  const context = await loadJobContext(db, jobId);
  const stage = context === null ? undefined : ROLE_STAGE[context.agentRun.role];
  if (
    context === null ||
    stage === undefined ||
    !["queued", "running"].includes(context.job.status)
  ) {
    return false;
  }
  await failJob(db, {
    jobId,
    errorCode: "worker_error",
    errorMessage: error instanceof Error ? error.message : String(error),
    runTransition: { from: stage, to: "failed" },
    resumeFrom: stage,
  });
  return true;
}

export type LlmConsumer = {
  worker: Worker<JobPayload, LlmJobOutcome>;
  queues: QueueSet;
  /** Đối chiếu PostgreSQL → Redis một lần (job mới do bước trước hoặc API tạo). */
  reconcile: () => Promise<number>;
  close: () => Promise<void>;
};

/**
 * Worker BullMQ cho queue `llm`, concurrency 1 (trần gọi LLM đếm rồi ghi, không khóa: 04 mục Trần).
 * `prefix` và `reconcileScope` chỉ test dùng để không đụng queue và hàng thật.
 */
export function createLlmConsumer(
  deps: LlmConsumerDeps,
  options: {
    connection: ConnectionOptions;
    prefix?: string;
    reconcileScope?: () => Promise<{ jobIds: string[] }>;
    onOutcome?: (jobId: string, outcome: LlmJobOutcome) => void;
    onError?: (jobId: string, error: unknown, final: boolean) => void;
  },
): LlmConsumer {
  const queues = createQueues(options.connection, options.prefix);
  const worker = new Worker<JobPayload, LlmJobOutcome>(
    "llm",
    async (job: Job<JobPayload>) => {
      const { jobId } = jobPayloadSchema.parse(job.data);
      return processLlmJob(deps, jobId);
    },
    {
      connection: options.connection,
      concurrency: 1,
      ...(options.prefix === undefined ? {} : { prefix: options.prefix }),
    },
  );
  worker.on("completed", (job, outcome) => options.onOutcome?.(job.data.jobId, outcome));
  worker.on("failed", (job, error) => {
    if (job === undefined) {
      return;
    }
    const final = job.attemptsMade >= (job.opts.attempts ?? 1);
    options.onError?.(job.data.jobId, error, final);
    if (final) {
      void failStuckJob(deps.db, job.data.jobId, error).catch((cause) =>
        options.onError?.(job.data.jobId, cause, true),
      );
    }
  });
  return {
    worker,
    queues,
    reconcile: async () => {
      const scope =
        options.reconcileScope === undefined ? undefined : await options.reconcileScope();
      return (await reconcileQueues(deps.db, queues, scope)).enqueued.length;
    },
    close: async () => {
      await worker.close();
      await closeQueues(queues);
    },
  };
}
