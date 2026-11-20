import {
  charCount,
  MISSING_CONTACT_MARK,
  type PublishKit,
  publishKitSchema,
  utf8Bytes,
  YOUTUBE_DESCRIPTION_MAX_BYTES,
  YOUTUBE_TAGS_MAX,
  YOUTUBE_TITLE_MAX,
  type YoutubeUploadRequest,
  type YoutubeUploadSummary,
  youtubeTagsLength,
  youtubeThumbnailQueuedSchema,
  youtubeUploadQueuedSchema,
  youtubeUploadRequestSchema,
} from "@studio/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { useArtifact } from "@/features/script-review/use-script-review";
import { vi } from "@/i18n/vi";
import { apiRequest } from "@/lib/api";
import { artifactThumbnailUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import { useYoutubeConnection, useYoutubeUploads, youtubeUploadsKey } from "./use-youtube";

const t = vi.youtube;
type RunArtifact = { id: string; type: string; version: number };
type PrivacyChoice = "private" | "unlisted" | "public" | "schedule";

const latestOf = (artifacts: RunArtifact[], type: string) =>
  artifacts
    .filter((a) => a.type === type)
    .reduce<RunArtifact | null>(
      (best, a) => (best === null || a.version > best.version ? a : best),
      null,
    );

/** Ô YouTube của bộ đăng bài (ADR-018): tiêu đề, mô tả, thẻ để điền sẵn hộp xác nhận. */
function youtubeFields(kit: PublishKit | null) {
  const field = (label: string) =>
    kit?.platforms.youtube.find((f) => f.label === label)?.value ?? "";
  return {
    title: field("Tiêu đề"),
    description: field("Mô tả"),
    tags: field("Thẻ (tags)"),
  };
}

const splitTags = (raw: string) =>
  raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "");

/** `datetime-local` (giờ máy) → ISO có múi giờ. */
const localToIso = (value: string) => (value === "" ? undefined : new Date(value).toISOString());

/**
 * Đăng lên YouTube (ADR-031 mục 3) ở tab Bản cuối: danh sách các lần đăng của run và hộp xác nhận. Không tự đăng;
 * mọi lần đăng đi qua hộp xác nhận, nơi Director xem lại tên kênh, chế độ hiển thị và khai báo "Dành cho trẻ em".
 */
