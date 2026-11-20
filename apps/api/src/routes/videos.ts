import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import {
  isYoutubeShort,
  type VideoLibraryItem,
  videoLibraryResponseSchema,
  youtubeVideoUrl,
} from "@studio/contracts";
import { listExportedVideos, type StudioDb } from "@studio/db";
import type { FastifyInstance } from "fastify";
import { readArtifactJson } from "./artifacts.js";

export type VideoRouteDeps = {
  db: StudioDb;
  dataDir: string;
};

type Frame = { width: number; height: number; durationSec: number | null };

const JOB_STATUSES = ["queued", "running", "completed", "failed", "cancelled"] as const;

function positiveInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

/** Khung và thời lượng từ render props (file bất biến theo `storage_key`, nên giữ trong bộ nhớ). */
function frameFromProps(props: unknown): Frame | null {
  if (typeof props !== "object" || props === null) {
    return null;
  }
  const record = props as { width?: unknown; height?: unknown; audio?: { durationMs?: unknown } };
  const width = positiveInt(record.width);
  const height = positiveInt(record.height);
  if (width === null || height === null) {
    return null;
  }
  const ms = record.audio?.durationMs;
  return {
    width,
    height,
    durationSec: typeof ms === "number" && ms > 0 ? Math.round(ms / 100) / 10 : null,
  };
}

/**
 * Màn Video (P8-08): chỉ đọc. Bản xuất mới nhất của mỗi run ở mọi dự án, kèm khung, thời lượng và lần đăng YouTube
 * gần nhất. Tải video và ảnh bìa đi qua route artifact có sẵn.
 */
export function registerVideoRoutes(app: FastifyInstance, deps: VideoRouteDeps): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const frames = new Map<string, Frame | null>();

  const frameOf = async (key: string | null): Promise<Frame | null> => {
    if (key === null) {
      return null;
    }
    if (!frames.has(key)) {
      frames.set(key, frameFromProps(await readArtifactJson(deps.dataDir, key)));
    }
    return frames.get(key) ?? null;
  };

  typed.get(
    "/api/videos",
    { schema: { response: { 200: videoLibraryResponseSchema } } },
    async () => {
      const rows = await listExportedVideos(deps.db);
      const videos: VideoLibraryItem[] = [];
      for (const row of rows) {
        const frame = await frameOf(row.renderPropsKey);
        const aspectRatio = row.aspectRatio === "16:9" ? "16:9" : "9:16";
        const isShort =
          frame === null
            ? aspectRatio === "9:16"
            : isYoutubeShort(frame.width, frame.height, frame.durationSec ?? 0);
        const yt = row.youtube;
        const meta = yt?.resultMetadata ?? {};
        const uploadShort = typeof meta.isShort === "boolean" ? meta.isShort : isShort;
        const str = (v: unknown) => (typeof v === "string" ? v : null);
        videos.push({
          exportArtifactId: row.exportArtifactId,
          workflowRunId: row.workflowRunId,
          projectId: row.projectId,
          projectTitle: row.projectTitle,
          topic: row.topic,
          exportedAt: row.exportedAt.toISOString(),
          aspectRatio,
          width: frame?.width ?? null,
          height: frame?.height ?? null,
          durationSec: frame?.durationSec ?? null,
          isShort,
          hasThumbnail: typeof row.exportMetadata.thumbnailKey === "string",
          youtube:
            yt === null
              ? null
              : {
                  uploadId: yt.uploadId,
                  status: (JOB_STATUSES as readonly string[]).includes(yt.status)
                    ? (yt.status as (typeof JOB_STATUSES)[number])
                    : "failed",
                  videoId: yt.videoId,
                  url: yt.videoId === null ? null : youtubeVideoUrl(yt.videoId, uploadShort),
                  isShort: uploadShort,
                  privacyStatus: str(meta.privacyStatus),
                  publishAt: str(meta.publishAt),
                },
        });
      }
      return { videos };
    },
  );
}
