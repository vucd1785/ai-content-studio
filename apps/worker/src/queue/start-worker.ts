import { createDbConnection } from "@studio/db";
import { closeQueues, createQueues, reconcileQueues, redisConnectionFromUrl } from "./queues.js";

/**
 * Bước khởi động worker (P3-01): đối chiếu `jobs` với Redis rồi thoát.
 * Processor cho từng queue gắn ở P3-02 trở đi.
 */
async function main(): Promise<void> {
  const databaseUrl =
    process.env.DATABASE_URL ?? "postgresql://studio:studio@localhost:5432/studio";
  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
  const { db, close } = createDbConnection(databaseUrl);
  const queues = createQueues(redisConnectionFromUrl(redisUrl));
  try {
    const result = await reconcileQueues(db, queues);
    console.log(
      `reconcile: checked=${result.checked} enqueued=${result.enqueued.length} present=${result.alreadyPresent.length}`,
    );
  } finally {
    await closeQueues(queues);
    await close();
  }
}

await main();
