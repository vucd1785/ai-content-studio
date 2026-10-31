import type { WorkflowRunStatus } from "@studio/contracts";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useWorkflowRun } from "@/features/script-review/use-script-review";
import { vi } from "@/i18n/vi";
import { ApiError } from "@/lib/api";
import { useCancelRun, useResumeRun } from "./use-run-control";

/** Trạng thái không hủy được nữa (04-AGENT-ORCHESTRATION: cancel từ mọi trạng thái trừ hai trạng thái này). */
const FINISHED: ReadonlySet<WorkflowRunStatus> = new Set(["exported", "cancelled"]);

/**
 * Trạng thái lượt chạy cùng nút hủy và resume (P2-10). Hủy cần bấm xác nhận lần hai vì không đảo ngược được.
 * Resume chỉ hiện khi run `failed` và có `resume_from`. Trạng thái hiển thị luôn đọc từ server.
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
      className="flex flex-col gap-2 rounded-md border p-3 text-sm"
    >
      <p>
        <span className="text-muted-foreground">{vi.runControl.status}: </span>
        <span data-testid="run-status" className="font-medium">
          {vi.runControl.statuses[status]}
        </span>
        {status === "failed" && resumeFrom !== null ? (
          <span className="text-muted-foreground">
            {` · ${vi.runControl.resumeFrom} ${(vi.runControl.statuses as Record<string, string>)[resumeFrom] ?? resumeFrom}`}
            {failureCode === null ? null : ` (${failureCode})`}
          </span>
        ) : null}
      </p>
      {error === null ? null : (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {status === "failed" && resumeFrom !== null ? (
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => {
              setError(null);
              resume.mutate(undefined, { onError });
            }}
          >
            {vi.runControl.resume}
          </Button>
        ) : null}
        {FINISHED.has(status) ? null : confirming ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setError(null);
                cancel.mutate(undefined, { onError, onSettled: () => setConfirming(false) });
              }}
            >
              {vi.runControl.confirmCancel}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              {vi.runControl.keepRunning}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => setConfirming(true)}
          >
            {vi.runControl.cancel}
          </Button>
        )}
      </div>
      {confirming ? (
        <p className="text-muted-foreground text-xs">{vi.runControl.cancelHint}</p>
      ) : null}
    </section>
  );
}
