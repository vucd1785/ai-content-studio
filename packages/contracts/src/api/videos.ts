import { z } from "zod/v4";

/** Lần đăng YouTube gần nhất của một bản xuất (P8-08). */
export const videoLibraryYoutubeSchema = z
  .object({
    uploadId: z.uuid(),
    status: z.enum(["queued", "running", "completed", "failed", "cancelled"]),
    videoId: z.string().nullable(),
    url: z.string().nullable(),
    isShort: z.boolean(),
    privacyStatus: z.string().nullable(),
    publishAt: z.string().nullable(),
  })
  .strict();

/** Một video đã duyệt và xuất trong `GET /api/videos` (P8-08). */
export const videoLibraryItemSchema = z
  .object({
    exportArtifactId: z.uuid(),
    workflowRunId: z.uuid(),
    projectId: z.uuid(),
    projectTitle: z.string(),
    topic: z.string(),
    exportedAt: z.string(),
    aspectRatio: z.enum(["9:16", "16:9"]),
    /** Đọc từ `render_props` cha; null khi không đọc được. */
    width: z.number().int().positive().nullable(),
    height: z.number().int().positive().nullable(),
    durationSec: z.number().nonnegative().nullable(),
    /** YouTube sẽ (hoặc đã) xếp vào Shorts. */
    isShort: z.boolean(),
    hasThumbnail: z.boolean(),
    youtube: videoLibraryYoutubeSchema.nullable(),
  })
  .strict();

export type VideoLibraryItem = z.infer<typeof videoLibraryItemSchema>;

export const videoLibraryResponseSchema = z
  .object({ videos: z.array(videoLibraryItemSchema) })
  .strict();

export type VideoLibraryResponse = z.infer<typeof videoLibraryResponseSchema>;
