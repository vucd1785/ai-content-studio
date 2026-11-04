import {
  llmModelsResponseSchema,
  type WorkflowRunStatus,
  workflowRunControlResponseSchema,
} from "@studio/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatDurationRange, totalMachineEstimate } from "@/features/run/run-steps";
import { vi } from "@/i18n/vi";
import { ApiError, apiRequest } from "@/lib/api";
import { projectsQueryKey } from "./use-projects";

/** Run ở các trạng thái này đã dừng: được bắt đầu run mới (khớp `startWorkflowRun` ở server). */
const STOPPED: ReadonlySet<string> = new Set<WorkflowRunStatus>([
  "exported",
  "cancelled",
  "failed",
]);

/** Tên hiển thị: model `claude-code…` (ADR-007, bổ sung 2026-11-02) ghi rõ là Claude Code. */
export function modelLabel(name: string): string {
  if (name === "claude-code") {
    return vi.startRun.claudeCodeDefault;
  }
  return name.startsWith("claude-code:")
    ? `${vi.startRun.claudeCodeAlias} ${name.slice("claude-code:".length)}`
    : name;
}

/** Model chọn được khi bắt đầu run (P3-12): danh sách từ cấu hình server, không điền sẵn trong web. */
function useLlmModels() {
  return useQuery({
    queryKey: ["llm-models"] as const,
    queryFn: () => apiRequest("/api/llm-models", { schema: llmModelsResponseSchema }),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/**
 * Bắt đầu lượt chạy từ brief mới nhất (quyết định 5, P3-12). Chọn model (Gemini hoặc Claude Code) cho cả lượt chạy và xem ước tính
 * thời gian máy chạy trước khi bấm. Chỉ hiện khi đã có brief và lượt chạy mới nhất đã dừng.
 */
export function StartRunButton({
  projectId,
  hasBrief,
  latestStatus,
  durationSec,
}: {
  projectId: string;
  hasBrief: boolean;
  /** `status` của run mới nhất trong chi tiết project (chuỗi, null khi chưa có run). */
  latestStatus: string | null;
  /** Thời lượng mục tiêu trong brief, dùng để ước tính. */
  durationSec: number | null;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const models = useLlmModels();
  const start = useMutation({
    mutationFn: (llmModel: string | null) =>
      apiRequest(`/api/projects/${encodeURIComponent(projectId)}/workflow-runs`, {
        method: "POST",
        ...(llmModel === null ? {} : { body: { llmModel } }),
        schema: workflowRunControlResponseSchema,
      }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: projectsQueryKey }),
  });
  if (!hasBrief || (latestStatus !== null && !STOPPED.has(latestStatus))) {
    return null;
  }
  const model = chosen ?? models.data?.defaultModel ?? null;
  return (
    <section aria-label={vi.startRun.heading} className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex flex-wrap items-end gap-3">
        {models.data !== undefined && models.data.models.length > 0 ? (
          <div className="flex flex-col gap-1">
            <Label htmlFor="start-run-model">{vi.startRun.model}</Label>
            <select
              id="start-run-model"
              className="bg-background h-8 rounded-md border px-2 text-sm"
              value={model ?? ""}
              onChange={(event) => setChosen(event.target.value)}
            >
              {models.data.models.map((name) => (
                <option key={name} value={name}>
                  {name === models.data?.defaultModel
                    ? `${modelLabel(name)} ${vi.startRun.defaultSuffix}`
                    : modelLabel(name)}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <Button
          type="button"
          disabled={start.isPending}
          onClick={() => {
            setError(null);
            start.mutate(model, {
              onError: (cause) =>
                setError(
                  cause instanceof ApiError && cause.code === "conflict"
                    ? vi.startRun.conflict
                    : cause instanceof ApiError && cause.code === "validation_error"
                      ? vi.startRun.badModel
                      : vi.startRun.error,
                ),
            });
          }}
        >
          {latestStatus === null ? vi.startRun.start : vi.startRun.startNew}
        </Button>
      </div>
      {durationSec === null ? null : (
        <p className="text-xs" data-testid="start-run-estimate">
          {`${vi.startRun.estimate} ${formatDurationRange(totalMachineEstimate(durationSec))} ${vi.startRun.estimateHint}`}
        </p>
      )}
      <p className="text-muted-foreground text-xs">{vi.startRun.hint}</p>
      {error === null ? null : (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </section>
  );
}
