import {
  PUBLISH_PLATFORMS,
  type PublishPlatform,
  publishKitRequestResponseSchema,
  publishKitSchema,
} from "@studio/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useArtifact, workflowRunQueryKey } from "@/features/script-review/use-script-review";
import { vi } from "@/i18n/vi";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";

type RunArtifact = { id: string; type: string; version: number };
type AgentRun = {
  role: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
};

const t = vi.publishKit;

/**
 * Bộ đăng bài (ADR-018): sau khi xuất video, mỗi mạng xã hội một tab, mỗi ô một nút sao chép.
 * Worker viết bằng LLM rồi ghép phần chân về AI, nguồn, bản quyền; web chỉ hiển thị và cho tạo lại.
 */
export function PublishKitPanel({
  runId,
  artifacts,
  agentRuns,
}: {
  runId: string;
  artifacts: RunArtifact[];
  agentRuns: AgentRun[];
}) {
  const latest = artifacts
    .filter((a) => a.type === "publish_kit")
    .reduce<RunArtifact | null>(
      (best, a) => (best === null || a.version > best.version ? a : best),
      null,
    );
  const artifact = useArtifact(latest?.id ?? null);
  const parsed = publishKitSchema.safeParse(artifact.data?.content);
  const kit = parsed.success ? parsed.data : null;
  const publishRuns = agentRuns.filter((a) => a.role === "publish");
  const busy = publishRuns.some((a) => a.status === "queued" || a.status === "running");
  const lastFinished = [...publishRuns]
    .filter((a) => a.finishedAt !== null)
    .sort((a, b) => Date.parse(b.finishedAt ?? "") - Date.parse(a.finishedAt ?? ""))[0];
  const failed = !busy && lastFinished?.status === "failed";
  const [platform, setPlatform] = useState<PublishPlatform>("youtube");

  const queryClient = useQueryClient();
  // Run đã `exported` nên không tự đọc lại: trong lúc job chạy thì đọc lại mỗi 4 giây.
  useEffect(() => {
    if (!busy) {
      return;
    }
    const timer = setInterval(
      () => void queryClient.invalidateQueries({ queryKey: workflowRunQueryKey(runId) }),
      4000,
    );
    return () => clearInterval(timer);
  }, [busy, queryClient, runId]);

  const regenerate = useMutation({
    mutationFn: () =>
      apiRequest(`/api/workflow-runs/${encodeURIComponent(runId)}/publish-kit`, {
        method: "POST",
        schema: publishKitRequestResponseSchema,
      }),
    onSuccess: () => {
      toast(t.queued);
      return queryClient.invalidateQueries({ queryKey: workflowRunQueryKey(runId) });
    },
  });

  return (
    <section
      aria-labelledby="publish-kit-heading"
      className="flex flex-col gap-3 rounded-2xl border p-4"
      data-testid="publish-kit"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id="publish-kit-heading" className="text-base font-semibold">
            {t.heading}
          </h3>
          <p className="text-muted-foreground text-sm">{t.intro}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="text-primary text-sm font-semibold underline" href="#/publish-guide">
            {t.guideLink}
          </a>
          <Button
            variant="outline"
            size="sm"
            disabled={busy || regenerate.isPending}
            onClick={() => regenerate.mutate()}
          >
            {busy ? t.working : t.regenerate}
          </Button>
        </div>
      </div>
      {regenerate.isError ? (
        <p role="alert" className="text-destructive text-sm">
          {t.regenerateError}
        </p>
      ) : null}
      {busy ? (
        <p role="status" className="text-muted-foreground text-sm">
          {t.working}
        </p>
      ) : null}
      {failed ? (
        <p role="alert" className="text-destructive text-sm">
          {t.failed}{" "}
          {lastFinished?.errorMessage ? `(${lastFinished.errorMessage.slice(0, 160)})` : ""}
        </p>
      ) : null}
      {!busy && !failed && latest === null ? (
        <p className="text-muted-foreground text-sm">{t.empty}</p>
      ) : null}
      {kit === null ? null : (
        <>
          {kit.copyrightContact === null ? (
            <p className="bg-warning-bg text-warning rounded-lg px-3 py-2 text-sm" role="note">
              {t.missingContact}{" "}
              <a className="font-semibold underline" href="#/brand">
                {t.missingContactLink}
              </a>
            </p>
          ) : null}
          <div role="tablist" aria-label={t.platformsLabel} className="flex flex-wrap gap-2">
            {PUBLISH_PLATFORMS.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`publish-tab-${id}`}
                aria-selected={platform === id}
                aria-controls={`publish-panel-${id}`}
                onClick={() => setPlatform(id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm font-semibold",
                  platform === id ? "bg-primary text-primary-foreground" : "bg-card",
                )}
              >
                {t.platforms[id]}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id={`publish-panel-${platform}`}
            aria-labelledby={`publish-tab-${platform}`}
            className="flex flex-col gap-3"
          >
            <p className="text-muted-foreground text-xs">{t.tips[platform]}</p>
            {kit.platforms[platform].map((field) => (
              <CopyField
                key={`${platform}-${field.label}`}
                label={field.label}
                value={field.value}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const id = `copy-${label}`.replace(/\s+/g, "-");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast(t.copyFailed);
    }
  };
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs tabular-nums">
            {value.length.toLocaleString("vi-VN")} {t.chars}
          </span>
          <Button size="sm" variant="outline" onClick={() => void copy()}>
            {copied ? t.copied : t.copy}
          </Button>
        </div>
      </div>
      <textarea
        id={id}
        readOnly
        value={value}
        rows={Math.min(14, Math.max(2, value.split("\n").length + 1))}
        className="bg-muted/40 w-full resize-y rounded-lg border px-3 py-2 text-sm leading-relaxed"
      />
    </div>
  );
}
