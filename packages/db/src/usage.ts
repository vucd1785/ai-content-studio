import { and, asc, count, eq, gte, isNull, lt, ne, or, sum } from "drizzle-orm";
import type { StudioDb } from "./db.js";
import { agentRuns, approvals, usageRecords } from "./schema/index.js";

/**
 * `usage_records` (P3-09, docs/03-DATABASE-DESIGN.md). Mỗi lần gọi LLM có response là một hàng.
 * `estimated_cost_usd` ghi `0` cho tới khi có bảng giá đã cấu hình: không hard-code đơn giá.
 */

export type NewUsageRecord = {
  workflowRunId: string;
  agentRunId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
};

export async function insertUsageRecord(db: StudioDb, record: NewUsageRecord) {
  const [row] = await db.insert(usageRecords).values(record).returning();
  if (row === undefined) {
    throw new Error("insert_usage_record_failed");
  }
  return row;
}

/** Số lần gọi LLM đã ghi cho run: dùng để chặn trần trước khi gọi provider. */
/**
 * Số lần gọi LLM tính vào trần của run (P3-09). Lần gọi tạo tài sản của vai `visual` (ADR-017) có trần riêng
 * (3 tài sản, 2 lần thử) nên không tính, để tạo tài sản không chặn lượt viết lại kịch bản.
 */
export async function countUsageRecordsForRun(
  db: StudioDb,
  workflowRunId: string,
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(usageRecords)
    .leftJoin(agentRuns, eq(agentRuns.id, usageRecords.agentRunId))
    .where(
      and(
        eq(usageRecords.workflowRunId, workflowRunId),
        or(isNull(agentRuns.role), ne(agentRuns.role, "visual")),
      ),
    );
  return row?.value ?? 0;
}

export async function listUsageRecordsForRun(db: StudioDb, workflowRunId: string) {
  const rows = await db
    .select()
    .from(usageRecords)
    .where(eq(usageRecords.workflowRunId, workflowRunId))
    .orderBy(asc(usageRecords.createdAt), asc(usageRecords.id));
  return rows.map((row) => ({
    id: row.id,
    workflowRunId: row.workflowRunId,
    agentRunId: row.agentRunId,
    provider: row.provider,
    model: row.model,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    thinkingTokens: row.thinkingTokens,
    estimatedCostUsd: row.estimatedCostUsd,
    createdAt: row.createdAt.toISOString(),
  }));
}

/**
 * Tổng `usage_records` trong khoảng `[from, to)` (P5-04): cho ô "token tháng này" trên trang dự án.
 * Chỉ cộng số đã lưu; không tính tiền.
 */
export async function sumUsageBetween(db: StudioDb, from: Date, to: Date) {
  const [row] = await db
    .select({
      calls: count(),
      inputTokens: sum(usageRecords.inputTokens),
      outputTokens: sum(usageRecords.outputTokens),
      thinkingTokens: sum(usageRecords.thinkingTokens),
    })
    .from(usageRecords)
    .where(and(gte(usageRecords.createdAt, from), lt(usageRecords.createdAt, to)));
  return {
    calls: row?.calls ?? 0,
    inputTokens: Number(row?.inputTokens ?? 0),
    outputTokens: Number(row?.outputTokens ?? 0),
    thinkingTokens: Number(row?.thinkingTokens ?? 0),
  };
}

/** Số lượt Director yêu cầu sửa: mỗi lượt cộng thêm trần gọi LLM (04-AGENT-ORCHESTRATION). */
export async function countChangesRequested(db: StudioDb, workflowRunId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(approvals)
    .where(
      and(eq(approvals.workflowRunId, workflowRunId), eq(approvals.decision, "changes_requested")),
    );
  return row?.value ?? 0;
}
