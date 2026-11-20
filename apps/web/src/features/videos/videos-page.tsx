import { type VideoLibraryItem, videoLibraryResponseSchema } from "@studio/contracts";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { vi } from "@/i18n/vi";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";

const t = vi.videos;

export const VIDEOS_QUERY_KEY = ["videos"] as const;

type YoutubeFilter = "all" | "not_uploaded" | "uploaded";
type FrameFilter = "all" | "vertical" | "wide";

/** Bỏ dấu tiếng Việt để tìm "trai dat" vẫn ra "Trái Đất". */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function formatDuration(sec: number | null): string | null {
  if (sec === null) {
    return null;
  }
  const total = Math.round(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function isUploaded(video: VideoLibraryItem): boolean {
  return video.youtube?.videoId != null;
}

/**
 * Màn Video (P8-08): chỉ đọc. Mọi bản xuất đã duyệt của các dự án, lọc theo YouTube và khung, tìm theo chủ đề.
 * Không duyệt, xóa hay đăng ở đây; đăng vẫn qua hộp xác nhận trong dự án.
 */
export function VideosPage({ onOpenProject }: { onOpenProject: (projectId: string) => void }) {
  const [query, setQuery] = useState("");
  const [youtube, setYoutube] = useState<YoutubeFilter>("all");
  const [frame, setFrame] = useState<FrameFilter>("all");
  const videos = useQuery({
    queryKey: VIDEOS_QUERY_KEY,
    queryFn: () => apiRequest("/api/videos", { schema: videoLibraryResponseSchema }),
  });
  const all = videos.data?.videos ?? [];
  const needle = fold(query.trim());
  const list = all.filter(
    (v) =>
      (needle === "" || fold(`${v.topic} ${v.projectTitle}`).includes(needle)) &&
      (youtube === "all" || (youtube === "uploaded") === isUploaded(v)) &&
      (frame === "all" || (frame === "wide") === (v.aspectRatio === "16:9")),
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-6 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{vi.shell.navVideos}</h1>
        <p className="text-muted-foreground text-sm">{t.intro}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          aria-label={t.search}
          placeholder={t.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="bg-card min-w-64 flex-1 rounded-lg border px-3 py-2 text-sm"
        />
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">{t.youtubeFilter}</legend>
          <Chip active={youtube === "all"} onClick={() => setYoutube("all")}>
            {t.all}
          </Chip>
          <Chip active={youtube === "not_uploaded"} onClick={() => setYoutube("not_uploaded")}>
            {t.notUploaded}
          </Chip>
          <Chip active={youtube === "uploaded"} onClick={() => setYoutube("uploaded")}>
            {t.uploaded}
          </Chip>
        </fieldset>
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">{t.frameFilter}</legend>
          <Chip active={frame === "all"} onClick={() => setFrame("all")}>
            {t.all}
          </Chip>
          <Chip active={frame === "vertical"} onClick={() => setFrame("vertical")}>
            {t.vertical}
          </Chip>
          <Chip active={frame === "wide"} onClick={() => setFrame("wide")}>
            {t.wide}
          </Chip>
        </fieldset>
      </div>
      {videos.isError ? (
        <p role="alert" className="text-destructive text-sm">
          {t.error}
        </p>
      ) : videos.isPending ? (
        <p className="text-muted-foreground text-sm">{vi.app.loading}</p>
      ) : all.length === 0 ? (
        <EmptyState illustration="empty_projects" title={t.empty} />
      ) : list.length === 0 ? (
        <EmptyState illustration="empty_projects" title={t.noMatch} />
      ) : (
        <>
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {t.count(list.length)}
          </p>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((video) => (
              <VideoCard key={video.exportArtifactId} video={video} onOpenProject={onOpenProject} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function VideoCard({
  video,
  onOpenProject,
}: {
  video: VideoLibraryItem;
  onOpenProject: (projectId: string) => void;
}) {
  const wide = video.aspectRatio === "16:9";
  const duration = formatDuration(video.durationSec);
  const yt = video.youtube;
  const exportedAt = new Date(video.exportedAt).toLocaleDateString("vi-VN");
  const thumbUrl = `/api/artifacts/${video.exportArtifactId}/thumbnail`;
  return (
    <li
      className="bg-card flex flex-col overflow-hidden rounded-2xl border"
      data-testid="video-card"
    >
      <div className="bg-muted relative flex h-56 items-center justify-center">
        {video.hasThumbnail ? (
          <img
            src={thumbUrl}
            alt=""
            loading="lazy"
            className={cn("h-full", wide ? "w-full object-cover" : "w-auto object-contain")}
          />
        ) : (
          <span className="text-muted-foreground text-sm">{t.noThumbnail}</span>
        )}
        <span className="absolute top-2 left-2 flex gap-1">
          <Badge>{wide ? t.wide : t.vertical}</Badge>
          {video.isShort ? <Badge>{t.short}</Badge> : null}
        </span>
        {duration === null ? null : (
          <span className="absolute right-2 bottom-2 rounded bg-black/75 px-1.5 py-0.5 text-xs font-semibold text-white">
            {duration}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className="line-clamp-2 font-semibold">{video.topic}</h2>
        <p className="text-muted-foreground text-xs">
          {t.project}: {video.projectTitle} · {t.exportedAt} {exportedAt}
        </p>
        <YoutubeLine yt={yt} />
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <Button asChild size="sm" variant="outline">
            <a href={`/api/artifacts/${video.exportArtifactId}/media`} download>
              {t.download}
            </a>
          </Button>
          {video.hasThumbnail ? (
            <Button asChild size="sm" variant="outline">
              <a href={thumbUrl} download>
                {t.downloadThumbnail}
              </a>
            </Button>
          ) : null}
          <Button size="sm" onClick={() => onOpenProject(video.projectId)}>
            {t.openProject}
          </Button>
        </div>
      </div>
    </li>
  );
}

function YoutubeLine({ yt }: { yt: VideoLibraryItem["youtube"] }) {
  if (yt === null) {
    return <p className="text-muted-foreground text-sm">{t.ytNone}</p>;
  }
  if (yt.videoId === null || yt.url === null) {
    const label =
      yt.status === "queued" ? t.ytQueued : yt.status === "running" ? t.ytRunning : t.ytFailed;
    return (
      <p className={cn("text-sm", yt.status === "failed" ? "text-destructive" : "")}>{label}</p>
    );
  }
  const privacy =
    yt.privacyStatus === null ? null : (vi.youtube.privacyNames[yt.privacyStatus] ?? null);
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm">
      {privacy === null ? null : (
        <span className="bg-success-bg text-success rounded px-1.5 py-0.5 text-xs font-semibold">
          {privacy}
        </span>
      )}
      <a
        className="text-primary font-semibold underline"
        href={yt.url}
        target="_blank"
        rel="noreferrer noopener"
      >
        {yt.isShort ? t.viewShort : t.viewVideo}
      </a>
    </p>
  );
}

function Badge({ children }: { children: string }) {
  return (
    <span className="rounded bg-black/70 px-1.5 py-0.5 text-xs font-semibold text-white">
      {children}
    </span>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-sm font-semibold",
        active ? "bg-warning-bg border-warning/50 text-foreground" : "bg-card hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
