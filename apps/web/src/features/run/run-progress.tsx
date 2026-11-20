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
  done: "border-success/40 bg-success-bg text-success",
  active: "border-info/50 bg-info-bg text-info",
  waiting_you: "border-warning/70 border-dashed bg-warning-bg text-warning",
  failed: "border-destructive/50 bg-destructive-bg text-destructive",
  stopped: "border-border bg-muted text-muted-foreground",
  todo: "border-border bg-card text-muted-foreground",
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
      <ol
        className="grid grid-cols-4 gap-1.5 @3xl:grid-cols-7 xl:grid-cols-7"
        data-testid="run-steps"
      >
        {steps.map((step, index) => (
          <li
            key={step.id}
            data-testid={`step-${step.id}`}
            data-state={step.state}
            className={cn(
              "flex min-w-0 flex-col gap-0.5 rounded-xl border px-2 py-1.5 text-xs",
              STATE_STYLE[step.state],
            )}
          >
            <span className="leading-snug font-semibold break-words">
              {index + 1}. {vi.runSteps.steps[step.id]}
            </span>
            <span className="opacity-90">{vi.runSteps.states[step.state]}</span>
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

/** Dòng chữ dưới thanh tiến trình: đếm thật theo đơn vị của bước. */
export function progressDetail(progress: NonNullable<RunStep["progress"]>): string | null {
  const t = vi.runSteps;
  if (progress.unit === "frame") {
    return `${progress.done}/${progress.total} ${t.frames}`;
  }
  if (progress.unit === "image") {
    return progress.phase === "assets"
      ? t.phases.assets
      : `${t.imageOf} ${progress.done}/${progress.total}`;
  }
  const parts: string[] = [];
  if (progress.sceneIndex !== null && progress.sceneCount !== null) {
    parts.push(`${t.sceneOf} ${progress.sceneIndex}/${progress.sceneCount}`);
  }
  if (progress.lineIndex !== null && progress.lineCount !== null) {
    parts.push(`${t.lineOf} ${progress.lineIndex}/${progress.lineCount}`);
  }
  if (progress.phase !== null) {
    parts.push(t.phases[progress.phase]);
  }
  return parts.length === 0
    ? `${progress.done}/${progress.total} ${t.stepUnit}`
    : parts.join(" · ");
}

function StepProgressBar({ step }: { step: RunStep }) {
  const progress = step.progress;
  if (progress === null) {
    return null;
  }
  const detail = progressDetail(progress);
  return (
    <div className="mt-1 flex flex-col gap-0.5" data-testid={`progress-${step.id}`}>
      <div
        role="progressbar"
        aria-label={`${vi.runSteps.progressLabel}: ${vi.runSteps.steps[step.id]}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/15"
      >
        <div className="h-full rounded-full bg-current" style={{ width: `${progress.percent}%` }} />
      </div>
      <span className="leading-snug font-medium break-words">
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
      className="border-destructive/40 bg-destructive-bg flex gap-4 rounded-2xl border px-4 py-3 text-sm"
    >
      <img
        src="/assets/characters/bit_error.svg"
        alt=""
        className="hidden size-20 shrink-0 sm:block"
      />
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="text-destructive text-base font-semibold">
          {vi.runSteps.errorHeading} {vi.runSteps.steps[step.id]} ·{" "}
          {vi.runSteps.errors[error.code] ?? error.code}
        </p>
        {TTS_ERRORS.has(error.code) ? (
          <p className="text-foreground text-sm">{vi.runSteps.errorHints.tts}</p>
        ) : null}
        {isClaudeCodeError(error.code, error.message) ? (
          <p className="text-foreground text-sm">{vi.runSteps.errorHints.claudeCode}</p>
        ) : null}
        <details className="text-foreground text-xs">
          <summary className="cursor-pointer font-semibold">{vi.runSteps.technical}</summary>
          <p className="mt-1">
            {vi.runSteps.errorCode}: <code>{error.code}</code>
            {error.role === null ? null : ` · ${error.role}`}
          </p>
          <p className="break-words whitespace-pre-wrap">
            {vi.runSteps.errorDetail}: {error.message ?? vi.runSteps.errorNoDetail}
          </p>
        </details>
      </div>
    </div>
  );
}

/**
 * Thời gian của một bước. Chỉ bước đang chạy (và cổng đang chờ bạn) hiện chữ, để thẻ bước gọn (ADR-020);
 * thời gian còn lại của cả lượt nằm ở dòng dưới thanh bước.
 */
function StepTiming({ step }: { step: RunStep }) {
  if (step.gate) {
    return step.state === "waiting_you" ? (
      <span className="leading-snug opacity-80">{vi.runSteps.gateNoEstimate}</span>
    ) : null;
  }
  if (step.estimateSec === null || step.state !== "active") {
    return null;
  }
  return (
    <span className="leading-snug opacity-80">
      {step.elapsedSec !== null
        ? `${vi.runSteps.elapsed} ${formatDurationRange([step.elapsedSec, step.elapsedSec])} / ${formatDurationRange(step.estimateSec)}`
        : `${vi.runSteps.estimate} ${formatDurationRange(step.estimateSec)}`}
    </span>
  );
}