export function YoutubeUploadPanel({
  runId,
  artifacts,
}: {
  runId: string;
  artifacts: RunArtifact[];
}) {
  const connection = useYoutubeConnection();
  const uploads = useYoutubeUploads(runId);
  const exported = latestOf(artifacts, "export");
  const kitRow = latestOf(artifacts, "publish_kit");
  const kitArtifact = useArtifact(kitRow?.id ?? null);
  const parsedKit = publishKitSchema.safeParse(kitArtifact.data?.content);
  const kit = parsedKit.success ? parsedKit.data : null;
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const thumbRetry = useMutation({
    mutationFn: (uploadId: string) =>
      apiRequest(`/api/youtube-uploads/${encodeURIComponent(uploadId)}/thumbnail`, {
        method: "POST",
        schema: youtubeThumbnailQueuedSchema,
      }),
    onSuccess: () => {
      toast(t.thumbQueued);
      return queryClient.invalidateQueries({ queryKey: youtubeUploadsKey(runId) });
    },
    onError: (error) => toast(error instanceof Error ? error.message : t.error),
  });

  const conn = connection.data;
  const list = uploads.data?.uploads ?? [];
  const forThisExport = list.filter((u) => u.exportArtifactId === exported?.id);
  const alreadyUploaded = forThisExport.some((u) => u.videoId !== null);
  const busy = uploads.data?.busy === true;

  return (
    <section
      aria-labelledby="youtube-upload-heading"
      className="flex flex-col gap-3 rounded-2xl border p-4"
      data-testid="youtube-upload"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id="youtube-upload-heading" className="text-base font-semibold">
            {t.panelHeading}
          </h3>
          <p className="text-muted-foreground text-sm">{t.panelIntro}</p>
        </div>
        {conn?.configured === true && conn.connected && exported !== null ? (
          <Button disabled={busy || kit === null} onClick={() => setOpen(true)}>
            {alreadyUploaded ? t.uploadAgain : t.upload}
          </Button>
        ) : null}
      </div>
      {conn === undefined ? null : !conn.configured || !conn.connected ? (
        <p className="bg-warning-bg text-foreground rounded-lg px-3 py-2 text-sm" role="note">
          {t.panelNotConnected}{" "}
          <a className="font-semibold underline" href="#/brand">
            {t.panelConnectLink}
          </a>
        </p>
      ) : null}
      {conn?.lastError ? (
        <p role="alert" className="text-destructive text-sm">
          <span className="font-semibold">{t.needReconnect}:</span> {conn.lastError}
        </p>
      ) : null}
      {conn?.connected === true && kit === null ? (
        <p className="text-muted-foreground text-sm">{t.needKit}</p>
      ) : null}
      {busy ? (
        <p role="status" className="text-muted-foreground text-sm">
          {t.busy}
        </p>
      ) : null}
      {!busy && uploads.data?.lastError ? (
        <p role="alert" className="text-destructive text-sm">
          {uploads.data.lastError.message}
        </p>
      ) : null}
      {list.length === 0 ? null : (
        <ul className="flex flex-col gap-2" aria-label={t.panelHeading}>
          {list.map((u) => (
            <UploadRow
              key={u.id}
              upload={u}
              retrying={thumbRetry.isPending}
              disabled={busy}
              onRetryThumbnail={() => thumbRetry.mutate(u.id)}
            />
          ))}
        </ul>
      )}
      {open && kit !== null && exported !== null && conn?.channelTitle ? (
        <YoutubeUploadDialog
          runId={runId}
          exportId={exported.id}
          channelTitle={conn.channelTitle}
          defaults={youtubeFields(kit)}
          alreadyUploaded={alreadyUploaded}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </section>
  );
}

function UploadRow({
  upload,
  retrying,
  disabled,
  onRetryThumbnail,
}: {
  upload: YoutubeUploadSummary;
  retrying: boolean;
  disabled: boolean;
  onRetryThumbnail: () => void;
}) {
  const status =
    upload.videoId !== null
      ? t.statusDone
      : upload.status === "failed"
        ? t.statusFailed
        : upload.status === "running"
          ? t.statusRunning
          : t.statusQueued;
  const privacy =
    upload.publishAt !== null
      ? `${t.scheduledAt} ${new Date(upload.publishAt).toLocaleString("vi-VN")}`
      : upload.privacyStatus === null
        ? null
        : (t.privacyNames[upload.privacyStatus] ?? upload.privacyStatus);
  const thumb = {
    set: t.thumbSet,
    failed: t.thumbFailed,
    skipped: t.thumbSkipped,
    pending: t.thumbPending,
  }[upload.thumbnail];
  return (
    <li
      className="bg-card flex flex-col gap-1 rounded-xl border px-3 py-2 text-sm"
      data-testid="youtube-upload-row"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-semibold",
            upload.videoId !== null
              ? "bg-success-bg text-success"
              : upload.status === "failed"
                ? "bg-destructive/10 text-destructive"
                : "bg-muted",
          )}
        >
          {status}
        </span>
        <span className="min-w-0 flex-1 truncate font-semibold">{upload.title}</span>
        {privacy === null ? null : <span className="text-muted-foreground text-xs">{privacy}</span>}
        {upload.url === null ? null : (
          <a
            className="text-primary font-semibold underline"
            href={upload.url}
            target="_blank"
            rel="noreferrer noopener"
          >
            {upload.isShort ? t.viewShort : t.view}
          </a>
        )}
      </div>
      {upload.videoId === null && upload.status === "failed" && upload.errorMessage ? (
        <p className="text-destructive text-xs">{upload.errorMessage}</p>
      ) : null}
      {upload.videoId === null ? null : (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">
            {thumb}
            {upload.thumbnailReason ? ` (${upload.thumbnailReason})` : ""}
          </span>
          {upload.thumbnail === "failed" ? (
            <Button
              size="sm"
              variant="outline"
              disabled={retrying || disabled}
              onClick={onRetryThumbnail}
            >
              {t.thumbRetry}
            </Button>
          ) : null}
        </div>
      )}
    </li>
  );
}

function Counter({ used, max, unit }: { used: number; max: number; unit: string }) {
  return (
    <span
      className={cn(
        "text-xs tabular-nums",
        used > max ? "text-destructive font-semibold" : "text-muted-foreground",
      )}
    >
      {used.toLocaleString("vi-VN")}/{max.toLocaleString("vi-VN")} {unit}
    </span>
  );
}

