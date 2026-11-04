import { z } from "zod/v4";

/** Ba queue BullMQ (docs/02-SYSTEM-ARCHITECTURE.md, enum `job_queue`). */
export const QUEUE_NAMES = ["llm", "media", "render"] as const;

export const queueNameSchema = z.enum(QUEUE_NAMES);

export type QueueName = z.infer<typeof queueNameSchema>;

/** Payload Redis chỉ chứa id; worker đọc phần còn lại từ PostgreSQL (ADR-003). */
export const jobPayloadSchema = z.strictObject({
  jobId: z.uuid(),
});

export type JobPayload = z.infer<typeof jobPayloadSchema>;

/**
 * Heartbeat của process worker (P3-15). Worker ghi key `WORKER_HEARTBEAT_PREFIX + id` trong Redis, sống
 * `WORKER_HEARTBEAT_TTL_SECONDS`, làm mới mỗi `WORKER_HEARTBEAT_INTERVAL_MS`. Hết key là worker đã tắt.
 */
export const WORKER_HEARTBEAT_PREFIX = "studio:worker:";
export const WORKER_HEARTBEAT_TTL_SECONDS = 30;
export const WORKER_HEARTBEAT_INTERVAL_MS = 10_000;

export const workerHeartbeatSchema = z.object({
  id: z.string().min(1).max(200),
  queues: z.array(queueNameSchema).min(1),
  startedAt: z.iso.datetime(),
  at: z.iso.datetime(),
});

export type WorkerHeartbeat = z.infer<typeof workerHeartbeatSchema>;

/** `GET /api/worker-status` (P3-15). Không trả id process hay địa chỉ Redis. */
export const workerStatusResponseSchema = z.object({
  alive: z.boolean(),
  queues: z.array(queueNameSchema),
  lastSeenAt: z.string().nullable(),
});
