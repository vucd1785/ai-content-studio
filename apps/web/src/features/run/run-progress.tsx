import type { WorkflowRunDetailResponse } from "@studio/contracts";
import { vi } from "@/i18n/vi";
import { cn } from "@/lib/utils";
import {
  buildRunSteps,
  formatDurationRange,
  type RunStep,
  remainingUntilNextGate,
} from "./run-steps";

const STATE_STYLE: Record<RunStep["state"], string> = {
  done: "border-emerald-500/60 bg-emerald-500/10 text-emerald-300",
  active: "border-sky-400/70 bg-sky-400/10 text-sky-200",
  waiting_you: "border-amber-400/70 bg-amber-400/10 text-amber-200",
  failed: "border-destructive/70 bg-destructive/10 text-destructive",
  stopped: "border-border bg-muted/40 text-muted-foreground",
  todo: "border-border text-muted-foreground",
};

/**
 * Thanh tiến trình bảy bước của lượt chạy (P2-11). Trạng thái đọc từ run đã lưu; bước đang chạy hiện thời gian
 * đã chạy thật kèm khoảng ước tính. Phần trăm chỉ có khi job media ghi số đếm thật (P3-17: bước cảnh của voice,
 * frame của render); job LLM không có phần trăm (ADR-009). Bước lỗi hiện mã và chi tiết lỗi đã lưu.
 */
export function RunProgress({
  run,
  durationSec,
  now = Date.now(),
}: {
  run: WorkflowRunDetailResponse | null;
  durationSec: number;
  now?: number;
}) {
  const steps = buildRunSteps({
    status: run?.workflowRun.status ?? null,
    resumeFrom: run?.workflowRun.resumeFrom ?? null,
    durationSec,
    agentRuns: run?.agentRuns ?? [],
    failureCode: run?.workflowRun.failureCode ?? null,
    failureMessage: run?.workflowRun.failureMessage ?? null,
    now,
  });
  const failed = steps.find((step) => step.state === "failed");
  const remaining = remainingUntilNextGate(steps);
  const waiting = steps.find((step) => step.state === "waiting_you");

  return (
    <section aria-label={vi.runSteps.heading} className="flex flex-col gap-2">
      <ol className="grid grid-cols-7 gap-1.5" data-testid="run-steps">
        {steps.map((step, index) => (
          <li
            key={step.id}
            data-testid={`step-${step.id}`}
            data-state={step.state}
            className={cn(
              "flex min-w-0 flex-col gap-0.5 rounded-md border px-2 py-1.5 text-xs",
              STATE_STYLE[step.state],
            )}
          >
            <span className="truncate font-medium">
              {index + 1}. {vi.runSteps.steps[step.id]}
            </span>
            <span className="truncate opacity-90">{vi.runSteps.states[step.state]}</span>
            <StepTiming step={step} />
            {step.progress === null ? null : <StepProgressBar step={step} />}
          </li>
        ))}
      </ol>
      {failed?.error ? <StepErrorPanel step={failed} /> : null}
      {steps.some((step) => step.id === "assets" && step.state === "active") ? (
        <p className="text-muted-foreground text-xs">{vi.runSteps.noLimit}</p>
      ) : null}
      <p className="text-muted-foreground text-xs" data-testid="run-eta">
        {run === null
          ? null
          : waiting !== undefined
            ? vi.runSteps.waitingYou
            : remaining !== null
              ? `${vi.runSteps.remaining} ${formatDurationRange(remaining)} ${vi.runSteps.remainingHint}`
              : null}
      </p>
    </section>
  );
}

function StepProgressBar({ step }: { step: RunStep }) {
  const progress = step.progress;
  if (progress === null) {
    return null;
  }
  const detail =
    progress.unit === "frame"
      ? `${progress.done}/${progress.total} ${vi.runSteps.frames}`
      : progress.currentScene !== null &&
          progress.sceneCount !== null &&
          progress.currentPhase !== null
        ? `${vi.runSteps.sceneOf} ${progress.currentScene}/${progress.sceneCount} · ${vi.runSteps.phases[progress.currentPhase]}`
        : null;
  return (
    <div className="mt-1 flex flex-col gap-0.5" data-testid={`progress-${step.id}`}>
      <div
        role="progressbar"
        aria-label={`${vi.runSteps.progressLabel}: ${vi.runSteps.steps[step.id]}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        className="h-1.5 overflow-hidden rounded-full bg-white/10"
      >
        <div className="h-full rounded-full bg-current" style={{ width: `${progress.percent}%` }} />
      </div>
      <span className="truncate font-medium">
        {progress.percent}%{detail === null ? null : ` · ${detail}`}
      </span>
    </div>
  );
}

/** Lỗi của client Claude Code (ADR-007, bổ sung 2026-11-02): hết hạn mức, hoặc thiếu cấu hình có nhắc Claude Code. */
function isClaudeCodeError(code: string, message: string | null): boolean {
  return (
    code === "quota_exhausted" ||
    (code === "configuration_missing" && /claude/i.test(message ?? ""))
  );
}

const TTS_ERRORS = new Set([
  "alignment_failed",
  "alignment_gate_failed",
  "synthesis_failed",
  "tts_unavailable",
]);

function StepErrorPanel({ step }: { step: RunStep }) {
  const error = step.error;
  if (error === null) {
    return null;
  }
  return (
    <div
      role="alert"
      data-testid="run-error"
      className="border-destructive/60 bg-destructive/10 flex flex-col gap-1 rounded-md border px-3 py-2 text-sm"
    >
      <p className="text-destructive font-medium">
        {vi.runSteps.errorHeading} {vi.runSteps.steps[step.id]} ·{" "}
        {vi.runSteps.errors[error.code] ?? error.code}
      </p>
      <p className="text-muted-foreground text-xs">
        {vi.runSteps.errorCode}: <code>{error.code}</code>
        {error.role === null ? null : ` · ${error.role}`}
      </p>
      <p className="text-xs break-words whitespace-pre-wrap">
        {vi.runSteps.errorDetail}: {error.message ?? vi.runSteps.errorNoDetail}
      </p>
      {TTS_ERRORS.has(error.code) ? (
        <p className="text-muted-foreground text-xs">{vi.runSteps.errorHints.tts}</p>
      ) : null}
      {isClaudeCodeError(error.code, error.message) ? (
        <p className="text-muted-foreground text-xs">{vi.runSteps.errorHints.claudeCode}</p>
      ) : null}
    </div>
  );
}

function StepTiming({ step }: { step: RunStep }) {
  if (step.gate) {
    return <span className="truncate opacity-70">{vi.runSteps.gateNoEstimate}</span>;
  }
  if (step.estimateSec === null || step.state === "done" || step.state === "stopped") {
    return null;
  }
  return (
    <span className="truncate opacity-70">
      {step.elapsedSec !== null
        ? `${vi.runSteps.elapsed} ${formatDurationRange([step.elapsedSec, step.elapsedSec])} / ${formatDurationRange(step.estimateSec)}`
        : `${vi.runSteps.estimate} ${formatDurationRange(step.estimateSec)}`}
    </span>
  );
}
