import { usageSummaryResponseSchema } from "@studio/contracts";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { currentMonthRange } from "@/features/home/home-page";
import { useProjects } from "@/features/projects/use-projects";
import { vi } from "@/i18n/vi";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";
import { UsagePanel } from "./usage-panel";

const numberFormat = new Intl.NumberFormat("vi-VN");

/** Tháng `offset` so với tháng hiện tại, theo giờ máy của Director. */
function monthRange(offset: number): { from: string; to: string; label: string } {
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth() + offset, 15);
  const range = currentMonthRange(base);
  return { ...range, label: `${base.getMonth() + 1}/${base.getFullYear()}` };
}

/**
 * Trang "Sử dụng LLM" (P7-09): tổng theo tháng từ `/api/usage/summary`, chi tiết từng lần gọi theo lượt chạy mới
 * nhất của một dự án. Chi phí USD chỉ là số ước tính đã lưu; tổng tháng chưa có giá nên ghi rõ chưa đủ dữ liệu.
 */
export function UsagePage() {
  const [offset, setOffset] = useState(0);
  const range = monthRange(offset);
  const summary = useQuery({
    queryKey: ["usage-summary", range.from] as const,
    queryFn: () =>
      apiRequest(
        `/api/usage/summary?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
        { schema: usageSummaryResponseSchema },
      ),
  });
  const projects = useProjects();
  const withRun = (projects.data?.projects ?? []).filter((p) => p.latestRun !== null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const chosen = withRun.find((p) => p.id === projectId) ?? withRun[0] ?? null;

  const tiles: [string, string][] =
    summary.data === undefined
      ? []
      : [
          [vi.usage.calls, numberFormat.format(summary.data.calls)],
          [vi.usage.inputTokens, numberFormat.format(summary.data.inputTokens)],
          [vi.usage.outputTokens, numberFormat.format(summary.data.outputTokens)],
          [vi.usage.thinkingTokens, numberFormat.format(summary.data.thinkingTokens)],
          [vi.usage.estimatedCost, vi.usage.noCostData],
        ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-2xl font-semibold">{vi.usage.heading}</h1>
        <fieldset className="bg-muted flex items-center gap-0.5 rounded-lg p-0.5">
          <legend className="sr-only">{vi.usage.monthLabel}</legend>
          {[0, -1].map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={offset === value}
              onClick={() => setOffset(value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-semibold",
                offset === value ? "bg-card shadow-xs" : "text-muted-foreground",
              )}
            >
              {value === 0 ? vi.usage.thisMonth : vi.usage.lastMonth}
            </button>
          ))}
        </fieldset>
      </div>
      <section aria-label={`${vi.usage.monthLabel} ${range.label}`} className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">
          {vi.usage.monthLabel} {range.label}
        </h2>
        {summary.isError ? (
          <p className="text-destructive text-sm">{vi.usage.error}</p>
        ) : summary.isPending ? (
          <p className="text-muted-foreground text-sm">{vi.app.loading}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {tiles.map(([label, value]) => (
              <div key={label} className="bg-card flex flex-col gap-1 rounded-2xl border p-4">
                <span className="text-muted-foreground text-sm">{label}</span>
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    value === vi.usage.noCostData ? "text-muted-foreground text-sm" : "text-xl",
                  )}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="text-muted-foreground text-xs">{vi.usage.estimateNote}</p>
      </section>
      <section aria-label={vi.usage.byRun} className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <h2 className="flex-1 text-lg font-semibold">{vi.usage.byRun}</h2>
          {withRun.length > 0 ? (
            <div className="flex flex-col gap-1">
              <Label htmlFor="usage-project">{vi.usage.projectFilter}</Label>
              <select
                id="usage-project"
                className="bg-card border-input h-10 rounded-lg border px-2 text-sm"
                value={chosen?.id ?? ""}
                onChange={(event) => setProjectId(event.target.value)}
              >
                {withRun.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
        <UsagePanel runId={chosen?.latestRun?.id ?? null} />
      </section>
    </div>
  );
}
