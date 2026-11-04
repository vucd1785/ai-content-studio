import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import {
  type QueueName,
  WORKER_HEARTBEAT_PREFIX,
  type WorkerHeartbeat,
  workerHeartbeatSchema,
  workerStatusResponseSchema,
} from "@studio/contracts";
import type { FastifyInstance } from "fastify";
import { createClient } from "redis";

/** Đọc mọi heartbeat còn sống. Test thay bằng bản giả; mặc định đọc Redis của `REDIS_URL`. */
export type HeartbeatReader = () => Promise<WorkerHeartbeat[]>;

/** Reader Redis: kết nối một lần, quét key theo prefix, bỏ giá trị không đúng schema. */
export function redisHeartbeatReader(
  redisUrl: string,
  prefix = WORKER_HEARTBEAT_PREFIX,
): HeartbeatReader {
  let client: ReturnType<typeof createClient> | null = null;
  return async () => {
    if (client === null) {
      client = createClient({ url: redisUrl });
      // Không có listener thì lỗi kết nối Redis làm sập API; route trả alive false.
      client.on("error", () => undefined);
      await client.connect();
    }
    const beats: WorkerHeartbeat[] = [];
    for await (const keys of client.scanIterator({ MATCH: `${prefix}*`, COUNT: 100 })) {
      for (const key of keys) {
        const raw = await client.get(key);
        const parsed = raw === null ? null : workerHeartbeatSchema.safeParse(JSON.parse(raw));
        if (parsed?.success) {
          beats.push(parsed.data);
        }
      }
    }
    return beats;
  };
}

/**
 * `GET /api/worker-status` (P3-15): worker có đang chạy không và chạy queue nào. Chỉ đọc; không trả id process
 * hay địa chỉ Redis. Không đọc được Redis thì coi như worker không chạy.
 */
export function registerWorkerStatusRoute(
  app: FastifyInstance,
  deps: { readHeartbeats: HeartbeatReader },
): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      "/api/worker-status",
      { schema: { response: { 200: workerStatusResponseSchema } } },
      async () => {
        const beats = await deps.readHeartbeats().catch(() => []);
        const queues = [...new Set(beats.flatMap((beat) => beat.queues))].sort() as QueueName[];
        const lastSeenAt =
          beats
            .map((beat) => beat.at)
            .sort()
            .at(-1) ?? null;
        return { alive: beats.length > 0, queues, lastSeenAt };
      },
    );
}
