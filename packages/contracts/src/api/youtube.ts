import { z } from "zod/v4";

/**
 * Giới hạn văn bản và hợp đồng đăng YouTube (ADR-031). Hàm ở đây thuần, dùng chung cho worker (bộ đăng bài, job
 * đăng), API (kiểm hộp xác nhận) và web (đếm khi Director sửa).
 */

/** Tiêu đề tối đa 100 ký tự. */
export const YOUTUBE_TITLE_MAX = 100;
/** Mô tả tối đa 5.000 byte UTF-8 (không phải ký tự: chữ có dấu tốn 2–3 byte). */
export const YOUTUBE_DESCRIPTION_MAX_BYTES = 5000;
/** Tổng thẻ tối đa 500 ký tự theo cách tính của YouTube. */
export const YOUTUBE_TAGS_MAX = 500;
/** Danh mục "Giáo dục". */
export const YOUTUBE_CATEGORY_EDUCATION = "27";
/** YouTube tự xếp vào Shorts video dọc hoặc vuông dài tối đa 3 phút; API không có cờ chọn. */
export const YOUTUBE_SHORTS_MAX_SEC = 180;

/** Video có được YouTube xếp vào Shorts không (khung dọc/vuông và không quá 3 phút). */
export function isYoutubeShort(width: number, height: number, durationSec: number): boolean {
  return width > 0 && height >= width && durationSec > 0 && durationSec <= YOUTUBE_SHORTS_MAX_SEC;
}

