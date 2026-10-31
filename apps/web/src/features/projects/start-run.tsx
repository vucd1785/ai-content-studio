import { type WorkflowRunStatus, workflowRunControlResponseSchema } from "@studio/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { vi } from "@/i18n/vi";
import { ApiError, apiRequest } from "@/lib/api";
import { projectsQueryKey } from "./use-projects";

/** Run ở các trạng thái này đã dừng: được bắt đầu run mới (khớp `startWorkflowRun` ở server). */
const STOPPED: ReadonlySet<string> = new Set<WorkflowRunStatus>([
  "exported",
  "cancelled",
  "failed",
]);

/**
 * Bắt đầu lượt chạy từ brief mới nhất (quyết định 5). Server tạo run cùng job research; worker queue `llm`
 * nhận job và gọi Gemini. Chỉ hiện khi đã có brief và lượt chạy mới nhất đã dừng.
 */
export function StartRunButton({
  projectId,
  hasBrief,
  latestStatus,
}: {
  projectId: string;
  hasBrief: boolean;
  /** `status` của run mới nhất trong chi tiết project (chuỗi, null khi chưa có run). */
  latestStatus: string | null;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const start = useMutation({
    mutationFn: () =>
      apiRequest(`/api/projects/${encodeURIComponent(projectId)}/workflow-runs`, {
        method: "POST",
        schema: workflowRunControlResponseSchema,
      }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: projectsQueryKey }),
  });
  if (!hasBrief || (latestStatus !== null && !STOPPED.has(latestStatus))) {
    return null;
  }
  return (
    <div className="flex flex-col gap-1">
      <div>
        <Button
          type="button"
          disabled={start.isPending}
          onClick={() => {
            setError(null);
            start.mutate(undefined, {
              onError: (cause) =>
                setError(
                  cause instanceof ApiError && cause.code === "conflict"
                    ? vi.startRun.conflict
                    : vi.startRun.error,
                ),
            });
          }}
        >
          {latestStatus === null ? vi.startRun.start : vi.startRun.startNew}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">{vi.startRun.hint}</p>
      {error === null ? null : (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
