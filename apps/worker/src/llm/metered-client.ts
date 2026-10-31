import { countUsageRecordsForRun, insertUsageRecord, type StudioDb } from "@studio/db";
import type { StructuredGenerateClient } from "./structured-output.js";
import type { LlmUsage } from "./types.js";

/**
 * Đếm và chặn số lần gọi LLM của một run (P3-09, docs/04-AGENT-ORCHESTRATION.md mục Trần gọi LLM):
 * 6 lần cho một vòng tới export, cộng 2 cho mỗi lượt Director yêu cầu sửa.
 * Kiểm trần TRƯỚC khi gọi provider; mỗi response ghi đúng một hàng `usage_records`, kể cả lần repair.
 */
export const LLM_CALL_CEILING = { base: 6, perChangesRequested: 2 } as const;

export function llmCallCeiling(changesRequested: number): number {
  return LLM_CALL_CEILING.base + LLM_CALL_CEILING.perChangesRequested * changesRequested;
}

export class CostCeilingError extends Error {
  readonly code = "cost_ceiling";

  constructor(
    readonly used: number,
    readonly ceiling: number,
  ) {
    super(`LLM call ceiling reached: ${used}/${ceiling}`);
    this.name = "CostCeilingError";
  }
}

/** Nơi lưu số lần gọi. Bản DB dùng `usage_records`; test dùng bộ nhớ. */
export type UsageStore = {
  countCalls(): Promise<number>;
  record(usage: LlmUsage): Promise<void>;
};

export function dbUsageStore(
  db: StudioDb,
  scope: { workflowRunId: string; agentRunId: string },
): UsageStore {
  return {
    countCalls: () => countUsageRecordsForRun(db, scope.workflowRunId),
    async record(usage) {
      await insertUsageRecord(db, {
        workflowRunId: scope.workflowRunId,
        agentRunId: scope.agentRunId,
        provider: usage.provider,
        model: usage.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        thinkingTokens: usage.thinkingTokens,
      });
    },
  };
}

/**
 * Bọc client: hết trần thì ném `CostCeilingError` và không gọi `inner`.
 * Provider lỗi (không có response, không có token) thì không ghi hàng.
 * Concurrency của queue `llm` là 1 (04-AGENT-ORCHESTRATION), nên đếm rồi ghi không bị chạy đua.
 */
export function createMeteredClient(
  inner: StructuredGenerateClient,
  options: { ceiling: number; store: UsageStore },
): StructuredGenerateClient {
  return {
    async generateStructured(request) {
      const used = await options.store.countCalls();
      if (used >= options.ceiling) {
        throw new CostCeilingError(used, options.ceiling);
      }
      const response = await inner.generateStructured(request);
      await options.store.record(response.usage);
      return response;
    },
  };
}
