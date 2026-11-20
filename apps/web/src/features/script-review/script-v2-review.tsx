import { reviewScriptV2, type ScriptReviewIssue } from "@studio/contracts";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CharacterAvatar, isCharacterKey } from "@/components/ui/character-avatar";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { vi } from "@/i18n/vi";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { StillLightbox } from "./still-lightbox";
import { useScriptLineEdits } from "./use-script-review";
import { useRunAssetRequests, VariantAssets } from "./variant-assets";

/**
 * Phần nội dung của màn duyệt kịch bản `2` (P6-17): hai phương án cạnh nhau, mỗi cảnh có ảnh storyboard,
 * vấn đề kiểm tự động và các câu thoại theo người nói. Chỉ hiển thị; quyết định duyệt dùng form chung.
 * Nội dung đã được contracts kiểm ở worker; ở đây chỉ kiểm dạng đủ để vẽ.
 */

type SceneView = {
  id: string;
  beat: string;
  sourceIds: string[];
  lines: { id: string; speaker: string; text: string }[];
  shots: { id: string }[];
};
type VariantView = {
  title: string;
  scenes: SceneView[];
  sources: { id: string; title: string }[];
};
type StoryboardView = {
  variants: {
    variantIndex: number;
    scenes: {
      sceneId: string;
      stillKey: string | null;
      issues: { code: string; message: string }[];
      /** Ảnh thêm của shot khác có minh họa hoặc đồ vật (bổ sung 2026-11-12). */
      extraStills?: { shotId: string; stillKey: string | null }[];
    }[];
  }[];
  errors: { message: string }[];
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

function isVariant(value: unknown): value is VariantView {
  return (
    isObject(value) &&
    typeof value.title === "string" &&
    Array.isArray(value.sources) &&
    Array.isArray(value.scenes) &&
    value.scenes.every(
      (scene) =>
        isObject(scene) &&
        typeof scene.id === "string" &&
        typeof scene.beat === "string" &&
        Array.isArray(scene.sourceIds) &&
        Array.isArray(scene.shots) &&
        Array.isArray(scene.lines) &&
        scene.lines.every(
          (line) =>
            isObject(line) &&
            typeof line.id === "string" &&
            typeof line.speaker === "string" &&
            typeof line.text === "string",
        ),
    )
  );
}

/** Hai phương án script `2`, hoặc `null` nếu nội dung không đúng dạng. */
export function readScriptV2(content: unknown): [VariantView, VariantView] | null {
  if (!isObject(content) || !Array.isArray(content.variants) || content.variants.length !== 2) {
    return null;
  }
  const [a, b] = content.variants;
  return isVariant(a) && isVariant(b) ? [a, b] : null;
}

/** Gợi ý tự phê bình (ADR-020) của một phương án; nội dung lạ thì không có gợi ý thay vì vỡ màn hình. */
function reviewOf(content: unknown, index: number): ScriptReviewIssue[] {
  try {
    const variant = (content as { variants: unknown[] }).variants[index];
    return reviewScriptV2(variant as Parameters<typeof reviewScriptV2>[0]);
  } catch {
    return [];
  }
}

function readStoryboard(content: unknown): StoryboardView | null {
  return isObject(content) && Array.isArray(content.variants) && Array.isArray(content.errors)
    ? (content as StoryboardView)
    : null;
}

/** Tên và màu người nói. Kênh chưa có API (P6-11) nên dùng tên tạm của dàn nhân vật mặc định. */
function stillUrl(
  artifactId: string,
  variantIndex: number,
  sceneId: string,
  shotId?: string,
): string {
  const base = `/api/artifacts/${encodeURIComponent(artifactId)}/stills/${variantIndex}/${encodeURIComponent(sceneId)}`;
  return shotId === undefined ? base : `${base}?shot=${encodeURIComponent(shotId)}`;
}

/** Ảnh storyboard bấm được: kính lúp ở góc báo là phóng to được. */
function StillThumb({
  src,
  alt,
  className,
  onOpen,
}: {
  src: string;
  alt: string;
  className: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      title={vi.scriptReview.openStill}
      aria-label={`${vi.scriptReview.openStill}: ${alt}`}
      className="group relative cursor-zoom-in rounded-lg"
      onClick={onOpen}
    >
      <img src={src} alt={alt} className={cn("rounded-lg object-cover", className)} />
      <span
        aria-hidden="true"
        className="absolute right-1 bottom-1 rounded-full bg-black/60 px-1.5 text-xs text-white group-hover:bg-black/80"
      >
        ⤢
      </span>
    </button>
  );
}

/** Người nói: tên, màu chữ của nhân vật (token đạt AA trên nền sáng và tối) và avatar ui-kit. */
function speakerStyle(speaker: string): { label: string; className: string } {
  const label = (vi.scriptReview.speakers as Record<string, string>)[speaker] ?? speaker;
  const className =
    speaker === "ti"
      ? "text-speaker-ti"
      : speaker === "bit"
        ? "text-speaker-bit"
        : speaker === "dau"
          ? "text-speaker-dau"
          : "text-foreground";
  return { label, className };
}

export function ScriptV2Review({
  runId = null,
  content,
  storyboardContent,
  storyboardArtifactId,
  storyboarding,
  scriptArtifactId = null,
  editable = false,
}: {
  runId?: string | null;
  content: unknown;
  storyboardContent: unknown;
  storyboardArtifactId: string | null;
  storyboarding: boolean;
  /** Artifact script đang xem; cùng `editable` thì cho sửa câu tại cổng (ADR-020). */
  scriptArtifactId?: string | null;
  editable?: boolean;
}) {
  const [enlarged, setEnlarged] = useState<{ src: string; alt: string } | null>(null);
  const [editing, setEditing] = useState<1 | 2 | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editError, setEditError] = useState<string | null>(null);
  const saveEdits = useScriptLineEdits(runId ?? "");
  const assetRequests = useRunAssetRequests(runId, storyboarding);
  const variants = readScriptV2(content);
  if (variants === null) {
    return <p className="text-destructive text-sm">{vi.scriptReview.loadError}</p>;
  }
  const board = readStoryboard(storyboardContent);
  // ADR-017: tài sản chưa tự tạo được không phải lỗi dựng ảnh; ảnh vẫn có, cảnh dùng tài sản thay thế.
  const assetNotices = (board?.errors ?? []).filter((e) => e.message.startsWith("tài sản "));
  const renderErrors = (board?.errors ?? []).filter((e) => !e.message.startsWith("tài sản "));
  return (
    <div className="flex flex-col gap-3">
      {storyboarding ? (
        <p role="status" className="text-muted-foreground text-sm">
          {vi.scriptReview.storyboarding}
        </p>
      ) : null}
      {renderErrors.length > 0 ? (
        <p className="text-destructive text-xs">
          {vi.scriptReview.storyboardErrors} {renderErrors.map((e) => e.message).join("; ")}
        </p>
      ) : null}
      {assetNotices.length > 0 ? (
        <p role="status" className="bg-info-bg text-info rounded-lg px-3 py-2 text-xs">
          {vi.scriptReview.assetNotice.replace("{n}", String(assetNotices.length))}
        </p>
      ) : null}
      <StillLightbox
        src={enlarged?.src ?? null}
        alt={enlarged?.alt ?? ""}
        onClose={() => setEnlarged(null)}
      />
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
        {variants.map((variant, vIndex) => {
          const lines = variant.scenes.flatMap((scene) => scene.lines);
          const shots = variant.scenes.reduce((n, scene) => n + scene.shots.length, 0);
          const boardVariant = board?.variants.find((v) => v.variantIndex === vIndex + 1);
          const variantIndex = (vIndex + 1) as 1 | 2;
          const isEditing = editing === variantIndex;
          const canEdit = editable && runId !== null && scriptArtifactId !== null;
          const save = () => {
            const edits = lines
              .filter((line) => {
                const draft = drafts[line.id];
                return draft !== undefined && draft.trim() !== line.text;
              })
              .map((line) => ({ lineId: line.id, text: (drafts[line.id] ?? "").trim() }));
            if (edits.some((e) => e.text === "")) {
              setEditError(vi.scriptReview.edit.error);
              return;
            }
            if (edits.length === 0 || scriptArtifactId === null) {
              setEditError(vi.scriptReview.edit.nothing);
              return;
            }
            setEditError(null);
            saveEdits.mutate(
              { artifactId: scriptArtifactId, variantIndex, edits },
              {
                onSuccess: (result) => {
                  const retargeted =
                    result.retargetedShots.length > 0
                      ? ` ${vi.scriptReview.edit.retargeted.replace("{n}", String(result.retargetedShots.length))}`
                      : "";
                  toast(
                    `${vi.scriptReview.edit.saved.replace("{v}", String(result.version))}${retargeted}`,
                  );
                  setEditing(null);
                  setDrafts({});
                },
                onError: (cause) =>
                  setEditError(
                    cause instanceof ApiError && cause.code === "conflict"
                      ? vi.scriptReview.edit.conflict
                      : cause instanceof ApiError && cause.code === "invalid_transition"
                        ? vi.scriptReview.edit.notWaiting
                        : vi.scriptReview.edit.error,
                  ),
              },
            );
          };
          return (
            <article
              // biome-ignore lint/suspicious/noArrayIndexKey: phương án cố định theo vị trí (PA1, PA2)
              key={vIndex}
              aria-label={`${vi.scriptReview.variant} ${vIndex + 1}`}
              className="bg-card flex flex-col gap-3 rounded-2xl border p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-xs font-semibold uppercase">
                  {vi.scriptReview.variant} {vIndex + 1}
                </span>
                {canEdit && editing === null ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(variantIndex);
                      setDrafts({});
                      setEditError(null);
                    }}
                  >
                    {vi.scriptReview.edit.start}
                  </Button>
                ) : null}
              </div>
              {isEditing ? (
                <p className="bg-info-bg text-info rounded-lg px-3 py-2 text-xs">
                  {vi.scriptReview.edit.hint}
                </p>
              ) : null}
              <h4 className="text-lg font-semibold">{variant.title}</h4>
              <span className="text-muted-foreground text-xs">
                {variant.scenes.length} {vi.scriptReview.scenesUnit} · {lines.length}{" "}
                {vi.scriptReview.linesUnit} · {shots} {vi.scriptReview.shotsUnit}
              </span>
              <ReviewHints issues={reviewOf(content, vIndex)} />
              {variant.scenes.map((scene) => {
                const still = boardVariant?.scenes.find((s) => s.sceneId === scene.id);
                return (
                  <section key={scene.id} className="flex gap-3 rounded-xl border p-2.5">
                    <div className="flex w-32 shrink-0 flex-col gap-1">
                      {still?.stillKey && storyboardArtifactId !== null ? (
                        <StillThumb
                          src={stillUrl(storyboardArtifactId, vIndex + 1, scene.id)}
                          alt={`${vi.scriptReview.stillAlt} ${scene.id}`}
                          className="aspect-[9/16] w-32"
                          onOpen={() =>
                            setEnlarged({
                              src: stillUrl(storyboardArtifactId, vIndex + 1, scene.id),
                              alt: `${vi.scriptReview.stillAlt} ${scene.id}`,
                            })
                          }
                        />
                      ) : (
                        <div className="bg-muted text-muted-foreground flex aspect-[9/16] w-32 items-center justify-center rounded text-[10px]">
                          {storyboarding ? "…" : vi.scriptReview.noStill}
                        </div>
                      )}
                      {storyboardArtifactId !== null &&
                      (still?.extraStills ?? []).some((e) => e.stillKey !== null) ? (
                        <div className="grid grid-cols-3 gap-1" data-testid="extra-stills">
                          {(still?.extraStills ?? [])
                            .filter((e) => e.stillKey !== null)
                            .map((extra) => {
                              const src = stillUrl(
                                storyboardArtifactId,
                                vIndex + 1,
                                scene.id,
                                extra.shotId,
                              );
                              const alt = `${vi.scriptReview.stillAlt} ${scene.id} ${extra.shotId}`;
                              return (
                                <StillThumb
                                  key={extra.shotId}
                                  src={src}
                                  alt={alt}
                                  className="aspect-[9/16] w-full"
                                  onOpen={() => setEnlarged({ src, alt })}
                                />
                              );
                            })}
                        </div>
                      ) : null}
                      {(still?.issues ?? []).map((issue) => (
                        <span
                          key={`${issue.code}-${issue.message}`}
                          title={issue.message}
                          className="bg-warning-bg text-warning rounded px-1 text-[10px]"
                        >
                          {issue.message}
                        </span>
                      ))}
                    </div>
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <span className="text-muted-foreground text-xs">
                        {(vi.scriptReview.beats as Record<string, string>)[scene.beat] ??
                          scene.beat}
                        {scene.sourceIds.length > 0
                          ? ` · ${vi.scriptReview.sourcesShort} ${scene.sourceIds.join(", ")}`
                          : ""}
                      </span>
                      {scene.lines.map((line) => {
                        const style = speakerStyle(line.speaker);
                        if (isEditing) {
                          return (
                            <div key={line.id} className="flex flex-col gap-1 text-sm">
                              <label
                                htmlFor={`edit-${variantIndex}-${line.id}`}
                                className={cn("text-xs font-semibold", style.className)}
                              >
                                {vi.scriptReview.edit.lineLabel} {style.label}
                              </label>
                              <Textarea
                                id={`edit-${variantIndex}-${line.id}`}
                                value={drafts[line.id] ?? line.text}
                                rows={2}
                                maxLength={300}
                                onChange={(event) =>
                                  setDrafts((d) => ({ ...d, [line.id]: event.target.value }))
                                }
                              />
                            </div>
                          );
                        }
                        return (
                          <p key={line.id} className="flex items-start gap-2 text-sm">
                            {isCharacterKey(line.speaker) ? (
                              <CharacterAvatar
                                character={line.speaker}
                                size={22}
                                className="mt-0.5"
                              />
                            ) : null}
                            <span>
                              <span className={cn("mr-1.5 font-semibold", style.className)}>
                                {style.label}:
                              </span>
                              {line.text}
                            </span>
                          </p>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
              {isEditing ? (
                <div className="flex flex-col gap-2">
                  {editError === null ? null : (
                    <p role="alert" className="text-destructive text-sm">
                      {editError}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" disabled={saveEdits.isPending} onClick={save}>
                      {saveEdits.isPending
                        ? vi.scriptReview.edit.saving
                        : vi.scriptReview.edit.save}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={saveEdits.isPending}
                      onClick={() => {
                        setEditing(null);
                        setDrafts({});
                        setEditError(null);
                      }}
                    >
                      {vi.scriptReview.edit.cancel}
                    </Button>
                  </div>
                </div>
              ) : null}
              <VariantAssets
                requests={(assetRequests.data?.requests ?? []).filter(
                  (request) => request.variantIndex === vIndex + 1,
                )}
              />
              {variant.sources.length > 0 ? (
                <ul className="text-muted-foreground flex flex-col gap-0.5 text-xs">
                  {variant.sources.map((source) => (
                    <li key={source.id}>
                      {source.id}: {source.title}
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

/** Gợi ý kiểm tự động của một phương án: cảnh báo trước, gợi ý sau; gập lại khi nhiều. */
function ReviewHints({ issues }: { issues: ScriptReviewIssue[] }) {
  if (issues.length === 0) {
    return (
      <p className="bg-success-bg text-success rounded-lg px-3 py-2 text-xs">
        {vi.scriptReview.review.clean}
      </p>
    );
  }
  const sorted = [...issues].sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === "warning" ? -1 : 1,
  );
  const warnings = issues.filter((i) => i.severity === "warning").length;
  return (
    <details className="rounded-lg border px-3 py-2 text-xs" open={warnings > 0}>
      <summary className="cursor-pointer font-semibold">
        {vi.scriptReview.review.heading
          .replace("{w}", String(warnings))
          .replace("{i}", String(issues.length - warnings))}
      </summary>
      <ul className="mt-2 flex flex-col gap-1.5">
        {sorted.map((issue) => (
          <li key={`${issue.code}-${issue.sceneId ?? ""}-${issue.message}`} className="flex gap-2">
            <span
              className={cn(
                "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold",
                issue.severity === "warning" ? "bg-warning-bg text-warning" : "bg-secondary",
              )}
            >
              {issue.severity === "warning"
                ? vi.scriptReview.review.warning
                : vi.scriptReview.review.info}
            </span>
            <span>
              {issue.sceneId === undefined ? "" : `${vi.scriptReview.scenes} ${issue.sceneId}: `}
              {issue.message}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