/** Link mở video: Short dùng `/shorts/`, video thường dùng `watch?v=`. */
export function youtubeVideoUrl(videoId: string, isShort: boolean): string {
  const id = encodeURIComponent(videoId);
  return isShort ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`;
}

/** Số byte UTF-8 của chuỗi (đếm theo code point; contracts chạy cả trên trình duyệt lẫn Node). */
export function utf8Bytes(text: string): number {
  let bytes = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    bytes += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/** Số ký tự (code point), cách YouTube đếm tiêu đề. */
export function charCount(text: string): number {
  return [...text].length;
}

/** YouTube không nhận `<` và `>` trong tiêu đề và mô tả: thay bằng dấu nháy góc đơn trông gần giống. */
export function youtubeSafe(text: string): string {
  return text.replace(/</g, "‹").replace(/>/g, "›");
}

/** Cắt chuỗi cho vừa `maxBytes` byte UTF-8, ưu tiên cắt ở cuối dòng, rồi cuối từ; không cắt đôi một ký tự. */
export function truncateUtf8(text: string, maxBytes: number): string {
  if (utf8Bytes(text) <= maxBytes) {
    return text;
  }
  let out = "";
  let used = 0;
  for (const ch of text) {
    const size = utf8Bytes(ch);
    if (used + size > maxBytes) {
      break;
    }
    out += ch;
    used += size;
  }
  const line = out.lastIndexOf("\n");
  if (line >= out.length * 0.6) {
    return out.slice(0, line).trimEnd();
  }
  const word = out.lastIndexOf(" ");
  return (word >= out.length * 0.6 ? out.slice(0, word) : out).trimEnd();
}

/** Độ dài tổng của thẻ theo YouTube: dấu phẩy giữa các thẻ tính vào; thẻ có khoảng trắng tính thêm hai dấu ngoặc kép. */
export function youtubeTagsLength(tags: readonly string[]): number {
  const own = tags.reduce((n, t) => n + charCount(t) + (/\s/.test(t) ? 2 : 0), 0);
  return own + Math.max(0, tags.length - 1);
}

/** Bỏ thẻ trùng, rỗng, ký tự `<` `>` và dấu phẩy; giữ thẻ theo thứ tự cho tới khi đầy 500 ký tự. */
export function fitYoutubeTags(tags: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of tags) {
    const tag = raw.replace(/[<>,]/g, " ").replace(/\s+/g, " ").trim();
    const key = tag.toLowerCase();
    if (tag === "" || seen.has(key)) {
      continue;
    }
    if (youtubeTagsLength([...out, tag]) > YOUTUBE_TAGS_MAX) {
      continue;
    }
    seen.add(key);
    out.push(tag);
  }
  return out;
}

/**
 * Ghép mô tả: phần đầu (LLM viết, hashtag) bị cắt trước; phần chân (AI, nguồn, bản quyền) luôn còn nguyên trừ khi
 * riêng nó đã quá giới hạn.
 */
export function fitYoutubeDescription(head: string, footer: string): string {
  const safeHead = youtubeSafe(head.trim());
  const safeFooter = youtubeSafe(footer.trim());
  const sep = "\n\n";
  const room = YOUTUBE_DESCRIPTION_MAX_BYTES - utf8Bytes(safeFooter) - utf8Bytes(sep);
  if (room <= 0) {
    return truncateUtf8(safeFooter, YOUTUBE_DESCRIPTION_MAX_BYTES);
  }
  const fitted = truncateUtf8(safeHead, room);
  return fitted === "" ? safeFooter : `${fitted}${sep}${safeFooter}`;
}

/** Tiêu đề hợp lệ: bỏ `<` `>`, gọn khoảng trắng, tối đa 100 ký tự. */
export function fitYoutubeTitle(title: string): string {
  return [...youtubeSafe(title).replace(/\s+/g, " ").trim()].slice(0, YOUTUBE_TITLE_MAX).join("");
}

// ---------------------------------------------------------------------------------------------------------------
// Hộp xác nhận và kết quả đăng (ADR-031 mục 3, 4).

export const YOUTUBE_PRIVACY = ["private", "unlisted", "public"] as const;
export type YoutubePrivacy = (typeof YOUTUBE_PRIVACY)[number];

const noAngle = (s: string) => !/[<>]/.test(s);

/** Các ô của hộp xác nhận, chưa có luật chéo giữa các ô. */
const youtubeUploadFields = z
  .object({
    title: z
      .string()
      .trim()
      .min(1)
      .refine((s) => charCount(s) <= YOUTUBE_TITLE_MAX, "Tiêu đề tối đa 100 ký tự")
      .refine(noAngle, "Tiêu đề không được chứa < hoặc >"),
    description: z
      .string()
      .refine((s) => utf8Bytes(s) <= YOUTUBE_DESCRIPTION_MAX_BYTES, "Mô tả tối đa 5.000 byte")
      .refine(noAngle, "Mô tả không được chứa < hoặc >"),
    tags: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(100)
          .refine((s) => !/[<>,]/.test(s), "Thẻ không có < > ,"),
      )
      .max(60)
      .refine((t) => youtubeTagsLength(t) <= YOUTUBE_TAGS_MAX, "Tổng thẻ tối đa 500 ký tự"),
    privacy: z.enum(YOUTUBE_PRIVACY),
    /** Hẹn giờ: chỉ khi `privacy` là `private`; thời điểm ISO trong tương lai. */
    publishAt: z.iso.datetime({ offset: true }).optional(),
    /** Khai báo "Dành cho trẻ em": bắt buộc chọn mỗi lần. */
    madeForKids: z.boolean(),
    containsSyntheticMedia: z.boolean(),
    includeThumbnail: z.boolean(),
    /** Bản xuất này đã đăng: phải xác nhận lần hai mới đăng thêm một video nữa. */
    confirmRepeat: z.boolean().optional(),
  })
  .strict();

type UploadFields = z.infer<typeof youtubeUploadFields>;

function checkSchedule(v: Pick<UploadFields, "privacy" | "publishAt">, ctx: z.RefinementCtx): void {
  if (v.publishAt !== undefined) {
    if (v.privacy !== "private") {
      ctx.addIssue({
        code: "custom",
        path: ["publishAt"],
        message: "Hẹn giờ chỉ dùng với chế độ Riêng tư",
      });
    } else if (Date.parse(v.publishAt) <= Date.now()) {
      ctx.addIssue({
        code: "custom",
        path: ["publishAt"],
        message: "Giờ hẹn phải ở tương lai",
      });
    }
  }
}

/** Body của `POST /api/workflow-runs/:runId/youtube-uploads`. */
export const youtubeUploadRequestSchema = youtubeUploadFields.superRefine(checkSchedule);

export type YoutubeUploadRequest = z.infer<typeof youtubeUploadRequestSchema>;

/** Payload job `youtube_upload`: ô đã duyệt kèm trạng thái bền để thử lại không đăng trùng. */
export const youtubeUploadJobPayloadSchema = z
  .object({
    exportArtifactId: z.uuid(),
    brandProfileId: z.uuid(),
    request: youtubeUploadFields.omit({ confirmRepeat: true }),
  })
  .strict();

export type YoutubeUploadJobPayload = z.infer<typeof youtubeUploadJobPayloadSchema>;

export const YOUTUBE_THUMBNAIL_STATES = ["set", "failed", "skipped", "pending"] as const;

/** Artifact `youtube_upload` (schema 1). */
export const youtubeUploadArtifactSchema = z
  .object({
    schemaVersion: z.literal(1),
    videoId: z.string().regex(/^[A-Za-z0-9_-]{6,20}$/),
    url: z.url(),
    channelId: z.string().min(1),
    channelTitle: z.string(),
    exportArtifactId: z.uuid(),
    /** Đọc lại từ phản hồi của YouTube, không lấy từ yêu cầu. */
    privacyStatus: z.string(),
    publishAt: z.string().nullable(),
    title: z.string(),
    thumbnail: z.enum(YOUTUBE_THUMBNAIL_STATES),
    thumbnailReason: z.string().nullable(),
    /** YouTube xếp vào Shorts (đo từ file xuất); artifact cũ không có. */
    isShort: z.boolean().optional(),
    uploadedAt: z.string(),
  })
  .strict();

export type YoutubeUploadArtifact = z.infer<typeof youtubeUploadArtifactSchema>;

/** `GET /api/youtube/connection`: không có token. */
export const youtubeConnectionSchema = z
  .object({
    /** Thiếu `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` hoặc `STUDIO_TOKEN_KEY`. */
    configured: z.boolean(),
    connected: z.boolean(),
    channelId: z.string().nullable(),
    channelTitle: z.string().nullable(),
    channelThumbnail: z.string().nullable(),
    lastError: z.string().nullable(),
    connectedAt: z.string().nullable(),
    /** Client ID đang dùng, che phần giữa (ví dụ `1234…xyz.apps.googleusercontent.com`); null khi chưa có. */
    clientIdHint: z.string().nullable(),
    /** Đã có client secret (không bao giờ trả giá trị). */
    hasClientSecret: z.boolean(),
  })
  .strict();

export type YoutubeConnection = z.infer<typeof youtubeConnectionSchema>;

/** Định dạng Client ID của OAuth client Google (loại Desktop app). */
export const YOUTUBE_CLIENT_ID_REGEX =
  /^[0-9]{6,30}-[a-z0-9]{10,64}\.apps\.googleusercontent\.com$/;
/** Client secret: chữ, số, `-`, `_`; không có khoảng trắng hay xuống dòng (không chèn được dòng lạ vào `.env`). */
export const YOUTUBE_CLIENT_SECRET_REGEX = /^[A-Za-z0-9_-]{10,100}$/;

/**
 * `PUT /api/youtube/config` (ADR-031 bổ sung 2026-11-16): Director nhập Client ID và secret ở giao diện, API ghi vào
 * `.env`. Bỏ trống secret thì giữ secret cũ (chỉ đổi Client ID).
 */
export const youtubeConfigUpdateSchema = z
  .object({
    clientId: z
      .string()
      .trim()
      .regex(YOUTUBE_CLIENT_ID_REGEX, "Client ID phải có dạng ...apps.googleusercontent.com"),
    clientSecret: z
      .string()
      .trim()
      .refine(
        (s) => s === "" || YOUTUBE_CLIENT_SECRET_REGEX.test(s),
        "Client secret chỉ gồm chữ, số, - và _",
      ),
  })
  .strict();

export type YoutubeConfigUpdate = z.infer<typeof youtubeConfigUpdateSchema>;

/** Che phần giữa Client ID khi hiện lại trên giao diện. */
export function maskClientId(clientId: string): string {
  const [head = "", ...rest] = clientId.split("-");
  const tail = rest.join("-");
  return `${head.slice(0, 4)}…-${tail.slice(0, 4)}…${tail.slice(tail.indexOf("."))}`;
}

/** Mã lỗi của job đăng (ADR-031 mục 4). */
export const YOUTUBE_ERROR_CODES = [
  "youtube_quota",
  "youtube_auth",
  "youtube_rejected",
  "youtube_network",
  "youtube_not_connected",
] as const;
export type YoutubeErrorCode = (typeof YOUTUBE_ERROR_CODES)[number];

/** Một lần đăng trong `GET /api/workflow-runs/:runId/youtube-uploads`. */
export const youtubeUploadSummarySchema = z
  .object({
    id: z.uuid(),
    exportArtifactId: z.uuid(),
    status: z.enum(["queued", "running", "completed", "failed", "cancelled"]),
    videoId: z.string().nullable(),
    url: z.string().nullable(),
    /** Link là dạng `/shorts/`. */
    isShort: z.boolean(),
    privacyStatus: z.string().nullable(),
    publishAt: z.string().nullable(),
    title: z.string().nullable(),
    thumbnail: z.enum(YOUTUBE_THUMBNAIL_STATES),
    thumbnailReason: z.string().nullable(),
    errorCode: z.string().nullable(),
    errorMessage: z.string().nullable(),
    createdAt: z.string(),
  })
  .strict();

export type YoutubeUploadSummary = z.infer<typeof youtubeUploadSummarySchema>;

export const youtubeUploadListSchema = z
  .object({
    /** Có job đăng hoặc đặt lại ảnh bìa đang chờ hay đang chạy. */
    busy: z.boolean(),
    /** Lỗi của job gần nhất nếu nó lỗi (ví dụ đặt lại ảnh bìa). */
    lastError: z.object({ code: z.string().nullable(), message: z.string().nullable() }).nullable(),
    uploads: z.array(youtubeUploadSummarySchema),
  })
  .strict();

export type YoutubeUploadList = z.infer<typeof youtubeUploadListSchema>;

export const youtubeOauthStartSchema = z.object({ authUrl: z.url() }).strict();

/** Dòng nhắc thiếu liên hệ bản quyền trong mô tả (ADR-018); có dòng này thì không cho đăng. */
export const MISSING_CONTACT_MARK = "[CHƯA CÓ LIÊN HỆ";

/** `202` của `POST /api/workflow-runs/:runId/youtube-uploads`. */
export const youtubeUploadQueuedSchema = z
  .object({ status: z.literal("queued"), uploadId: z.uuid() })
  .strict();

/** `202` của `POST /api/youtube-uploads/:uploadId/thumbnail`. */
export const youtubeThumbnailQueuedSchema = z.object({ status: z.literal("queued") }).strict();
