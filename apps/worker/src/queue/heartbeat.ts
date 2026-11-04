import { hostname } from "node:os";
import {
  type QueueName,
  WORKER_HEARTBEAT_INTERVAL_MS,
  WORKER_HEARTBEAT_PREFIX,
  WORKER_HEARTBEAT_TTL_SECONDS,
  type WorkerHeartbeat,
} from "@studio/contracts";
import { createClient } from "redis";

/**
 * Heartbeat của process worker (P3-15): ghi `WORKER_HEARTBEAT_PREFIX + id` vào Redis, sống 30 s, làm mới mỗi 10 s.
 * Dừng gọn thì xóa key ngay; process chết thì key tự hết hạn. `prefix` chỉ test dùng.
 */
export async function startHeartbeat(options: {
  redisUrl: string;
  queues: QueueName[];
  prefix?: string;
  intervalMs?: number;
}): Promise<{ stop: () => Promise<void> }> {
  const client = createClient({ url: options.redisUrl });
  // Không có listener thì lỗi kết nối Redis làm sập process; client tự nối lại.
  client.on("error", () => undefined);
  await client.connect();
  const id = `${hostname()}-${process.pid}`;
  const key = `${options.prefix ?? WORKER_HEARTBEAT_PREFIX}${id}`;
  const startedAt = new Date().toISOString();
  const beat = async () => {
    const payload: WorkerHeartbeat = {
      id,
      queues: options.queues,
      startedAt,
      at: new Date().toISOString(),
    };
    await client.set(key, JSON.stringify(payload), { EX: WORKER_HEARTBEAT_TTL_SECONDS });
  };
  await beat();
  const timer = setInterval(() => {
    // Mất Redis một nhịp thì nhịp sau ghi lại; key chỉ hết hạn nếu mất quá 30 s.
    void beat().catch(() => undefined);
  }, options.intervalMs ?? WORKER_HEARTBEAT_INTERVAL_MS);
  return {
    stop: async () => {
      clearInterval(timer);
      await client.del(key).catch(() => undefined);
      await client.quit();
    },
  };
}
