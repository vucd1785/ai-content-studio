import { type JobPayload, jobPayloadSchema, type QueueName } from "@studio/contracts";
import { failJob, type JobContext, loadJobContext, type StudioDb } from "@studio/db";
import { type ConnectionOptions, type Job, Worker } from "bullmq";
import { runVisualJob } from "../assets/visual-job.js";
import { runVoiceJob, type VoiceJobDeps } from "../assets/voice-job.js";
import type { StructuredGenerateClient } from "../llm/structured-output.js";
import { runExportJob } from "../render/export-job.js";
import { runQaJob } from "../render/qa-job.js";
import { createDefaultRenderBackend, type RenderBackend } from "../render/render-backend.js";
import { runRenderJob } from "../render/render-job.js";
import { type ResearchJobDeps, runResearchJob } from "../research/research-job.js";
import { runScriptJob, type ScriptJobDeps } from "../script/script-job.js";
import { closeQueues, createQueues, type QueueSet, reconcileQueues } from "./queues.js";

/**
 * Consumer BullMQ cho ba queue (quyết định 5 và P3-11). Payload chỉ có `jobId`; job đọc mọi thứ từ PostgreSQL
 * và tự chạy theo role của agent:
 * - `llm`: research, script (Gemini), visual (code);
 * - `media`: voice (TTS + alignment qua `services/tts`), qa;
 * - `render`: video, gồm render preview (key `render:`) và export (key `export:`).
 *
 * Job ném lỗi để BullMQ retry tới `max_attempts`. Lỗi bất ngờ mà job không kịp ghi thì `failStuckJob` ghi
 * `failed` khi BullMQ hết lượt, để run không kẹt ở trạng thái làm việc.
 */

export type ConsumerDeps = {
  db: StudioDb;
  dataDir: string;
  /** Client provider thô cho research và script. Không có thì worker không chạy queue `llm`. */
  client?: StructuredGenerateClient;
  research?: Pick<ResearchJobDeps, "createLlm" | "fetchUrl">;
  script?: Pick<ScriptJobDeps, "createLlm">;
  /** TTS và alignment; mặc định gọi `TTS_BASE_URL`. */
  voice?: Pick<VoiceJobDeps, "collectMedia" | "voiceId">;
  /** ffmpeg + Remotion; mặc định `createDefaultRenderBackend(dataDir)`, dựng khi job đầu tiên cần. */
  backend?: RenderBackend;
};

export type JobOutcome = { role: string; status: string; detail?: string };

function detail(result: { status: string; reason?: string; errorCode?: string }): {
  detail?: string;
} {
  const value = result.reason ?? result.errorCode;
  return value === undefined ? {} : { detail: value };
}

/** Chạy một job theo role của agent. */
export async function processJob(deps: ConsumerDeps, jobId: string): Promise<JobOutcome> {
  const context = await loadJobContext(deps.db, jobId);
  if (context === null) {
    return { role: "unknown", status: "skipped", detail: "job_not_found" };
  }
  const role = context.agentRun.role;
  const { db, dataDir } = deps;
  const backend = () => {
    deps.backend ??= createDefaultRenderBackend(dataDir);
    return deps.backend;
  };
  const llm = () => {
    if (deps.client === undefined) {
      throw new Error("worker này không có client LLM cho research/script");
    }
    return deps.client;
  };
  let result: { status: string; reason?: string; errorCode?: string };
  switch (role) {
    case "research":
      result = await runResearchJob(db, jobId, { client: llm(), dataDir, ...deps.research });
      break;
    case "script":
      result = await runScriptJob(db, jobId, { client: llm(), dataDir, ...deps.script });
      break;
    case "visual":
      result = await runVisualJob(db, jobId, { dataDir });
      break;
    case "voice":
      result = await runVoiceJob(db, jobId, { dataDir, ...deps.voice });
      break;
    case "qa":
      result = await runQaJob(db, jobId, { dataDir, backend: backend() });
      break;
    case "video":
      result = context.job.idempotencyKey.startsWith("export:")
        ? await runExportJob(db, jobId, { dataDir, backend: backend() })
        : await runRenderJob(db, jobId, { dataDir, backend: backend() });
      break;
    default:
      return { role, status: "skipped", detail: "no_processor_for_role" };
  }
  return { role, status: result.status, ...detail(result) };
}

type WorkingStage =
  | "researching"
  | "scripting"
  | "producing_assets"
  | "preview_rendering"
  | "qa"
  | "exporting";

/** Trạng thái làm việc (cũng là `resume_from`) của job theo role và key (04-AGENT-ORCHESTRATION). */
function workingStage(context: JobContext): WorkingStage | null {
  switch (context.agentRun.role) {
    case "research":
      return "researching";
    case "script":
      return "scripting";
    case "visual":
    case "voice":
      return "producing_assets";
    case "qa":
      return "qa";
    case "video":
      return context.job.idempotencyKey.startsWith("export:") ? "exporting" : "preview_rendering";
    default:
      return null;
  }
}

/**
 * BullMQ đã hết lượt mà job trong PostgreSQL vẫn `queued`/`running`: ghi `failed` với `resume_from` đúng bước.
 * Job đã tự ghi kết quả (completed, failed, cancelled) thì không làm gì.
 */
export async function failStuckJob(db: StudioDb, jobId: string, error: unknown): Promise<boolean> {
  const context = await loadJobContext(db, jobId);
  const stage = context === null ? null : workingStage(context);
  if (context === null || stage === null || !["queued", "running"].includes(context.job.status)) {
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

export type Consumer = {
  workers: Worker<JobPayload, JobOutcome>[];
  queues: QueueSet;
  /** Đối chiếu PostgreSQL → Redis một lần (job mới do bước trước hoặc API tạo). */
  reconcile: () => Promise<number>;
  close: () => Promise<void>;
};

/**
 * Một Worker BullMQ cho mỗi queue được chọn, concurrency 1: trần gọi LLM đếm rồi ghi không khóa (04 mục Trần),
 * TTS và render dùng chung GPU/CPU máy local. `prefix` và `reconcileScope` chỉ test dùng.
 */
export function createConsumer(
  deps: ConsumerDeps,
  options: {
    queues: QueueName[];
    connection: ConnectionOptions;
    prefix?: string;
    reconcileScope?: () => Promise<{ jobIds: string[] }>;
    onOutcome?: (jobId: string, outcome: JobOutcome) => void;
    onError?: (jobId: string, error: unknown, final: boolean) => void;
  },
): Consumer {
  const queues = createQueues(options.connection, options.prefix);
  const workers = options.queues.map((name) => {
    const worker = new Worker<JobPayload, JobOutcome>(
      name,
      async (job: Job<JobPayload>) => processJob(deps, jobPayloadSchema.parse(job.data).jobId),
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
    return worker;
  });
  return {
    workers,
    queues,
    reconcile: async () => {
      const scope =
        options.reconcileScope === undefined ? undefined : await options.reconcileScope();
      return (await reconcileQueues(deps.db, queues, scope)).enqueued.length;
    },
    close: async () => {
      await Promise.all(workers.map((worker) => worker.close()));
      await closeQueues(queues);
    },
  };
}
