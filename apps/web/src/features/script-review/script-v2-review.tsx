import { vi } from "@/i18n/vi";
import { cn } from "@/lib/utils";

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

function readStoryboard(content: unknown): StoryboardView | null {
  return isObject(content) && Array.isArray(content.variants) && Array.isArray(content.errors)
    ? (content as StoryboardView)
    : null;
}

/** Tên và màu người nói. Kênh chưa có API (P6-11) nên dùng tên tạm của dàn nhân vật mặc định. */
function stillUrl(artifactId: string, variantIndex: number, sceneId: string): string {
  return `/api/artifacts/${encodeURIComponent(artifactId)}/stills/${variantIndex}/${encodeURIComponent(sceneId)}`;
}

function speakerStyle(speaker: string): { label: string; className: string } {
  const label = (vi.scriptReview.speakers as Record<string, string>)[speaker] ?? speaker;
  const className =
    speaker === "ti"
      ? "bg-orange-100 text-orange-900"
      : speaker === "bit"
        ? "bg-cyan-100 text-cyan-900"
        : speaker === "dau"
          ? "bg-green-100 text-green-900"
          : "bg-secondary";
  return { label, className };
}

export function ScriptV2Review({
  content,
  storyboardContent,
  storyboardArtifactId,
  storyboarding,
}: {
  content: unknown;
  storyboardContent: unknown;
  storyboardArtifactId: string | null;
  storyboarding: boolean;
}) {
  const variants = readScriptV2(content);
  if (variants === null) {
    return <p className="text-destructive text-sm">{vi.scriptReview.loadError}</p>;
  }
  const board = readStoryboard(storyboardContent);
  return (
    <div className="flex flex-col gap-3">
      {storyboarding ? (
        <p role="status" className="text-muted-foreground text-sm">
          {vi.scriptReview.storyboarding}
        </p>
      ) : null}
      {board !== null && board.errors.length > 0 ? (
        <p className="text-destructive text-xs">
          {vi.scriptReview.storyboardErrors} {board.errors.map((e) => e.message).join("; ")}
        </p>
      ) : null}
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
        {variants.map((variant, vIndex) => {
          const lines = variant.scenes.flatMap((scene) => scene.lines);
          const shots = variant.scenes.reduce((n, scene) => n + scene.shots.length, 0);
          const boardVariant = board?.variants.find((v) => v.variantIndex === vIndex + 1);
          return (
            <article
              // biome-ignore lint/suspicious/noArrayIndexKey: phương án cố định theo vị trí (PA1, PA2)
              key={vIndex}
              aria-label={`${vi.scriptReview.variant} ${vIndex + 1}`}
              className="bg-card flex flex-col gap-3 rounded-xl border p-4"
            >
              <span className="text-muted-foreground text-xs">
                {vi.scriptReview.variant} {vIndex + 1}
              </span>
              <h4 className="text-base font-semibold">{variant.title}</h4>
              <span className="text-muted-foreground text-xs">
                {variant.scenes.length} {vi.scriptReview.scenesUnit} · {lines.length}{" "}
                {vi.scriptReview.linesUnit} · {shots} {vi.scriptReview.shotsUnit}
              </span>
              {variant.scenes.map((scene) => {
                const still = boardVariant?.scenes.find((s) => s.sceneId === scene.id);
                return (
                  <section key={scene.id} className="flex gap-3 rounded-lg border p-2">
                    <div className="flex w-24 shrink-0 flex-col gap-1">
                      {still?.stillKey && storyboardArtifactId !== null ? (
                        <a
                          href={stillUrl(storyboardArtifactId, vIndex + 1, scene.id)}
                          target="_blank"
                          rel="noreferrer"
                          title={vi.scriptReview.openStill}
                        >
                          <img
                            src={stillUrl(storyboardArtifactId, vIndex + 1, scene.id)}
                            alt={`${vi.scriptReview.stillAlt} ${scene.id}`}
                            className="aspect-[9/16] w-24 rounded object-cover"
                          />
                        </a>
                      ) : (
                        <div className="bg-muted text-muted-foreground flex aspect-[9/16] w-24 items-center justify-center rounded text-[10px]">
                          {storyboarding ? "…" : vi.scriptReview.noStill}
                        </div>
                      )}
                      {(still?.issues ?? []).map((issue) => (
                        <span
                          key={`${issue.code}-${issue.message}`}
                          title={issue.message}
                          className="rounded bg-amber-100 px-1 text-[10px] text-amber-900"
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
                        return (
                          <p key={line.id} className="text-sm">
                            <span
                              className={cn(
                                "mr-1.5 rounded px-1.5 py-0.5 text-[11px] font-medium",
                                style.className,
                              )}
                            >
                              {style.label}
                            </span>
                            {line.text}
                          </p>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
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
