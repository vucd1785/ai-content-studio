import { type ApprovalDecision, researchSchema } from "@studio/contracts";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { vi } from "@/i18n/vi";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ScriptV2Review } from "./script-v2-review";
import { useArtifact, useRecordApproval, useWorkflowRun } from "./use-script-review";

const NOTE_MAX = 2000;

type RunArtifact = { id: string; type: string; version: number };

function latestOf(artifacts: RunArtifact[], type: string): RunArtifact | null {
  return artifacts
    .filter((artifact) => artifact.type === type)
    .reduce<RunArtifact | null>(
      (best, artifact) => (best === null || artifact.version > best.version ? artifact : best),
      null,
    );
}

/**
 * Duyệt kịch bản (P2-07, P2-11, P6-17): research của run, hai phương án script `2` với câu theo người nói và ảnh
 * storyboard. Mỗi nút gửi đúng một decision tường minh (ADR-004); decision đã lưu đọc lại từ server. Khi đang
 * chờ duyệt, Director sửa được chữ trong câu (ADR-020); sửa cấu trúc cảnh vẫn qua "Yêu cầu sửa".
 */
export function ScriptReviewPanel({ runId }: { runId: string | null }) {
  const run = useWorkflowRun(runId);
  const artifacts = run.data?.artifacts ?? [];
  const latest = latestOf(artifacts, "script");
  const artifact = useArtifact(latest?.id ?? null);
  const research = useArtifact(latestOf(artifacts, "research")?.id ?? null);
  const storyboardRow = latestOf(artifacts, "storyboard");
  const storyboard = useArtifact(storyboardRow?.id ?? null);

  if (runId === null) {
    return <p className="text-muted-foreground text-sm">{vi.scriptReview.noRun}</p>;
  }
  if (run.isPending || (latest !== null && artifact.isPending)) {
    return <p className="text-muted-foreground text-sm">{vi.app.loading}</p>;
  }
  if (run.isError || artifact.isError) {
    return <p className="text-destructive text-sm">{vi.scriptReview.loadError}</p>;
  }
  if (latest === null) {
    return <p className="text-muted-foreground text-sm">{vi.scriptReview.noScript}</p>;
  }
  if (artifact.data?.artifact.schemaVersion !== "2") {
    return <p className="text-destructive text-sm">{vi.scriptReview.loadError}</p>;
  }
  const status = run.data.workflowRun.status;
  const waiting = status === "waiting_script_approval";
  const decisions = run.data.approvals.filter((approval) => approval.artifactId === latest.id);
  const parsedResearch = researchSchema.safeParse(research.data?.content);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted-foreground text-xs">
        {vi.scriptReview.version} {latest.version}
      </p>

      {parsedResearch.success ? (
        <section
          aria-label={vi.scriptReview.researchHeading}
          className="bg-card flex flex-col gap-2 rounded-xl border p-4 text-sm"
        >
          <h3 className="font-semibold">{vi.scriptReview.researchHeading}</h3>
          <p className="text-muted-foreground">{parsedResearch.data.summary}</p>
          {parsedResearch.data.facts.length === 0 ? (
            <p className="text-muted-foreground text-xs">{vi.scriptReview.researchNoFacts}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {parsedResearch.data.facts.map((fact) => (
                <li key={fact.statement} className="flex gap-2">
                  <span className="bg-secondary shrink-0 rounded px-1.5 py-0.5 text-[11px]">
                    {vi.scriptReview.claim[fact.claimStatus]}
                  </span>
                  <span>{fact.statement}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <ScriptV2Review
        runId={runId}
        content={artifact.data.content}
        storyboardContent={storyboard.data?.content}
        storyboardArtifactId={storyboardRow?.id ?? null}
        storyboarding={status === "storyboarding"}
        scriptArtifactId={latest.id}
        editable={waiting}
      />

      {decisions.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm">
          {decisions.map((decision) => (
            <li key={decision.id} data-testid="saved-decision">
              {decision.decision === "approved" && decision.variantIndex !== null
                ? `${vi.scriptReview.approvedVariant} ${decision.variantIndex}`
                : vi.scriptReview.decisions[decision.decision]}
              {decision.note === null ? null : `: ${decision.note}`}
            </li>
          ))}
        </ul>
      ) : null}
      {waiting ? <DecisionForm runId={runId} artifactId={latest.id} /> : null}
    </div>
  );
}

function DecisionForm({ runId, artifactId }: { runId: string; artifactId: string }) {
  const [note, setNote] = useState("");
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const record = useRecordApproval(runId);
  const expanded = focused || note !== "" || error !== null;

  // Duyệt luôn kèm phương án (quyết định 6): mỗi phương án một nút, không có duyệt chung.
  const submit = (decision: ApprovalDecision, variantIndex?: 1 | 2) => {
    const trimmed = note.trim();
    if (trimmed.length > NOTE_MAX) {
      setError(vi.scriptReview.noteTooLong);
      return;
    }
    if (decision !== "approved" && trimmed === "") {
      setError(vi.scriptReview.noteRequired);
      return;
    }
    setError(null);
    record.mutate(
      {
        gate: "script",
        decision,
        artifactId,
        ...(variantIndex === undefined ? {} : { variantIndex }),
        ...(trimmed === "" ? {} : { note: trimmed }),
      },
      {
        onSuccess: () => setNote(""),
        onError: (cause) => {
          setError(
            cause instanceof ApiError && cause.code === "invalid_transition"
              ? vi.scriptReview.notWaiting
              : vi.scriptReview.submitError,
          );
        },
      },
    );
  };

  return (
    <div className="bg-surface-raised sticky bottom-0 -mx-1 flex flex-wrap items-end gap-3 rounded-xl border px-4 py-3 shadow-sm">
      <div className="flex min-w-72 flex-1 flex-col gap-1.5">
        <Label htmlFor="script-review-note">{vi.scriptReview.noteLabel}</Label>
        <Textarea
          id="script-review-note"
          value={note}
          rows={expanded ? 3 : 1}
          maxLength={NOTE_MAX}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(event) => setNote(event.target.value)}
          aria-describedby="script-review-note-hint"
          className="min-h-0"
        />
        <p
          id="script-review-note-hint"
          className={cn("text-muted-foreground text-xs", expanded ? "" : "sr-only")}
        >
          {vi.scriptReview.noteHint}
        </p>
        {error === null ? null : (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={record.isPending}
          onClick={() => submit("rejected")}
        >
          {vi.scriptReview.reject}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={record.isPending}
          onClick={() => submit("changes_requested")}
        >
          {vi.scriptReview.requestChanges}
        </Button>
        {/* Hai phương án ngang hàng: không tô nổi một nút để khỏi thiên vị. */}
        <Button type="button" disabled={record.isPending} onClick={() => submit("approved", 1)}>
          {vi.scriptReview.approveVariant1}
        </Button>
        <Button type="button" disabled={record.isPending} onClick={() => submit("approved", 2)}>
          {vi.scriptReview.approveVariant2}
        </Button>
      </div>
    </div>
  );
}
