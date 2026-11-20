import type { UsageRecord } from "@studio/contracts";

/** `estimated_cost_usd` là `numeric(12,6)`: cộng theo micro-USD bằng bigint để không lệch số thực. */
const COST_SCALE = 6;

function toMicros(value: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d{0,6}))?$/.exec(value.trim());
  if (match === null) {
    return 0n;
  }
  const [, sign, whole = "0", fraction = ""] = match;
  const micros =
    BigInt(whole) * 10n ** BigInt(COST_SCALE) + BigInt(fraction.padEnd(COST_SCALE, "0"));
  return sign === "-" ? -micros : micros;
}

function fromMicros(micros: bigint): string {
  const negative = micros < 0n;
  const abs = negative ? -micros : micros;
  const scale = 10n ** BigInt(COST_SCALE);
  const fraction = (abs % scale).toString().padStart(COST_SCALE, "0");
  return `${negative ? "-" : ""}${abs / scale}.${fraction}`;
}

export type UsageTotals = {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  /** Tổng chuỗi đã lưu, 6 chữ số thập phân. Không nhân đơn giá ở client. */
  estimatedCostUsd: string;
};

export function sumUsage(records: readonly UsageRecord[]): UsageTotals {
  let cost = 0n;
  const totals = { calls: records.length, inputTokens: 0, outputTokens: 0, thinkingTokens: 0 };
  for (const record of records) {
    totals.inputTokens += record.inputTokens;
    totals.outputTokens += record.outputTokens;
    totals.thinkingTokens += record.thinkingTokens;
    cost += toMicros(record.estimatedCostUsd);
  }
  return { ...totals, estimatedCostUsd: fromMicros(cost) };
}

/**
 * Chi phí ước tính để hiển thị (ADR-020): chuỗi micro-USD như "0.000000" khó đọc. 0 là "0 USD", dưới một xu là
 * "< 0,01 USD", còn lại hai chữ số thập phân theo vi-VN. Chuỗi lạ giữ nguyên.
 */
export function formatUsd(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return value;
  }
  if (n === 0) {
    return "0 USD";
  }
  if (n < 0.01) {
    return "< 0,01 USD";
  }
  return `${n.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
}
