import { and, asc, eq, inArray } from "drizzle-orm";
import type { StudioDb } from "./db.js";
import { jobs } from "./schema/index.js";

export type JobRow = typeof jobs.$inferSelect;

/**
 * Job còn dở theo PostgreSQL (ADR-003, 02-SYSTEM-ARCHITECTURE mục khôi phục):
 * `queued` hoặc `running`. Worker đối chiếu với Redis lúc khởi động.
 */
export async function listUnfinishedJobs(db: StudioDb, scope?: { jobIds: string[] }) {
  const unfinished = inArray(jobs.status, ["queued", "running"]);
  if (scope !== undefined && scope.jobIds.length === 0) {
    return [];
  }
  return db
    .select({ id: jobs.id, queue: jobs.queue, status: jobs.status, maxAttempts: jobs.maxAttempts })
    .from(jobs)
    .where(scope === undefined ? unfinished : and(unfinished, inArray(jobs.id, scope.jobIds)))
    .orderBy(asc(jobs.createdAt));
}

export async function setJobBullmqId(db: StudioDb, jobId: string, bullmqJobId: string) {
  await db
    .update(jobs)
    .set({ bullmqJobId, updatedAt: new Date() })
    .where(eq(jobs.id, jobId));
}

export async function getJobById(db: StudioDb, jobId: string) {
  const [row] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  return row ?? null;
}
