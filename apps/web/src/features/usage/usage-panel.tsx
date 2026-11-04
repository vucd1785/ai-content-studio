import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { vi } from "@/i18n/vi";
import { sumUsage } from "./usage-totals";
import { useRunUsage } from "./use-usage";

const numberFormat = new Intl.NumberFormat("vi-VN");

/**
 * Màn usage (P5-02): tổng token và chi phí ước tính của lượt chạy mới nhất của project,
 * đọc nguyên số đã lưu trong `usage_records`. Không có đơn giá trong component.
 */
export function UsagePanel({ runId }: { runId: string | null }) {
  const usage = useRunUsage(runId);

  let body: React.ReactNode;
  if (runId === null) {
    body = <p className="text-muted-foreground text-sm">{vi.usage.noRun}</p>;
  } else if (usage.isPending) {
    body = <p className="text-muted-foreground text-sm">{vi.app.loading}</p>;
  } else if (usage.isError) {
    body = <p className="text-destructive text-sm">{vi.usage.error}</p>;
  } else if (usage.data.usageRecords.length === 0) {
    body = <p className="text-muted-foreground text-sm">{vi.usage.empty}</p>;
  } else {
    const records = usage.data.usageRecords;
    const totals = sumUsage(records);
    const stats: [string, string][] = [
      [vi.usage.calls, numberFormat.format(totals.calls)],
      [vi.usage.inputTokens, numberFormat.format(totals.inputTokens)],
      [vi.usage.outputTokens, numberFormat.format(totals.outputTokens)],
      [vi.usage.thinkingTokens, numberFormat.format(totals.thinkingTokens)],
      [vi.usage.estimatedCost, totals.estimatedCostUsd],
    ];
    body = (
      <div className="flex flex-col gap-3">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {stats.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right tabular-nums" data-testid={`usage-${label}`}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-muted-foreground text-xs">{vi.usage.estimateNote}</p>
        <table className="w-full text-xs">
          <caption className="sr-only">{vi.usage.rowsCaption}</caption>
          <thead>
            <tr className="text-muted-foreground text-left">
              <th className="font-normal">{vi.usage.model}</th>
              <th className="text-right font-normal">{vi.usage.inputTokens}</th>
              <th className="text-right font-normal">{vi.usage.outputTokens}</th>
              <th className="text-right font-normal">{vi.usage.estimatedCost}</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                <td>{record.model}</td>
                <td className="text-right tabular-nums">
                  {numberFormat.format(record.inputTokens)}
                </td>
                <td className="text-right tabular-nums">
                  {numberFormat.format(record.outputTokens)}
                </td>
                <td className="text-right tabular-nums">{record.estimatedCostUsd}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-sm">{vi.usage.heading}</CardTitle>
      </CardHeader>
      <CardContent className="px-4">{body}</CardContent>
    </Card>
  );
}
