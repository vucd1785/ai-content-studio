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
