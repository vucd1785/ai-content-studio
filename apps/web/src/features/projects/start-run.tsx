import {
  llmModelsResponseSchema,
  type WorkflowRunStatus,
  workflowRunControlResponseSchema,
} from "@studio/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
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
  // ADR-017: mặc định `creative` ở server (tự tạo tài sản thiếu); chỉ gửi khi Director chọn Tiêu chuẩn.
  const [standard, setStandard] = useState(false);
  // ADR-022: khung dọc là mặc định ở server; chỉ gửi khi Director chọn khung ngang.
  const [wide, setWide] = useState(false);
  const models = useLlmModels();
  const start = useMutation({
    mutationFn: (llmModel: string | null) => {
      const body = {
        ...(llmModel === null ? {} : { llmModel }),
        ...(standard ? { creativeMode: "standard" } : {}),
        ...(wide ? { aspectRatio: "16:9" } : {}),
      };
      return apiRequest(`/api/projects/${encodeURIComponent(projectId)}/workflow-runs`, {
        method: "POST",
        ...(Object.keys(body).length === 0 ? {} : { body }),
        schema: workflowRunControlResponseSchema,
      });
    },
    onSuccess: () => toast(vi.toast.runStarted),
    onSettled: () => queryClient.invalidateQueries({ queryKey: projectsQueryKey }),
  });
  if (!hasBrief || (latestStatus !== null && !STOPPED.has(latestStatus))) {
    return null;
  }
  const model = chosen ?? models.data?.defaultModel ?? null;
  return (
    <section
      aria-label={vi.startRun.heading}
      className="bg-card flex min-w-0 flex-col gap-3 rounded-2xl border p-4"
    >
      <h2 className="text-base font-semibold">{vi.startRun.heading}</h2>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{vi.startRun.modeLabel}</legend>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name={`mode-${projectId}`}
            checked={!standard}
            onChange={() => setStandard(false)}
            className="mt-1"
          />
          <span>
            <span className="font-semibold">{vi.startRun.modeCreative}</span>
            <span className="text-muted-foreground block text-xs">
              {vi.startRun.modeCreativeHint}
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name={`mode-${projectId}`}
            checked={standard}
            onChange={() => setStandard(true)}
            className="mt-1"
          />
          <span>
            <span className="font-semibold">{vi.startRun.modeStandard}</span>
            <span className="text-muted-foreground block text-xs">
              {vi.startRun.modeStandardHint}
            </span>
          </span>
        </label>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{vi.startRun.aspectLabel}</legend>
        {(
          [
            [false, vi.startRun.aspectVertical, vi.startRun.aspectVerticalHint],
            [true, vi.startRun.aspectWide, vi.startRun.aspectWideHint],
          ] as const
        ).map(([value, label, hint]) => (
          <label key={label} className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name={`aspect-${projectId}`}
              checked={wide === value}
              onChange={() => setWide(value)}
              className="mt-1"
            />
            <span>
              <span className="font-semibold">{label}</span>
              <span className="text-muted-foreground block text-xs">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex min-w-0 flex-wrap items-end gap-3">
        {models.data !== undefined && models.data.models.length > 0 ? (
          // Tên model dài (alias Claude Code kèm "(mặc định)") làm ô chọn rộng theo chữ và tràn khỏi cột: ô chiếm
          // cả hàng, không rộng hơn cột, chữ dài bị cắt bằng dấu "…".
          <div className="flex w-full min-w-0 flex-col gap-1">
            <Label htmlFor="start-run-model">{vi.startRun.model}</Label>
            <select
              id="start-run-model"
              className="bg-card border-input h-10 w-full max-w-full min-w-0 truncate rounded-lg border px-2 text-sm"
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
