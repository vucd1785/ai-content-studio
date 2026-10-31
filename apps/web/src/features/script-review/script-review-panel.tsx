import { type ApprovalDecision, type Script, scriptArtifactSchema } from "@studio/contracts";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { vi } from "@/i18n/vi";
import { ApiError } from "@/lib/api";
import { useArtifact, useRecordApproval, useWorkflowRun } from "./use-script-review";

const NOTE_MAX = 2000;

/**
 * So sánh hai phương án kịch bản và gửi decision ở cổng script (P2-07, ADR-004).
 * Mỗi nút gửi đúng một decision tường minh; không có nút duyệt hàng loạt hay mặc định.
 * Decision đã lưu đọc lại từ `GET /api/workflow-runs/:runId`, nên reload vẫn thấy.
 */
export function ScriptReviewPanel({ runId }: { runId: string | null }) {
  const run = useWorkflowRun(runId);
  const scriptArtifacts = (run.data?.artifacts ?? []).filter((artifact) => artifact.type === "script");
  const latest = scriptArtifacts.reduce<(typeof scriptArtifacts)[number] | null>(
    (best, artifact) => (best === null || artifact.version > best.version ? artifact : best),
    null,
  );
  const artifact = useArtifact(latest?.id ?? null);

  let body: React.ReactNode;
  if (runId === null) {
    body = <p className="text-muted-foreground text-sm">{vi.scriptReview.noRun}</p>;
  } else if (run.isPending || (latest !== null && artifact.isPending)) {
    body = <p className="text-muted-foreground text-sm">{vi.app.loading}</p>;
  } else if (run.isError || artifact.isError) {
    body = <p className="text-destructive text-sm">{vi.scriptReview.loadError}</p>;
  } else if (latest === null) {
    body = <p className="text-muted-foreground text-sm">{vi.scriptReview.noScript}</p>;
  } else {
    const parsed = scriptArtifactSchema.safeParse(artifact.data?.content);
    if (!parsed.success) {
      body = <p className="text-destructive text-sm">{vi.scriptReview.loadError}</p>;
    } else {
      const decisions = run.data.approvals.filter((approval) => approval.artifactId === latest.id);
      body = (
        <div className="flex flex-col gap-4">
          <p className="text-muted-foreground text-xs">
            {vi.scriptReview.version} {latest.version}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {parsed.data.variants.map((variant, index) => (
              <VariantColumn key={index} index={index + 1} script={variant} />
            ))}
          </div>
          {decisions.length > 0 ? (
            <section aria-label={vi.scriptReview.decisionsHeading} className="flex flex-col gap-1 text-sm">
              <h4 className="font-medium">{vi.scriptReview.decisionsHeading}</h4>
              <ul className="flex flex-col gap-1">
                {decisions.map((decision) => (
                  <li key={decision.id} data-testid="saved-decision">
                    {decision.decision === "approved" && decision.variantIndex !== null
                      ? `${vi.scriptReview.approvedVariant} ${decision.variantIndex}`
                      : vi.scriptReview.decisions[decision.decision]}
                    {decision.note === null ? null : `: ${decision.note}`}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {run.data.workflowRun.status === "waiting_script_approval" ? (
            <DecisionForm runId={runId} artifactId={latest.id} />
          ) : null}
        </div>
      );
    }
  }

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-sm">{vi.scriptReview.heading}</CardTitle>
      </CardHeader>
      <CardContent className="px-4">{body}</CardContent>
    </Card>
  );
}

function VariantColumn({ index, script }: { index: number; script: Script }) {
  return (
    <article className="flex flex-col gap-2 rounded-md border p-3 text-sm" aria-label={`${vi.scriptReview.variant} ${index}`}>
      <h4 className="font-semibold">
        {vi.scriptReview.variant} {index}: {script.title}
      </h4>
      <p className="text-muted-foreground">{script.hook}</p>
      <ol className="flex list-decimal flex-col gap-1 pl-5" aria-label={vi.scriptReview.scenes}>
        {script.scenes.map((scene) => (
          <li key={scene.id}>
            <span className="font-medium">{scene.onScreenText}</span>
            <span className="text-muted-foreground block text-xs">{scene.narration}</span>
          </li>
        ))}
      </ol>
      <p>{script.cta}</p>
      {script.sources.length > 0 ? (
        <ul className="text-muted-foreground text-xs" aria-label={vi.scriptReview.sources}>
          {script.sources.map((source) => (
            <li key={source.id}>{source.url === undefined ? source.title : `${source.title} (${source.url})`}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function DecisionForm({ runId, artifactId }: { runId: string; artifactId: string }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const record = useRecordApproval(runId);

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
    <div className="flex flex-col gap-2">
      <Label htmlFor="script-review-note">{vi.scriptReview.noteLabel}</Label>
      <Textarea
        id="script-review-note"
        value={note}
        maxLength={NOTE_MAX}
        onChange={(event) => setNote(event.target.value)}
        aria-describedby="script-review-note-hint"
      />
      <p id="script-review-note-hint" className="text-muted-foreground text-xs">
        {vi.scriptReview.noteHint}
      </p>
      {error === null ? null : (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={record.isPending} onClick={() => submit("approved", 1)}>
          {vi.scriptReview.approveVariant1}
        </Button>
        <Button type="button" disabled={record.isPending} onClick={() => submit("approved", 2)}>
          {vi.scriptReview.approveVariant2}
        </Button>
        <Button type="button" variant="outline" disabled={record.isPending} onClick={() => submit("changes_requested")}>
          {vi.scriptReview.requestChanges}
        </Button>
        <Button type="button" variant="secondary" disabled={record.isPending} onClick={() => submit("rejected")}>
          {vi.scriptReview.reject}
        </Button>
      </div>
    </div>
  );
}
