import type { WorkflowRunStatus } from "@studio/contracts";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { useWorkflowRun } from "@/features/script-review/use-script-review";
import { vi } from "@/i18n/vi";
import { ApiError } from "@/lib/api";
import { useCancelRun, useResumeRun } from "./use-run-control";

/** Trạng thái không hủy được nữa (04-AGENT-ORCHESTRATION: cancel từ mọi trạng thái trừ hai trạng thái này). */
const FINISHED: ReadonlySet<WorkflowRunStatus> = new Set(["exported", "cancelled"]);

/**
 * Trạng thái lượt chạy cùng nút hủy và chạy lại (P2-10, P7-06). Hủy mở hộp thoại xác nhận, focus mặc định ở
 * "Giữ lượt chạy". Chạy lại chỉ hiện khi run `failed` và có `resume_from`. Trạng thái luôn đọc từ server.
 */
export function RunControls({ runId }: { runId: string }) {
  const run = useWorkflowRun(runId);
  const cancel = useCancelRun(runId);
  const resume = useResumeRun(runId);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!run.isSuccess) {
    return null;
  }
  const { status, resumeFrom, failureCode } = run.data.workflowRun;
  const busy = cancel.isPending || resume.isPending;

  const onError = (cause: unknown) => {
    if (cause instanceof ApiError && cause.code === "invalid_transition") {
      setError(vi.runControl.stale);
    } else if (cause instanceof ApiError && cause.code === "conflict") {
      setError(vi.runControl.nothingToResume);
    } else {
      setError(vi.runControl.submitError);
    }
  };

  return (
    <section
      aria-label={vi.runControl.heading}
      className="bg-card flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 text-sm"
    >
      <p className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">{vi.runControl.status}:</span>
        <span data-testid="run-status" className="sr-only">
          {vi.runControl.statuses[status]}
        </span>
        <StatusBadge status={status} />
        {status === "failed" && resumeFrom !== null ? (
          <span className="text-muted-foreground">
            {`${vi.runControl.resumeFrom} ${(vi.runControl.statuses as Record<string, string>)[resumeFrom] ?? resumeFrom}`}
            {failureCode === null ? null : ` (${failureCode})`}
          </span>
        ) : null}
      </p>
      <span className="flex-1" />
      <div className="flex flex-wrap gap-2">
        {status === "failed" && resumeFrom !== null ? (
          <Button
            type="button"
            disabled={busy}
            onClick={() => {
              setError(null);
              resume.mutate(undefined, { onError });
            }}
          >
            {vi.runControl.resume}
          </Button>
        ) : null}
        {FINISHED.has(status) ? null : (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => setConfirming(true)}
          >
            {vi.runControl.cancel}
          </Button>
        )}
      </div>
      {error === null ? null : (
        <p role="alert" className="text-destructive w-full text-sm">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={confirming}
        title={vi.runControl.confirmTitle}
        confirmLabel={vi.runControl.confirmCancel}
        cancelLabel={vi.runControl.keepRunning}
        pending={cancel.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setError(null);
          cancel.mutate(undefined, { onError, onSettled: () => setConfirming(false) });
        }}
      >
        {vi.runControl.cancelHint}
      </ConfirmDialog>
    </section>
  );
}
