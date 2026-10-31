import { mkdir } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { loadDataDir } from "@studio/config/data-dir";
import { readGeminiEnv } from "@studio/config/gemini";
import { QUEUE_NAMES, type QueueName } from "@studio/contracts";
import { createDbConnection } from "@studio/db";
import { resolveRepoRoot } from "../cli/paths.js";
import { createGeminiStructuredClient } from "../llm/gemini-client.js";
import { createConsumer } from "./consumer.js";
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
 * - `llm` gọi Gemini thật: cần `GEMINI_API_KEY`.
 * - `media` gọi TTS ở `TTS_BASE_URL`, ghi WAV và alignment vào `DATA_DIR`.
 * - `render` chạy ffmpeg + Remotion local, ghi WAV ghép và MP4 vào `DATA_DIR`.
 * Không log key hay URL có mật khẩu.
 */
async function main(): Promise<void> {
  const queues = selectedQueues(process.argv.slice(2));
  const gemini = readGeminiEnv(process.env);
  if (queues.includes("llm") && gemini.apiKey === undefined) {
    console.error("GEMINI_API_KEY chưa được đặt trong .env: không chạy được queue llm.");
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
      ...(queues.includes("llm") ? { client: createGeminiStructuredClient(gemini) } : {}),
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
    console.log(`llm: model ${gemini.modelScript}, thinking ${gemini.thinkingLevelScript}`);
  }

  const tick = async () => {
    try {
      const enqueued = await consumer.reconcile();
      if (enqueued > 0) {
        console.log(`đối chiếu: đẩy ${enqueued} job vào Redis`);
      }
    } catch (error) {
      console.error(`đối chiếu lỗi: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  await tick();
  const timer = setInterval(() => void tick(), RECONCILE_INTERVAL_MS);

  const shutdown = async () => {
    clearInterval(timer);
    await consumer.close();
    await closeDb();
    process.exit(0);
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

await main();
