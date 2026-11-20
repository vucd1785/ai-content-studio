import { type ApprovalDecision, isChannelNameSet, qaReportArtifactSchema } from "@studio/contracts";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useBrandContact } from "@/features/brand/brand-contact";
import { PublishKitPanel } from "@/features/publish/publish-kit-panel";
import {
  useArtifact,
  useRecordApproval,
  useWorkflowRun,
} from "@/features/script-review/use-script-review";
import { YoutubeUploadPanel } from "@/features/youtube/youtube-upload-panel";
import { vi } from "@/i18n/vi";
import { ApiError } from "@/lib/api";
import { artifactMediaUrl, artifactThumbnailUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import { RedoPanel } from "./redo-panel";
import { RunControls } from "./run-controls";

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
 * Cổng final (P2-10, ADR-004): xem bản preview mới nhất cùng QA của đúng bản đó, rồi gửi một decision tường minh.
 * Nút duyệt khóa khi QA chưa đạt (server cũng chặn bằng 409). Decision và trạng thái đọc lại từ server.
 */
export function FinalReviewPanel({ runId }: { runId: string | null }) {
  const run = useWorkflowRun(runId);
  const artifacts = run.data?.artifacts ?? [];
  const preview = latestOf(artifacts, "preview");
  const qaRow = latestOf(artifacts, "qa_report");
  const exported = latestOf(artifacts, "export");
  const qa = useArtifact(qaRow?.id ?? null);

  let body: React.ReactNode;
  if (runId === null) {
    body = <p className="text-muted-foreground text-sm">{vi.finalReview.noRun}</p>;
  } else if (run.isPending) {
    body = <p className="text-muted-foreground text-sm">{vi.app.loading}</p>;
  } else if (run.isError) {
    body = <p className="text-destructive text-sm">{vi.finalReview.loadError}</p>;
  } else {
    // QA chỉ tính khi report trỏ đúng bản preview đang xem.
    const parsedQa = qaReportArtifactSchema.safeParse(qa.data?.content);
    const report =
      parsedQa.success && parsedQa.data.previewArtifactId === preview?.id ? parsedQa.data : null;
    const decisions = run.data.approvals.filter((approval) => approval.gate === "final");
    body = (
      <div className="flex flex-col gap-4">
        <RunControls runId={runId} />
        {preview === null ? (
          <p className="text-muted-foreground text-sm">{vi.finalReview.noPreview}</p>
        ) : (
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            {/* Khung điện thoại 9:16 (06 mục Năm màn hình). */}
            <div className="mx-auto w-full max-w-[22rem] shrink-0 rounded-[1.75rem] border-8 border-[#22262f] bg-[#0b0d12] md:mx-0 md:w-[22rem]">
              {/* biome-ignore lint/a11y/useMediaCaption: phụ đề đã burn vào MP4 */}
              <video
                aria-label={`${vi.finalReview.preview} ${preview.version}`}
                data-testid="final-preview-video"
                src={artifactMediaUrl(preview.id)}
                controls
                preload="metadata"
                className="w-full rounded-[1.25rem]"
                style={{ aspectRatio: "1080 / 1920" }}
              />
              <p className="text-muted-foreground mt-1 text-center text-xs">
                {vi.finalReview.preview} {preview.version}
              </p>
            </div>
            <QaSummary loading={qaRow !== null && qa.isPending} report={report} />
          </div>
        )}
        {decisions.length > 0 ? (
          <section
            aria-label={vi.finalReview.decisionsHeading}
            className="flex flex-col gap-1 text-sm"
          >
            <h4 className="font-medium">{vi.finalReview.decisionsHeading}</h4>
            <ul className="flex flex-col gap-1">
              {decisions.map((decision) => {
                const version = artifacts.find(
                  (artifact) => artifact.id === decision.artifactId,
                )?.version;
                return (
                  <li key={decision.id} data-testid="final-decision">
                    {vi.scriptReview.decisions[decision.decision]}
                    {version === undefined ? null : ` · ${vi.finalReview.preview} ${version}`}
                    {decision.note === null ? null : `: ${decision.note}`}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
        {run.data.workflowRun.status === "waiting_final_approval" && preview !== null ? (
          <>
            <FinalDecisionForm
              runId={runId}
              previewId={preview.id}
              qaPassed={report?.passed === true}
            />
            <RedoPanel
              runId={runId}
              renderPropsId={latestOf(artifacts, "render_props")?.id ?? null}
            />
          </>
        ) : null}
        {exported === null ? null : (
          <div className="bg-success-bg flex flex-wrap items-center gap-4 rounded-2xl border px-4 py-3">
            <img src="/assets/illustrations/export_done.svg" alt="" className="h-16 w-auto" />
            <p className="text-success min-w-0 flex-1 text-sm font-semibold">
              {vi.finalReview.exportReady}
            </p>
            <a
              className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold"
              data-testid="export-link"
              href={artifactMediaUrl(exported.id)}
              download
            >
              {vi.finalReview.downloadExport} {exported.version}
            </a>
          </div>
        )}
        {exported === null ? null : <ExportThumbnail exportId={exported.id} />}
        {run.data.workflowRun.status === "exported" ? (
          <PublishKitPanel runId={runId} artifacts={artifacts} agentRuns={run.data.agentRuns} />
        ) : null}
        {run.data.workflowRun.status === "exported" ? (
          <YoutubeUploadPanel runId={runId} artifacts={artifacts} />
        ) : null}
      </div>
    );
  }

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-lg">{vi.finalReview.heading}</CardTitle>
      </CardHeader>
      <CardContent className="px-4">{body}</CardContent>
    </Card>
  );
}

/** Ảnh bìa tự tạo (ADR-021): khung có thẻ tiêu đề, dùng làm ảnh bìa khi đăng. Ẩn khi bản xuất cũ chưa có. */
function ExportThumbnail({ exportId }: { exportId: string }) {
  const [missing, setMissing] = useState(false);
  if (missing) {
    return null;
  }
  const url = artifactThumbnailUrl(exportId);
  return (
    <section
      aria-label={vi.finalReview.thumbnailHeading}
      className="bg-card flex flex-wrap items-center gap-4 rounded-2xl border px-4 py-3"
    >
      <img
        src={url}
        alt={vi.finalReview.thumbnailHeading}
        data-testid="export-thumbnail"
        className="h-40 w-auto rounded-lg border"
        onError={() => setMissing(true)}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
        <h4 className="font-semibold">{vi.finalReview.thumbnailHeading}</h4>
        <p className="text-muted-foreground">{vi.finalReview.thumbnailHint}</p>
        <a className="self-start font-semibold underline" href={url} download>
          {vi.finalReview.thumbnailDownload}
        </a>
      </div>
    </section>
  );
}

function QaSummary({
  loading,
  report,
}: {
  loading: boolean;
  report: { passed: boolean; checks: { code: string; severity: string; message: string }[] } | null;
}) {
  if (loading) {
    return <p className="text-muted-foreground text-sm">{vi.app.loading}</p>;
  }
  if (report === null) {
    return (
      <p className="text-muted-foreground text-sm" data-testid="qa-status">
        {vi.finalReview.qaMissing}
      </p>
    );
  }
  return (
    <section
      aria-label={vi.finalReview.qaHeading}
      className="flex min-w-0 flex-1 flex-col gap-2 text-sm"
    >
      <h4 className="text-base font-semibold">{vi.finalReview.qaHeading}</h4>
      <p
        data-testid="qa-status"
        className={cn(
          "rounded-xl px-3 py-2 font-semibold",
          report.passed ? "bg-success-bg text-success" : "bg-destructive-bg text-destructive",
        )}
      >
        {report.passed ? vi.finalReview.qaPassed : vi.finalReview.qaFailed}
      </p>
      {report.checks.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {report.checks.map((check) => (
            <li
              key={`${check.code}-${check.message}`}
              data-testid="qa-check"
              className="bg-card rounded-xl border px-3 py-2"
            >
              <span
                className={cn(
                  "mr-2 rounded-full px-2 py-0.5 text-xs font-semibold",
                  check.severity === "error"
                    ? "bg-destructive-bg text-destructive"
                    : "bg-warning-bg text-warning",
                )}
              >
                {(vi.finalReview.severity as Record<string, string>)[check.severity] ??
                  check.severity}
              </span>
              {(vi.finalReview.checks as Record<string, string>)[check.code] ?? check.code}
              <span className="text-muted-foreground mt-1 block text-xs">{check.message}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function FinalDecisionForm({
  runId,
  previewId,
  qaPassed,
}: {
  runId: string;
  previewId: string;
  qaPassed: boolean;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const record = useRecordApproval(runId);
  // ADR-021: kênh phải có tên trước lần xuất đầu (server cũng chặn bằng 409).
  const contact = useBrandContact();
  const channelMissing = contact.data !== undefined && !isChannelNameSet(contact.data.displayName);

  const submit = (decision: ApprovalDecision) => {
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
        gate: "final",
        decision,
        artifactId: previewId,
        ...(trimmed === "" ? {} : { note: trimmed }),
      },
      {
        onSuccess: () => setNote(""),
        onError: (cause) => {
          if (cause instanceof ApiError && cause.code === "conflict") {
            void contact.refetch();
            setError(
              cause.message.includes("tên kênh")
                ? vi.finalReview.channelMissing
                : vi.finalReview.qaBlocked,
            );
          } else if (cause instanceof ApiError && cause.code === "invalid_transition") {
            setError(vi.finalReview.notWaiting);
          } else {
            setError(vi.scriptReview.submitError);
          }
        },
      },
    );
  };

  return (
    <div className="bg-surface-raised flex flex-col gap-2 rounded-xl border p-4">
      <Label htmlFor="final-review-note">{vi.finalReview.noteLabel}</Label>
      <Textarea
        id="final-review-note"
        value={note}
        rows={2}
        maxLength={NOTE_MAX}
        onChange={(event) => setNote(event.target.value)}
        aria-describedby="final-review-note-hint"
      />
      <p id="final-review-note-hint" className="text-muted-foreground text-xs">
        {qaPassed ? vi.finalReview.noteHint : vi.finalReview.approveLocked}
      </p>
      {channelMissing ? (
        <p
          data-testid="channel-missing"
          className="bg-warning-bg text-foreground flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-sm"
        >
          <span className="min-w-0 flex-1">{vi.finalReview.channelMissing}</span>
          <a href="#/brand" className="font-semibold underline">
            {vi.finalReview.channelMissingAction}
          </a>
        </p>
      ) : null}
      {error === null ? null : (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={record.isPending || !qaPassed || channelMissing}
          onClick={() => submit("approved")}
        >
          {vi.finalReview.approve}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={record.isPending}
          onClick={() => submit("changes_requested")}
        >
          {vi.scriptReview.requestChanges}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={record.isPending}
          onClick={() => submit("rejected")}
        >
          {vi.scriptReview.reject}
        </Button>
      </div>
    </div>
  );
}
