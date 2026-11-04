import { randomUUID } from "node:crypto";
import { jobPayloadSchema } from "@studio/contracts";
import {
  agentRuns,
  createDbConnection,
  createProject,
  deleteProjectCascadeForTests,
  getJobById,
  insertBrief,
  jobs,
  workflowRuns,
} from "@studio/db";
import { Worker } from "bullmq";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  closeQueues,
  createQueues,
  EXHAUSTED_GRACE_MS,
  type QueueSet,
  reconcileQueues,
  redisConnectionFromUrl,
} from "./queues.js";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://studio:studio@localhost:5432/studio";
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
/** Prefix riêng: không đụng key `bull:*` của queue thật. */
const PREFIX = `studio-test-p3-01-${randomUUID()}`;

type Db = ReturnType<typeof createDbConnection>["db"];
type JobStatus = (typeof jobs.$inferSelect)["status"];
type QueueName = (typeof jobs.$inferSelect)["queue"];

let db: Db;
let closeDb: () => Promise<void>;
let projectId = "";
let agentRunId = "";
const connection = redisConnectionFromUrl(REDIS_URL);

async function seedJob(queue: QueueName, status: JobStatus): Promise<string> {
  const [row] = await db
    .insert(jobs)
    .values({ agentRunId, queue, status, idempotencyKey: `p3-01-test-${randomUUID()}` })
    .returning({ id: jobs.id });
  if (row === undefined) {
    throw new Error("seed job failed");
  }
  return row.id;
}

async function totalJobs(queues: QueueSet): Promise<number> {
  let total = 0;
  for (const queue of Object.values(queues)) {
    const counts = await queue.getJobCounts("waiting", "active", "delayed", "prioritized");
    total += Object.values(counts).reduce((sum, n) => sum + n, 0);
  }
  return total;
}

describe("redisConnectionFromUrl", () => {
  it("parses host, port, db and credentials", () => {
    expect(redisConnectionFromUrl("redis://localhost:6379")).toMatchObject({
      host: "localhost",
      port: 6379,
      db: 0,
      maxRetriesPerRequest: null,
    });
    expect(redisConnectionFromUrl("redis://u:p%40ss@cache:6380/2")).toMatchObject({
      host: "cache",
      port: 6380,
      db: 2,
      username: "u",
      password: "p@ss",
    });
    expect(() => redisConnectionFromUrl("http://localhost:6379")).toThrow();
  });
});