export function YoutubeUploadDialog({
  runId,
  exportId,
  channelTitle,
  defaults,
  alreadyUploaded,
  onClose,
}: {
  runId: string;
  exportId: string;
  channelTitle: string;
  defaults: { title: string; description: string; tags: string };
  alreadyUploaded: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(defaults.title);
  const [description, setDescription] = useState(defaults.description);
  const [tags, setTags] = useState(defaults.tags);
  const [privacy, setPrivacy] = useState<PrivacyChoice>("private");
  const [scheduleAt, setScheduleAt] = useState("");
  const [kids, setKids] = useState<boolean | null>(null);
  const [synthetic, setSynthetic] = useState(false);
  const [thumbnail, setThumbnail] = useState(true);
  const [repeat, setRepeat] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog !== null && !dialog.open) {
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
    }
  }, []);

  const body = useMemo((): YoutubeUploadRequest | null => {
    if (kids === null) {
      return null;
    }
    const publishAt = privacy === "schedule" ? localToIso(scheduleAt) : undefined;
    const candidate = {
      title: title.trim(),
      description,
      tags: splitTags(tags),
      privacy: privacy === "schedule" ? "private" : privacy,
      ...(publishAt === undefined ? {} : { publishAt }),
      madeForKids: kids,
      containsSyntheticMedia: synthetic,
      includeThumbnail: thumbnail,
      ...(alreadyUploaded ? { confirmRepeat: repeat } : {}),
    };
    const parsed = youtubeUploadRequestSchema.safeParse(candidate);
    return parsed.success ? parsed.data : null;
  }, [
    title,
    description,
    tags,
    privacy,
    scheduleAt,
    kids,
    synthetic,
    thumbnail,
    alreadyUploaded,
    repeat,
  ]);

  const missingContact = description.includes(MISSING_CONTACT_MARK);
  const scheduleMissing = privacy === "schedule" && localToIso(scheduleAt) === undefined;
  const canSubmit =
    body !== null && !missingContact && !scheduleMissing && (!alreadyUploaded || repeat);

  const submit = useMutation({
    mutationFn: (payload: YoutubeUploadRequest) =>
      apiRequest(`/api/workflow-runs/${encodeURIComponent(runId)}/youtube-uploads`, {
        method: "POST",
        body: payload,
        schema: youtubeUploadQueuedSchema,
      }),
    onSuccess: () => {
      toast(t.queued);
      onClose();
      return queryClient.invalidateQueries({ queryKey: youtubeUploadsKey(runId) });
    },
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (canSubmit && body !== null) {
      submit.mutate(body);
    }
  };

  const tagList = splitTags(tags);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="bg-card text-card-foreground m-auto max-h-[90vh] w-[min(44rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border p-6 shadow-xl backdrop:bg-black/40"
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" data-testid="youtube-upload-dialog">
        <div>
          <h2 id={titleId} className="text-lg font-semibold">
            {t.dialogTitle}
          </h2>
          <p className="text-sm">
            {t.toChannel} <span className="font-semibold">{channelTitle}</span>
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="yt-title">{t.title}</Label>
            <Counter used={charCount(title.trim())} max={YOUTUBE_TITLE_MAX} unit={t.chars} />
          </div>
          <Input id="yt-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="yt-description">{t.description}</Label>
            <Counter
              used={utf8Bytes(description)}
              max={YOUTUBE_DESCRIPTION_MAX_BYTES}
              unit={t.bytes}
            />
          </div>
          <Textarea
            id="yt-description"
            value={description}
            rows={8}
            onChange={(e) => setDescription(e.target.value)}
          />
          {missingContact ? (
            <p role="alert" className="text-destructive text-xs">
              {t.missingContact}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="yt-tags">{t.tags}</Label>
            <Counter used={youtubeTagsLength(tagList)} max={YOUTUBE_TAGS_MAX} unit={t.chars} />
          </div>
          <Input id="yt-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold">{t.privacy}</legend>
          <div className="flex flex-wrap gap-3">
            {(["private", "unlisted", "public", "schedule"] as const).map((p) => (
              <label key={p} className="flex items-center gap-1 text-sm">
                <input
                  type="radio"
                  name="yt-privacy"
                  value={p}
                  checked={privacy === p}
                  onChange={() => setPrivacy(p)}
                />
                {t.privacyNames[p]}
              </label>
            ))}
          </div>
          {privacy === "schedule" ? (
            <div className="flex flex-col gap-1">
              <Label htmlFor="yt-schedule">{t.scheduleAt}</Label>
              <Input
                id="yt-schedule"
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
              />
            </div>
          ) : null}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold">{t.kids}</legend>
          <p className="text-muted-foreground text-xs">{t.kidsHint}</p>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-1 text-sm">
              <input
                type="radio"
                name="yt-kids"
                checked={kids === true}
                onChange={() => setKids(true)}
              />
              {t.kidsYes}
            </label>
            <label className="flex items-center gap-1 text-sm">
              <input
                type="radio"
                name="yt-kids"
                checked={kids === false}
                onChange={() => setKids(false)}
              />
              {t.kidsNo}
            </label>
          </div>
        </fieldset>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={synthetic}
            onChange={(e) => setSynthetic(e.target.checked)}
          />
          <span>
            {t.synthetic}
            <span className="text-muted-foreground block text-xs">{t.syntheticHint}</span>
          </span>
        </label>

        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={thumbnail}
            onChange={(e) => setThumbnail(e.target.checked)}
          />
          <span className="flex-1">{t.thumbnail}</span>
          <img
            src={artifactThumbnailUrl(exportId)}
            alt=""
            className="h-16 rounded border object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </label>

        {alreadyUploaded ? (
          <label className="bg-warning-bg flex items-start gap-2 rounded-xl px-3 py-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={repeat}
              onChange={(e) => setRepeat(e.target.checked)}
            />
            <span>{t.repeat}</span>
          </label>
        ) : null}

        {submit.isError ? (
          <p role="alert" className="text-destructive text-sm">
            {submit.error instanceof Error && submit.error.message !== ""
              ? submit.error.message
              : t.error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} autoFocus>
            {t.cancel}
          </Button>
          <Button type="submit" disabled={!canSubmit || submit.isPending}>
            {t.submit}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
