import { mkdir } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { loadDataDir } from "@studio/config/data-dir";
import { readGeminiEnv } from "@studio/config/gemini";
import { createDbConnection } from "@studio/db";
import { resolveRepoRoot } from "../cli/paths.js";
import { createGeminiStructuredClient } from "../llm/gemini-client.js";
import { createLlmConsumer } from "./llm-consumer.js";
import { redisConnectionFromUrl } from "./queues.js";

/** Chu kỳ đối chiếu PostgreSQL → Redis: job do API hoặc bước trước tạo được đẩy vào hàng đợi trong vài giây. */
const RECONCILE_INTERVAL_MS = 5_000;

/**
 * Process worker queue `llm` (quyết định 5). Gọi Gemini thật: chỉ chạy khi Director bật.
 * Đọc `.env` ở gốc repo qua `--env-file-if-exists` (script `worker:llm`). Không log key hay URL có mật khẩu.
 */
async function main(): Promise<void> {
  const gemini = readGeminiEnv(process.env);
  if (gemini.apiKey === undefined) {
    console.error("GEMINI_API_KEY chưa được đặt trong .env: worker không khởi động.");
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
  const consumer = createLlmConsumer(
    { db, dataDir, client: createGeminiStructuredClient(gemini) },
    {
      connection: redisConnectionFromUrl(process.env.REDIS_URL ?? "redis://localhost:6379"),
      onOutcome: (jobId, outcome) =>
        console.log(
          `llm job ${jobId}: ${outcome.role} ${outcome.status}${outcome.detail ? ` (${outcome.detail})` : ""}`,
        ),
      onError: (jobId, error, final) =>
        console.error(
          `llm job ${jobId}: lỗi${final ? " (hết lượt retry)" : ", BullMQ sẽ thử lại"}: ${error instanceof Error ? error.message : String(error)}`,
        ),
    },
  );
  console.log(
    `worker llm: model ${gemini.modelScript}, thinking ${gemini.thinkingLevelScript}, DATA_DIR ${dataDir}`,
  );

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
