import {
  assetIdsInRenderProps,
  isChannelNameSet,
  type MotionAsset,
  motionAssetListResponseSchema,
  REDO_REGENERATABLE_KINDS,
  type RedoBody,
  redoResponseSchema,
} from "@studio/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { useBrandContact } from "@/features/brand/brand-contact";
import { useArtifact, workflowRunQueryKey } from "@/features/script-review/use-script-review";
import { vi } from "@/i18n/vi";
import { ApiError, apiRequest } from "@/lib/api";

const t = vi.finalReview.redo;

type PropsView = {
  scenes?: { sceneId: string; fromMs: number; durationMs: number }[];
  captions?: { text: string; startMs: number }[];
  cards?: { outro?: { channel: string | null } };
};

type RedoOutcome = { kind: string; ok: boolean; message: string | null };

/** Nhãn cảnh: số thứ tự và vài chữ đầu của lời thoại trong cảnh, để Director nhận ra cảnh. */
export function sceneLabels(props: PropsView): { sceneId: string; label: string }[] {
  return (props.scenes ?? []).map((scene, i) => {
    const words = (props.captions ?? [])
      .filter((c) => c.startMs >= scene.fromMs && c.startMs < scene.fromMs + scene.durationMs)
      .map((c) => c.text)
      .join("")
      .trim();
    const preview = words.length > 36 ? `${words.slice(0, 36)}…` : words;
    return {
      sceneId: scene.sceneId,
      label: `${t.scene} ${i + 1}${preview === "" ? "" : `: ${preview}`}`,
    };
  });
}

/**
 * Làm lại một phần ở Cổng 2 (ADR-021): đọc lại một cảnh, đổi nền một cảnh, tạo lại một hình, dựng lại.
 * Mỗi nút tạo một lượt làm lại; video mới qua QA rồi về lại đây. Không ghi approval.
 */
