import { workerStatusResponseSchema } from "@studio/contracts";
import { useQuery } from "@tanstack/react-query";
import { vi } from "@/i18n/vi";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Chấm trạng thái worker trên thanh trên (P3-15). Đọc lại mỗi 10 s, khớp chu kỳ heartbeat. */
export function WorkerStatusPill() {
  const status = useQuery({
    queryKey: ["worker-status"] as const,
    queryFn: () => apiRequest("/api/worker-status", { schema: workerStatusResponseSchema }),
    refetchInterval: 10_000,
  });
  const alive = status.data?.alive === true;
  return (
    <span
      role="status"
      data-testid="worker-status"
      className={cn(
        "flex items-center gap-2 rounded-full border px-3 py-1 text-xs",
        alive
          ? "border-success/40 bg-success/10 text-success"
          : "border-border text-muted-foreground",
      )}
    >
      <span
        className={cn("size-2 rounded-full", alive ? "bg-success" : "bg-muted-foreground")}
        aria-hidden="true"
      />
      {alive ? `${vi.worker.running} · ${status.data?.queues.join(", ")}` : vi.worker.stopped}
    </span>
  );
}
