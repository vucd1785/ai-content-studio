import { mkdir } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { claudeCodeCliModel, readClaudeCodeEnv } from "@studio/config/claude-code";
import { loadDataDir } from "@studio/config/data-dir";
import { readGeminiEnv } from "@studio/config/gemini";
import { QUEUE_NAMES, type QueueName } from "@studio/contracts";
import { createDbConnection } from "@studio/db";
import { resolveRepoRoot } from "../cli/paths.js";
import { createClaudeCodeClient } from "../llm/claude-code-client.js";
import { createGeminiStructuredClient } from "../llm/gemini-client.js";
import { createConsumer } from "./consumer.js";
import { startHeartbeat } from "./heartbeat.js";
import { redisConnectionFromUrl } from "./queues.js";

/** Chu kỳ đối chiếu PostgreSQL → Redis: job do API hoặc bước trước tạo được đẩy vào hàng đợi trong vài giây. */
const RECONCILE_INTERVAL_MS = 5_000;

/** `--queues=llm,media` chọn queue; mặc định cả ba. */
function selectedQueues(argv: string[]): QueueName[] {
  const arg = argv.find((value) => value.startsWith("--queues="));
  if (arg === undefined) {
    return [...QUEUE_NAMES];
  }
  const names = arg
    .slice("--queues=".length)
    .split(",")
    .map((name) => name.trim());
  const unknown = names.filter((name) => !(QUEUE_NAMES as readonly string[]).includes(name));
  if (unknown.length > 0 || names.length === 0) {
    throw new Error(
      `queue không hợp lệ: ${unknown.join(", ")} (chỉ nhận ${QUEUE_NAMES.join(", ")})`,
    );
  }
  return names as QueueName[];
}

/**
 * Process worker (quyết định 5, P3-11). Đọc `.env` ở gốc repo qua `--env-file-if-exists`.
 * - `llm` gọi Gemini thật (cần `GEMINI_API_KEY`) hoặc Claude Code CLI cho run chọn model `claude-code…`
 *   (cần `CLAUDE_CODE_MODELS`, CLI đã đăng nhập). Phải có ít nhất một trong hai.
 * - `media` gọi TTS ở `TTS_BASE_URL`, ghi WAV và alignment vào `DATA_DIR`.
 * - `render` chạy ffmpeg + Remotion local, ghi WAV ghép và MP4 vào `DATA_DIR`.
 * Không log key hay URL có mật khẩu.
 */
async function main(): Promise<void> {
  const queues = selectedQueues(process.argv.slice(2));
  const gemini = readGeminiEnv(process.env);
  const claudeCode = readClaudeCodeEnv(process.env);
  const claudeCodeOn = claudeCode.models.length > 0;
  if (queues.includes("llm") && gemini.apiKey === undefined && !claudeCodeOn) {
    console.error(
      "Chưa có GEMINI_API_KEY hay CLAUDE_CODE_MODELS trong .env: không chạy được queue llm.",
    );
    process.exit(1);
  }
  const rawDataDir = loadDataDir();
  const dataDir = isAbsolute(rawDataDir)
    ? rawDataDir
    : resolve(resolveRepoRoot(import.meta.url), rawDataDir);
  await mkdir(dataDir, { recursive: true });

  const { db, close: closeDb } = createDbConnection(
    process.env.DATABASE_URL ?? "postgresql://studio:studio@localhost:5432/studio",
  );
  const consumer = createConsumer(
    {
      db,
      dataDir,
      gemini,
      ...(queues.includes("llm") && gemini.apiKey !== undefined
        ? { client: createGeminiStructuredClient(gemini) }
        : {}),
      ...(queues.includes("llm") && claudeCodeOn
        ? {
            claudeCodeClient: (model: string) => {
              const alias = claudeCodeCliModel(model);
              return createClaudeCodeClient({
                bin: claudeCode.bin,
                timeoutMs: claudeCode.timeoutMs,
                ...(alias === undefined ? {} : { model: alias }),
              });
            },
          }
        : {}),
    },
    {
      queues,
      connection: redisConnectionFromUrl(process.env.REDIS_URL ?? "redis://localhost:6379"),
      onOutcome: (jobId, outcome) =>
        console.log(
          `job ${jobId}: ${outcome.role} ${outcome.status}${outcome.detail ? ` (${outcome.detail})` : ""}`,
        ),
      onError: (jobId, error, final) =>
        console.error(
          `job ${jobId}: lỗi${final ? " (hết lượt retry)" : ", BullMQ sẽ thử lại"}: ${error instanceof Error ? error.message : String(error)}`,
        ),
    },
  );
  console.log(`worker: queue ${queues.join(", ")}; DATA_DIR ${dataDir}`);
  if (queues.includes("llm")) {
    if (gemini.apiKey !== undefined) {
      console.log(
        `llm: Gemini mặc định ${gemini.modelScript}, thinking ${gemini.thinkingLevelScript}`,
      );
    }
    if (claudeCodeOn) {
      console.log(`llm: Claude Code ${claudeCode.models.join(", ")} (CLI ${claudeCode.bin})`);
    }
  }

  // Drizzle bọc lỗi Postgres trong "Failed query: …"; nguyên nhân thật (mất kết nối, DB đang recovery) nằm ở `cause`.
  const describeError = (error: unknown): string => {
    if (!(error instanceof Error)) {
      return String(error);
    }
    const cause = error.cause instanceof Error ? ` ← ${error.cause.message}` : "";
    return `${error.message.split("\n")[0]}${cause}`;
  };

  const tick = async () => {
    try {
      const enqueued = await consumer.reconcile();
      if (enqueued > 0) {
        console.log(`đối chiếu: đẩy ${enqueued} job vào Redis`);
      }
    } catch (error) {
      console.error(`đối chiếu lỗi: ${describeError(error)}`);
    }
  };
  await tick();
  const timer = setInterval(() => void tick(), RECONCILE_INTERVAL_MS);
  // P3-15: giao diện biết worker còn sống và chạy queue nào.
  const heartbeat = await startHeartbeat({
    redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
    queues,
  });

  const shutdown = async () => {
    clearInterval(timer);
    await heartbeat.stop();
    await consumer.close();
    await closeDb();
    process.exit(0);
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

await main();
