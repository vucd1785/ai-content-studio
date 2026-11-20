import { workerStatusResponseSchema } from "@studio/contracts";
import { useQuery } from "@tanstack/react-query";
import { useWorkflowRun } from "@/features/script-review/use-script-review";
import { vi } from "@/i18n/vi";
import { apiRequest } from "@/lib/api";
import { runTone } from "./run-status";

/**
 * Phân biệt ba loại sự cố ở màn Đang chạy (P7-06): lỗi của bước (hộp lỗi của thanh tiến trình), mất kết nối tới
 * máy chủ (giữ dữ liệu cũ, ghi giờ cập nhật cuối, không đoán run lỗi) và worker đã tắt.
 */
export function RunHealthNotice({ runId }: { runId: string }) {
  const run = useWorkflowRun(runId);
  const worker = useQuery({
    queryKey: ["worker-status"] as const,
    queryFn: () => apiRequest("/api/worker-status", { schema: workerStatusResponseSchema }),
    refetchInterval: 10_000,
  });
  const status = run.data?.workflowRun.status ?? null;
  const lost = run.isError && run.data !== undefined;
  const workerDown = worker.isSuccess && !worker.data.alive && runTone(status) === "working";
  if (!lost && !workerDown) {
    return null;
  }
  return (
    <div className="flex flex-col gap-3">
      {lost ? (
        <div
          role="status"
          className="border-warning/50 bg-warning-bg text-warning flex items-center gap-4 rounded-2xl border px-4 py-3 text-sm"
        >
          <img
            src="/assets/illustrations/no_connection.svg"
            alt=""
            className="hidden h-14 sm:block"
          />
          <span className="flex flex-col gap-0.5">
            <span className="font-semibold">
              {vi.runSteps.connectionLost} {new Date(run.dataUpdatedAt).toLocaleTimeString("vi-VN")}
            </span>
            <span>{vi.runSteps.connectionLostHint}</span>
          </span>
        </div>
      ) : null}
      {workerDown ? (
        <div
          role="status"
          className="border-warning/50 bg-warning-bg text-warning flex items-center gap-4 rounded-2xl border px-4 py-3 text-sm"
        >
          <img
            src="/assets/illustrations/worker_offline.svg"
            alt=""
            className="hidden h-14 sm:block"
          />
          <span className="flex flex-col gap-0.5">
            <span className="font-semibold">{vi.runSteps.workerOffline}</span>
            <span>{vi.runSteps.workerOfflineHint}</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}
