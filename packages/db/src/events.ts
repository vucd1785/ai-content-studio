import { and, asc, eq, gt, inArray } from "drizzle-orm";
import type { StudioDb } from "./db.js";
import { events, workflowRuns } from "./schema/index.js";
import type { StudioTx } from "./workflow.js";

export type EventInsert = typeof events.$inferInsert;
export type EventRow = typeof events.$inferSelect;

/**
 * Publisher duy nhất cho `events` (P3-07). Gọi bên trong transaction của người ghi.
 *
 * Khóa hàng `workflow_runs` liên quan bằng `FOR NO KEY UPDATE` trước khi insert: hai người ghi
 * cùng run phải chờ nhau, nên thứ tự commit trùng thứ tự `id`. Nhờ vậy SSE đọc `id > afterId`
 * không bỏ sót hàng commit muộn với `id` nhỏ hơn. Khóa này không chặn insert có khóa ngoại
 * tới run (FK chỉ cần `FOR KEY SHARE`).
 */
export async function publishEvents(tx: StudioTx, rows: EventInsert[]): Promise<EventRow[]> {
  if (rows.length === 0) {
    return [];
  }
  const runIds = [...new Set(rows.map((row) => row.workflowRunId))].sort();
  await tx
    .select({ id: workflowRuns.id })
    .from(workflowRuns)
    .where(inArray(workflowRuns.id, runIds))
    .orderBy(asc(workflowRuns.id))
    .for("no key update");
  return tx.insert(events).values(rows).returning();
}

/** Transaction riêng chỉ để ghi event (job ghi tiến độ, test). */
export async function appendEvents(db: StudioDb, rows: EventInsert[]): Promise<EventRow[]> {
  return db.transaction((tx) => publishEvents(tx, rows));
}

/** Hàng đã commit của một run có `id > afterId`, tăng dần. */
export async function listEventsAfter(
  db: StudioDb,
  workflowRunId: string,
  afterId: bigint,
  limit = 500,
): Promise<EventRow[]> {
  return db
    .select()
    .from(events)
    .where(and(eq(events.workflowRunId, workflowRunId), gt(events.id, afterId)))
    .orderBy(asc(events.id))
    .limit(limit);
}

export async function workflowRunExists(db: StudioDb, workflowRunId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: workflowRuns.id })
    .from(workflowRuns)
    .where(eq(workflowRuns.id, workflowRunId))
    .limit(1);
  return row !== undefined;
}
