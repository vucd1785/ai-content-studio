import { isClaudeCodeModel } from "@studio/config/claude-code";
import { type GeminiEnvConfig, readGeminiEnv } from "@studio/config/gemini";
import { type JobPayload, jobPayloadSchema, type QueueName } from "@studio/contracts";
import {
  failJob,
  isStoryboardJobKey,
  type JobContext,
  loadJobContext,
  type StudioDb,
} from "@studio/db";
import { type ConnectionOptions, type Job, Worker } from "bullmq";
import { runVisualJob } from "../assets/visual-job.js";
import { runVoiceJob, type VoiceJobDeps } from "../assets/voice-job.js";
import { LlmError } from "../llm/errors.js";
import { createGeminiAdapter } from "../llm/gemini-adapter.js";
import { createGeminiResearchAdapter } from "../llm/gemini-research-adapter.js";
import type { StructuredGenerateClient } from "../llm/structured-output.js";
import { runExportJob } from "../render/export-job.js";
import { runQaJob } from "../render/qa-job.js";
import { createDefaultRenderBackend, type RenderBackend } from "../render/render-backend.js";
import { runRenderJob } from "../render/render-job.js";
import {
  finishStoryboardAfterCrash,
  runStoryboardJob,
  type StoryboardJobDeps,
} from "../render/storyboard-job.js";
import { type ResearchJobDeps, runResearchJob } from "../research/research-job.js";
import { runScriptJob, type ScriptJobDeps } from "../script/script-job.js";
import { closeQueues, createQueues, type QueueSet, reconcileQueues } from "./queues.js";

/**
 * Consumer BullMQ cho ba queue (quyết định 5 và P3-11). Payload chỉ có `jobId`; job đọc mọi thứ từ PostgreSQL
 * và tự chạy theo role của agent:
 * - `llm`: research, script (Gemini, hoặc Claude Code khi run chọn model `claude-code…`), visual (code);
 * - `media`: voice (TTS + alignment qua `services/tts`), qa;
 * - `render`: video, gồm render preview (key `render:`) và export (key `export:`).
 *
 * Job ném lỗi để BullMQ retry tới `max_attempts`. Lỗi bất ngờ mà job không kịp ghi thì `failStuckJob` ghi
 * `failed` khi BullMQ hết lượt, để run không kẹt ở trạng thái làm việc.
 */

export type ConsumerDeps = {
  db: StudioDb;
  dataDir: string;
  /** Client Gemini thô cho research và script. */
  client?: StructuredGenerateClient;
  /** Client Claude Code theo model id `claude-code…` của run (ADR-007, bổ sung 2026-11-02). Không có thì tắt. */
  claudeCodeClient?: (model: string) => StructuredGenerateClient;
  /** Cấu hình Gemini gốc (model mặc định, thinking). Run có `llmModel` thì job research/script đổi model theo run. */
  gemini?: GeminiEnvConfig;
  research?: Pick<ResearchJobDeps, "createLlm" | "fetchUrl">;
  script?: Pick<ScriptJobDeps, "createLlm" | "loadAssetCatalog">;
  /** Test thay renderer ảnh tĩnh và kho tài sản của job storyboard (P6-10). */
  storyboard?: Pick<StoryboardJobDeps, "renderer" | "loadAssetCatalog">;
  /** TTS và alignment theo câu; mặc định gọi `TTS_BASE_URL`. */
  voice?: Pick<VoiceJobDeps, "collectVoiceScenes" | "voiceId">;
  /** ffmpeg + Remotion; mặc định `createDefaultRenderBackend(dataDir)`, dựng khi job đầu tiên cần. */
  backend?: RenderBackend;
};

export type JobOutcome = { role: string; status: string; detail?: string };

/** Client cho model mà worker không cấu hình: mọi lần gọi báo `configuration_missing`. */
function unavailableClient(message: string): StructuredGenerateClient {
  return {
    async generateStructured() {
      throw new LlmError("configuration_missing", message);
    },
  };
}

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
  // P3-12: model Director chọn cho run thay model mặc định; usage ghi đúng model đã gọi.
  const runModel = context.workflowRun.llmModel;
  // Worker thiếu client cho model của run: không ném trước khi job được nhận (run sẽ kẹt ở trạng thái chờ),
  // mà đưa client báo `configuration_missing` để job fail ngay, không retry, và giao diện hiện lý do.
  const llm = (): StructuredGenerateClient => {
    if (runModel !== null && isClaudeCodeModel(runModel)) {
      return (
        deps.claudeCodeClient?.(runModel) ??
        unavailableClient(`Worker chưa bật Claude Code (CLAUDE_CODE_MODELS) cho model ${runModel}.`)
      );
    }
    return deps.client ?? unavailableClient("Worker không có GEMINI_API_KEY cho research/script.");
  };
  const runConfig: GeminiEnvConfig | null =
    runModel === null
      ? null
      : { ...(deps.gemini ?? readGeminiEnv(process.env)), modelScript: runModel };
  let result: { status: string; reason?: string; errorCode?: string };
  switch (role) {
    case "research":
      result = await runResearchJob(db, jobId, {
        client: llm(),
        dataDir,
        ...(runConfig === null
          ? {}
          : {
              createLlm: (metered) =>
                createGeminiResearchAdapter({ config: runConfig, client: metered }),
            }),
        ...deps.research,
      });
      break;
    case "script":
      result = await runScriptJob(db, jobId, {
        client: llm(),
        dataDir,
        ...(runConfig === null
          ? {}
          : {
              createLlm: (metered) => createGeminiAdapter({ config: runConfig, client: metered }),
            }),
        ...deps.script,
      });
      break;
    case "visual":
      // P6-10: job storyboard (queue `render`, key `storyboard:`) khác job visual sau duyệt script.
      result = isStoryboardJobKey(context.job.idempotencyKey)
        ? await runStoryboardJob(db, jobId, { dataDir, ...deps.storyboard })
        : await runVisualJob(db, jobId, { dataDir });
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
export async function failStuckJob(
  db: StudioDb,
  jobId: string,
  error: unknown,
  dataDir?: string,
): Promise<boolean> {
  const context = await loadJobContext(db, jobId);
  // Storyboard hỏng không chặn cổng script (04 mục Phase 6): mở cổng với artifact chỉ có lỗi.
  if (context !== null && isStoryboardJobKey(context.job.idempotencyKey)) {
    return dataDir === undefined ? false : finishStoryboardAfterCrash(db, jobId, dataDir, error);
  }
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
        void failStuckJob(deps.db, job.data.jobId, error, deps.dataDir).catch((cause) =>
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
      const result = await reconcileQueues(deps.db, queues, scope, {
        // Hết lượt lúc DB không ghi được: ghi `failed` thay handler `failed` ở trên.
        onExhausted: (jobId, failedReason) =>
          failStuckJob(deps.db, jobId, new Error(failedReason), deps.dataDir),
      });
      for (const jobId of result.exhausted) {
        options.onError?.(jobId, new Error("đối chiếu ghi failed sau khi BullMQ hết lượt"), true);
      }
      return result.enqueued.length;
    },
    close: async () => {
      await Promise.all(workers.map((worker) => worker.close()));
      await closeQueues(queues);
    },
  };
}