export function RedoPanel({
  runId,
  renderPropsId,
}: {
  runId: string;
  renderPropsId: string | null;
}) {
  const ids = useId();
  const queryClient = useQueryClient();
  const propsArtifact = useArtifact(renderPropsId);
  const props = (propsArtifact.data?.content ?? null) as PropsView | null;
  const lastRedo = (propsArtifact.data?.artifact.metadata as { redo?: RedoOutcome } | undefined)
    ?.redo;
  const assets = useQuery({
    queryKey: ["motion-assets"] as const,
    queryFn: () => apiRequest("/api/motion-assets", { schema: motionAssetListResponseSchema }),
  });
  const scenes = useMemo(() => (props === null ? [] : sceneLabels(props)), [props]);
  // Video dựng khi kênh chưa có tên: thẻ cuối thiếu tên kênh; gợi ý "Dựng lại" sau khi đặt tên (ADR-021).
  const contact = useBrandContact();
  const staleChannel =
    props?.cards?.outro !== undefined &&
    props.cards.outro.channel === null &&
    isChannelNameSet(contact.data?.displayName);
  const backgrounds = (assets.data?.assets ?? []).filter((a) => a.kind === "background");
  const regeneratable = useMemo(() => {
    const used = props === null ? new Set<string>() : assetIdsInRenderProps(props);
    return (assets.data?.assets ?? []).filter(
      (a: MotionAsset) =>
        used.has(a.assetId) && (REDO_REGENERATABLE_KINDS as readonly string[]).includes(a.kind),
    );
  }, [assets.data, props]);

  const [sceneId, setSceneId] = useState<string>("");
  const [backgroundId, setBackgroundId] = useState<string>("");
  const [assetId, setAssetId] = useState<string>("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scene = sceneId === "" ? (scenes[0]?.sceneId ?? "") : sceneId;

  const redo = useMutation({
    mutationFn: (body: RedoBody) =>
      apiRequest(`/api/workflow-runs/${encodeURIComponent(runId)}/redo`, {
        method: "POST",
        body,
        schema: redoResponseSchema,
      }),
    onSuccess: () => {
      setError(null);
      setNote("");
      toast(t.queued);
      void queryClient.invalidateQueries({ queryKey: workflowRunQueryKey(runId) });
    },
    onError: (cause) => {
      setError(
        cause instanceof ApiError &&
          cause.code !== "unknown_error" &&
          cause.code !== "network_error"
          ? cause.message
          : t.error,
      );
    },
  });
  const busy = redo.isPending;

  if (renderPropsId === null) {
    return null;
  }
  return (
    <details className="bg-surface-raised rounded-xl border p-4" data-testid="redo-panel">
      <summary className="cursor-pointer font-semibold">{t.heading}</summary>
      <div className="mt-3 flex flex-col gap-4 text-sm">
        <p className="text-muted-foreground">{t.intro}</p>
        {staleChannel ? (
          <p className="bg-info-bg rounded-xl px-3 py-2">{vi.finalReview.channelMissingRerender}</p>
        ) : null}
        {lastRedo !== undefined && !lastRedo.ok ? (
          <p role="status" className="bg-warning-bg rounded-xl px-3 py-2">
            {t.lastFailed}
            {lastRedo.message === null ? "" : ` (${lastRedo.message})`}
          </p>
        ) : null}
        {propsArtifact.isPending ? (
          <p className="text-muted-foreground">{vi.app.loading}</p>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${ids}-scene`}>{t.sceneLabel}</Label>
              <select
                id={`${ids}-scene`}
                className="bg-card rounded-lg border px-3 py-2"
                value={scene}
                onChange={(event) => setSceneId(event.target.value)}
              >
                {scenes.map((s) => (
                  <option key={s.sceneId} value={s.sceneId}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy || scene === ""}
                onClick={() => redo.mutate({ kind: "revoice", sceneId: scene })}
              >
                {t.revoice}
              </Button>
              <div className="flex min-w-48 flex-1 flex-col gap-1">
                <Label htmlFor={`${ids}-bg`}>{t.backgroundLabel}</Label>
                <select
                  id={`${ids}-bg`}
                  className="bg-card rounded-lg border px-3 py-2"
                  value={backgroundId}
                  onChange={(event) => setBackgroundId(event.target.value)}
                >
                  <option value="">{t.backgroundPick}</option>
                  {backgrounds.map((a) => (
                    <option key={a.assetId} value={a.assetId}>
                      {a.tags[0] === undefined ? a.assetId : `${a.tags[0]} (${a.assetId})`}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={busy || scene === "" || backgroundId === ""}
                onClick={() => redo.mutate({ kind: "background", sceneId: scene, backgroundId })}
              >
                {t.background}
              </Button>
            </div>
            <div className="flex flex-col gap-2 border-t pt-3">
              <Label htmlFor={`${ids}-asset`}>{t.assetLabel}</Label>
              {regeneratable.length === 0 ? (
                <p className="text-muted-foreground">{t.noAsset}</p>
              ) : (
                <>
                  <select
                    id={`${ids}-asset`}
                    className="bg-card rounded-lg border px-3 py-2"
                    value={assetId}
                    onChange={(event) => setAssetId(event.target.value)}
                  >
                    <option value="">{t.assetPick}</option>
                    {regeneratable.map((a) => (
                      <option key={a.assetId} value={a.assetId}>
                        {(vi.library.kinds as Record<string, string>)[a.kind] ?? a.kind}:{" "}
                        {a.tags[0] ?? a.assetId}
                      </option>
                    ))}
                  </select>
                  <Label htmlFor={`${ids}-note`}>{t.noteLabel}</Label>
                  <Input
                    id={`${ids}-note`}
                    value={note}
                    maxLength={500}
                    placeholder={t.notePlaceholder}
                    onChange={(event) => setNote(event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="self-start"
                    disabled={busy || assetId === "" || note.trim() === ""}
                    onClick={() =>
                      redo.mutate({ kind: "regenerate_asset", assetId, note: note.trim() })
                    }
                  >
                    {t.regenerate}
                  </Button>
                  <p className="text-muted-foreground text-xs">{t.regenerateHint}</p>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => redo.mutate({ kind: "rerender" })}
              >
                {t.rerender}
              </Button>
              <span className="text-muted-foreground text-xs">{t.rerenderHint}</span>
            </div>
          </>
        )}
        {error === null ? null : (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
