import { type JobPayload, QUEUE_NAMES, type QueueName } from "@studio/contracts";
import { listUnfinishedJobs, type StudioDb, setJobBullmqId } from "@studio/db";
import { type ConnectionOptions, Queue } from "bullmq";

export type QueueSet = Record<QueueName, Queue<JobPayload>>;

/** Chuyển `REDIS_URL` (redis://[user:pass@]host:port[/db]) thành option BullMQ. Không log URL. */
export function redisConnectionFromUrl(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);
  if (url.protocol !== "redis:" && url.protocol !== "rediss:") {
    throw new Error("REDIS_URL must use redis:// or rediss://");
  }
  const dbIndex = url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0;
  return {
    host: url.hostname,
    port: url.port === "" ? 6379 : Number(url.port),
    ...(url.username !== "" ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password !== "" ? { password: decodeURIComponent(url.password) } : {}),
    db: Number.isInteger(dbIndex) ? dbIndex : 0,
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  };
}

/** `prefix` tách key Redis (test dùng prefix riêng để không đụng queue thật). */
export function createQueues(connection: ConnectionOptions, prefix?: string): QueueSet {
  const options = prefix === undefined ? { connection } : { connection, prefix };
  const entries = QUEUE_NAMES.map((name) => [name, new Queue<JobPayload>(name, options)] as const);
  return Object.fromEntries(entries) as QueueSet;
}

export async function closeQueues(queues: QueueSet): Promise<void> {
  await Promise.all(Object.values(queues).map((queue) => queue.close()));
}

/**
 * BullMQ job id = `jobs.id`. BullMQ không thêm job trùng id khi job đó còn trong Redis,
 * nên enqueue và đối chiếu đều idempotent.
 */
export async function enqueueJob(
  queues: QueueSet,
  job: { id: string; queue: QueueName; maxAttempts: number },
): Promise<string> {
  const added = await queues[job.queue].add(
    job.queue,
    { jobId: job.id },
    { jobId: job.id, attempts: job.maxAttempts },
  );
  if (added.id === undefined) {
    throw new Error("bullmq did not return a job id");
  }
  return added.id;
}

export type ReconcileResult = {
  checked: number;
  enqueued: string[];
  alreadyPresent: string[];
  /** Job Redis đã kết thúc nhưng PostgreSQL đưa về hàng đợi sau đó (resume): xóa bản cũ và đẩy lại. */
  requeued: string[];
};

/**
 * Lúc worker khởi động và theo chu kỳ: mọi hàng `jobs` còn `queued`/`running` mà Redis không có job cùng id
 * thì enqueue lại đúng một lần (ADR-003). Không đổi `jobs.status`.
 *
 * Resume (P3-08) đưa job đã kết thúc về `queued` mà giữ id, trong khi BullMQ vẫn giữ bản completed/failed cùng id
 * và không nhận thêm job trùng id. Nên: bản Redis đã kết thúc trước lần cập nhật cuối của hàng PostgreSQL thì
 * xóa và đẩy lại. Job bị bỏ qua (không đổi hàng DB) không bị đẩy lại lặp vô hạn.
 */
export async function reconcileQueues(
  db: StudioDb,
  queues: QueueSet,
  /** Chỉ test truyền: giới hạn vào hàng test tạo để không ghi `bullmq_job_id` của dữ liệu thật. */
  scope?: { jobIds: string[] },
): Promise<ReconcileResult> {
  const rows = await listUnfinishedJobs(db, scope);
  const result: ReconcileResult = {
    checked: rows.length,
    enqueued: [],
    alreadyPresent: [],
    requeued: [],
  };
  for (const row of rows) {
    const existing = await queues[row.queue].getJob(row.id);
    if (existing !== undefined) {
      const finishedOn = existing.finishedOn;
      const stale =
        finishedOn !== undefined &&
        row.updatedAt.getTime() > finishedOn &&
        ((await existing.isCompleted()) || (await existing.isFailed()));
      if (!stale) {
        result.alreadyPresent.push(row.id);
        continue;
      }
      await existing.remove();
      result.requeued.push(row.id);
    }
    const bullmqJobId = await enqueueJob(queues, row);
    await setJobBullmqId(db, row.id, bullmqJobId);
    result.enqueued.push(row.id);
  }
  return result;
}
