import { Player } from "@remotion/player";
import {
  EduVerticalComposition,
  parseEduVerticalRenderProps,
  playerDurationInFrames,
} from "@studio/video/player";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useArtifact, useWorkflowRun } from "@/features/script-review/use-script-review";
import { vi } from "@/i18n/vi";
import { artifactMediaUrl } from "@/lib/media";
import { defaultArtifactId, groupArtifactVersions, isMediaArtifact } from "./artifact-versions";

/** File media có thật không (HEAD). Không có thì player phát không tiếng thay vì báo lỗi tải audio. */
function useMediaAvailable(artifactId: string) {
  return useQuery({
    queryKey: ["artifact-media", artifactId] as const,
    queryFn: async () => {
      try {
        return (
          await fetch(artifactMediaUrl(artifactId), { method: "HEAD", credentials: "same-origin" })
        ).ok;
      } catch {
        return false;
      }
    },
  });
}

/**
 * Preview và version (P2-08). Danh sách chỉ đọc mọi version artifact của run; chọn bản cũ không ghi đè gì.
 * `render_props` phát bằng `@remotion/player` ngay trên trình duyệt: không gọi render hay export.
 */
export function PreviewPanel({ runId }: { runId: string | null }) {
  const run = useWorkflowRun(runId);
  const groups = groupArtifactVersions(run.data?.artifacts ?? []);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const selectedId = chosenId ?? defaultArtifactId(groups);

  let body: React.ReactNode;
  if (runId === null) {
    body = <p className="text-muted-foreground text-sm">{vi.preview.noRun}</p>;
  } else if (run.isPending) {
    body = <p className="text-muted-foreground text-sm">{vi.app.loading}</p>;
  } else if (run.isError) {
    body = <p className="text-destructive text-sm">{vi.preview.loadError}</p>;
  } else if (groups.length === 0) {
    body = <p className="text-muted-foreground text-sm">{vi.preview.empty}</p>;
  } else {
    body = (
      <div className="flex flex-col gap-3">
        {selectedId === null ? (
          <p className="text-muted-foreground text-xs">{vi.preview.hint}</p>
        ) : (
          <ArtifactView key={selectedId} artifactId={selectedId} />
        )}
        <section aria-label={vi.preview.versionsCaption} className="flex flex-col gap-2 text-sm">
          {groups.map((group) => (
            <div key={group.type} className="flex flex-wrap items-center gap-1">
              <span className="text-muted-foreground mr-1 text-xs">
                {(vi.preview.types as Record<string, string>)[group.type] ?? group.type}
              </span>
              {group.versions.map((artifact) => (
                <Button
                  key={artifact.id}
                  type="button"
                  size="sm"
                  variant={artifact.id === selectedId ? "secondary" : "outline"}
                  aria-pressed={artifact.id === selectedId}
                  data-testid={`version-${artifact.type}-${artifact.version}`}
                  onClick={() => setChosenId(artifact.id)}
                >
                  {`${vi.preview.version} ${artifact.version}`}
                </Button>
              ))}
            </div>
          ))}
        </section>
      </div>
    );
  }

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-sm">{vi.preview.heading}</CardTitle>
      </CardHeader>
      <CardContent className="px-4">{body}</CardContent>
    </Card>
  );
}

function ArtifactView({ artifactId }: { artifactId: string }) {
  const artifact = useArtifact(artifactId);
  if (artifact.isPending) {
    return <p className="text-muted-foreground text-sm">{vi.app.loading}</p>;
  }
  if (artifact.isError) {
    return <p className="text-destructive text-sm">{vi.preview.loadError}</p>;
  }
  const { artifact: meta, content } = artifact.data;
  if (meta.type === "preview" || meta.type === "export") {
    return (
      <div className="mx-auto w-full max-w-[16rem]">
        {/* biome-ignore lint/a11y/useMediaCaption: phụ đề đã burn vào MP4 */}
        <video
          aria-label={vi.preview.video}
          data-testid="preview-video"
          src={artifactMediaUrl(meta.id)}
          controls
          preload="metadata"
          className="w-full rounded-md"
          style={{ aspectRatio: "1080 / 1920" }}
        />
      </div>
    );
  }
  if (isMediaArtifact(meta.type)) {
    return <p className="text-muted-foreground text-sm">{vi.preview.mediaNote}</p>;
  }
  if (meta.type === "render_props") {
    return <RenderPropsPlayer artifactId={meta.id} content={content} />;
  }
  return (
    <pre
      className="bg-muted max-h-64 overflow-auto rounded-md p-2 text-xs"
      data-testid="artifact-json"
    >
      {JSON.stringify(content, null, 2)}
    </pre>
  );
}

function RenderPropsPlayer({ artifactId, content }: { artifactId: string; content: unknown }) {
  const media = useMediaAvailable(artifactId);
  let parsed: ReturnType<typeof parseEduVerticalRenderProps>;
  try {
    parsed = parseEduVerticalRenderProps(content);
  } catch {
    return <p className="text-destructive text-sm">{vi.preview.invalidProps}</p>;
  }
  // Có WAV thì player phát tiếng qua route media; `src` bắt đầu bằng "/" nên composition dùng nguyên URL.
  const props =
    media.data === true
      ? { ...parsed, audio: { ...parsed.audio, src: artifactMediaUrl(artifactId) } }
      : parsed;
  return (
    <div className="flex flex-col gap-1">
      <section
        aria-label={vi.preview.player}
        data-testid="preview-player"
        className="mx-auto w-full max-w-[16rem]"
      >
        <Player
          component={EduVerticalComposition}
          inputProps={props}
          durationInFrames={Math.max(1, playerDurationInFrames(props))}
          fps={props.fps}
          compositionWidth={props.width}
          compositionHeight={props.height}
          style={{ width: "100%", aspectRatio: `${props.width} / ${props.height}` }}
          controls
        />
      </section>
      {media.data === false ? (
        <p className="text-muted-foreground text-xs">{vi.preview.noAudio}</p>
      ) : null}
    </div>
  );
}