describe("queue reconcile (P3-01, Redis + Postgres Compose)", () => {
  beforeAll(async () => {
    const conn = createDbConnection(DATABASE_URL);
    db = conn.db;
    closeDb = conn.close;
    const project = await createProject(db, "P3-01 queue test");
    projectId = project.id;
    const brief = await insertBrief(db, projectId, {
      topic: "Redis",
      audience: "Dev",
      goal: "Queue",
      durationSec: 60,
      language: "vi",
      tone: "friendly",
      visualStyle: "edu",
    });
    const [run] = await db
      .insert(workflowRuns)
      .values({ projectId, briefId: brief.id, status: "researching" })
      .returning({ id: workflowRuns.id });
    const [agent] = await db
      .insert(agentRuns)
      .values({ workflowRunId: run?.id ?? "", role: "research", status: "queued" })
      .returning({ id: agentRuns.id });
    agentRunId = agent?.id ?? "";
  });

  afterAll(async () => {
    const cleanup = createQueues(connection, PREFIX);
    for (const queue of Object.values(cleanup)) {
      await queue.obliterate({ force: true });
    }
    await closeQueues(cleanup);
    await deleteProjectCascadeForTests(db, projectId);
    await closeDb();
  });

  it("enqueues queued/running rows once; deleted Redis job is re-enqueued exactly once on restart", async () => {
    const queuedId = await seedJob("llm", "queued");
    const runningId = await seedJob("media", "running");
    const completedId = await seedJob("render", "completed");
    const failedId = await seedJob("llm", "failed");
    const scope = { jobIds: [queuedId, runningId, completedId, failedId] };

    // Lần khởi động đầu.
    let queues = createQueues(connection, PREFIX);
    const first = await reconcileQueues(db, queues, scope);
    expect(first.checked).toBe(2);
    expect(first.enqueued.sort()).toEqual([queuedId, runningId].sort());
    expect(await totalJobs(queues)).toBe(2);

    const redisJob = await queues.llm.getJob(queuedId);
    expect(redisJob?.data).toEqual({ jobId: queuedId });
    expect(jobPayloadSchema.safeParse(redisJob?.data).success).toBe(true);
    expect(redisJob?.opts.attempts).toBe(2);
    expect((await getJobById(db, queuedId))?.bullmqJobId).toBe(queuedId);
    expect(await queues.render.getJob(completedId)).toBeUndefined();

    // Khởi động lại khi Redis vẫn còn job: không enqueue thêm.
    const second = await reconcileQueues(db, queues, scope);
    expect(second.enqueued).toEqual([]);
    expect(second.alreadyPresent.sort()).toEqual([queuedId, runningId].sort());
    expect(await totalJobs(queues)).toBe(2);

    // Xóa job Redis của hàng `queued`, rồi "khởi động" worker mới.
    await redisJob?.remove();
    expect(await queues.llm.getJob(queuedId)).toBeUndefined();
    await closeQueues(queues);
    queues = createQueues(connection, PREFIX);

    const afterLoss = await reconcileQueues(db, queues, scope);
    expect(afterLoss.enqueued).toEqual([queuedId]);
    expect((await queues.llm.getJobCounts("waiting")).waiting).toBe(1);
    expect(await totalJobs(queues)).toBe(2);

    // Thêm một lần khởi động và hai lần song song: vẫn đúng một job.
    const again = await reconcileQueues(db, queues, scope);
    expect(again.enqueued).toEqual([]);
    await Promise.all([reconcileQueues(db, queues, scope), reconcileQueues(db, queues, scope)]);
    expect((await queues.llm.getJobCounts("waiting")).waiting).toBe(1);
    expect(await totalJobs(queues)).toBe(2);

    // Trạng thái DB không bị đổi bởi reconcile.
    expect((await getJobById(db, queuedId))?.status).toBe("queued");
    expect((await getJobById(db, runningId))?.status).toBe("running");
    await closeQueues(queues);
  });

  it("BullMQ hết lượt lúc DB không ghi được: đối chiếu gọi onExhausted sau thời gian chờ, không đẩy lại", async () => {
    const [row] = await db
      .insert(jobs)
      .values({
        agentRunId,
        queue: "render",
        status: "running",
        maxAttempts: 1,
        idempotencyKey: `p3-01-test-${randomUUID()}`,
      })
      .returning({ id: jobs.id });
    const jobId = row?.id ?? "";
    const scope = { jobIds: [jobId] };
    const queues = createQueues(connection, PREFIX);
    expect((await reconcileQueues(db, queues, scope)).enqueued).toEqual([jobId]);

    // Worker hết lượt; handler `failed` không ghi được PostgreSQL nên hàng vẫn `running`.
    const worker = new Worker(
      "render",
      async () => {
        throw new Error("the database system is in recovery mode");
      },
      { connection, prefix: PREFIX },
    );
    await new Promise<void>((resolve) => worker.once("failed", () => resolve()));
    await worker.close();
    const finishedOn = (await queues.render.getJob(jobId))?.finishedOn ?? 0;
    expect(finishedOn).toBeGreaterThan(0);

    const calls: [string, string][] = [];
    const onExhausted = async (id: string, reason: string) => {
      calls.push([id, reason]);
      return true;
    };
    // Trong thời gian chờ: để handler của worker tự ghi.
    const early = await reconcileQueues(db, queues, scope, {
      onExhausted,
      now: () => finishedOn + EXHAUSTED_GRACE_MS - 1,
    });
    expect(early.alreadyPresent).toEqual([jobId]);
    expect(calls).toEqual([]);

    // onExhausted không ghi được (ví dụ DB vẫn lỗi): giữ nguyên, lần sau thử lại.
    const refused = await reconcileQueues(db, queues, scope, {
      onExhausted: async () => false,
      now: () => finishedOn + EXHAUSTED_GRACE_MS,
    });
    expect(refused.exhausted).toEqual([]);
    expect(refused.alreadyPresent).toEqual([jobId]);

    const late = await reconcileQueues(db, queues, scope, {
      onExhausted,
      now: () => finishedOn + EXHAUSTED_GRACE_MS,
    });
    expect(late.exhausted).toEqual([jobId]);
    expect(late.enqueued).toEqual([]);
    expect(calls).toEqual([[jobId, "the database system is in recovery mode"]]);
    // Không có onExhausted thì như trước: không đổi gì.
    expect((await reconcileQueues(db, queues, scope)).alreadyPresent).toEqual([jobId]);
    await closeQueues(queues);
  });

  it("payload contract only allows { jobId }", () => {
    expect(jobPayloadSchema.safeParse({ jobId: randomUUID() }).success).toBe(true);
    expect(jobPayloadSchema.safeParse({ jobId: randomUUID(), prompt: "x" }).success).toBe(false);
    expect(jobPayloadSchema.safeParse({ jobId: "1" }).success).toBe(false);
  });
});
