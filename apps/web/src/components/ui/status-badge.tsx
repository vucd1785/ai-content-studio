import { runStatusLabel, runTone } from "@/features/run/run-status";
import { cn } from "@/lib/utils";

/** Nền và chữ theo tone; luôn có chữ trạng thái, chấm màu chỉ bổ sung (WCAG: không chỉ dùng màu). */
const TONE_BADGE = {
  waiting: "bg-warning-bg text-warning",
  working: "bg-info-bg text-info",
  done: "bg-success-bg text-success",
  failed: "bg-destructive-bg text-destructive",
  idle: "bg-muted text-muted-foreground",
} as const;

const TONE_ICON = { waiting: "⏸", working: "●", done: "✓", failed: "!", idle: "○" } as const;

/** Huy hiệu trạng thái lượt chạy (P7-04): 14 trạng thái của server, nhãn từ từ điển `vi`. */
export function StatusBadge({ status, className }: { status: string | null; className?: string }) {
  const tone = runTone(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        TONE_BADGE[tone],
        className,
      )}
    >
      <span aria-hidden="true">{TONE_ICON[tone]}</span>
      {runStatusLabel(status)}
    </span>
  );
}
