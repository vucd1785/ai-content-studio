import { z } from "zod/v4";

/**
 * Bộ đăng bài (ADR-018): tiêu đề, mô tả, hashtag riêng cho YouTube, Facebook, TikTok, viết sau khi xuất video.
 * LLM viết phần nội dung (`publishCopySchema`); worker ghép phần chân cố định (AI, bản quyền, nguồn) thành
 * văn bản dán thẳng được (`publishKitSchema`). Giới hạn ký tự theo nền tảng, có chừa chỗ cho phần chân.
 */

const hashtag = z
  .string()
  .regex(/^#[\p{L}\p{N}_]{1,60}$/u, "Hashtag bắt đầu bằng # và không có khoảng trắng");

/** Phần LLM viết. */
export const publishCopySchema = z
  .object({
    youtube: z
      .object({
        /** YouTube cắt tiêu đề ở 100 ký tự. */
        title: z.string().min(5).max(100),
        /** Đoạn mở đầu mô tả; hai dòng đầu hiện trước nút "Xem thêm". */
        description: z.string().min(20).max(3500),
        /** Thẻ tìm kiếm (không có #); tổng tối đa 500 ký tự. */
        tags: z.array(z.string().min(1).max(60)).min(3).max(20),
        hashtags: z.array(hashtag).min(1).max(5),
      })
      .strict(),
    facebook: z
      .object({
        title: z.string().min(5).max(100),
        caption: z.string().min(20).max(1500),
        hashtags: z.array(hashtag).min(1).max(5),
      })
      .strict(),
    tiktok: z
      .object({
        caption: z.string().min(10).max(1500),
        hashtags: z.array(hashtag).min(3).max(8),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const tagChars = value.youtube.tags.reduce((n, t) => n + t.length + 1, 0);
    if (tagChars > 500) {
      ctx.addIssue({
        code: "custom",
        message: `Tổng thẻ YouTube ${tagChars} ký tự, tối đa 500`,
        path: ["youtube", "tags"],
      });
    }
  });

export type PublishCopy = z.infer<typeof publishCopySchema>;

/** Văn bản đã ghép, mỗi ô là một chỗ dán trên nền tảng. */
const platformText = z.object({ label: z.string().min(1), value: z.string() }).strict();

export const publishKitSchema = z
  .object({
    schemaVersion: z.literal(1),
    videoTitle: z.string().min(1),
    /** Thời lượng video (giây), để hướng dẫn chọn Shorts/Reels. */
    durationSec: z.number().int().positive(),
    /** Liên hệ bản quyền đã ghi vào phần chân; null là Director chưa điền ở Bộ nhận diện kênh. */
    copyrightContact: z.string().nullable(),
    platforms: z
      .object({
        youtube: z.array(platformText),
        facebook: z.array(platformText),
        tiktok: z.array(platformText),
      })
      .strict(),
    copy: publishCopySchema,
  })
  .strict();

export type PublishKit = z.infer<typeof publishKitSchema>;

export const PUBLISH_PLATFORMS = ["youtube", "facebook", "tiktok"] as const;
export type PublishPlatform = (typeof PUBLISH_PLATFORMS)[number];

/** Liên hệ bản quyền của kênh (GET/PUT `/api/brand-profile/contact`). */
export const brandContactSchema = z
  .object({
    brandProfileId: z.uuid(),
    displayName: z.string(),
    copyrightContact: z.string().nullable(),
  })
  .strict();

/** Tên kênh seed ở migration `0003`: còn tên này là Director chưa đặt tên kênh (ADR-021). */
export const PLACEHOLDER_CHANNEL_NAME = "Kênh mặc định";
export const CHANNEL_NAME_MAX = 60;

/** Kênh đã có tên thật: khác rỗng và khác tên seed. */
export function isChannelNameSet(name: string | null | undefined): name is string {
  const trimmed = name?.trim() ?? "";
  return trimmed !== "" && trimmed !== PLACEHOLDER_CHANNEL_NAME;
}

export const brandContactUpdateSchema = z
  .object({
    /** Email hoặc trang liên hệ; chuỗi rỗng là xóa. */
    copyrightContact: z.string().trim().max(300),
    /** Tên kênh (ADR-021): hiện ở thẻ cuối video và trong bộ đăng bài. Thiếu là giữ tên cũ. */
    displayName: z
      .string()
      .trim()
      .min(1)
      .max(CHANNEL_NAME_MAX)
      .refine((name) => !/[\n\r\t]/u.test(name))
      .optional(),
  })
  .strict();

export type BrandContact = z.infer<typeof brandContactSchema>;

/** Trả lời `POST /api/workflow-runs/:runId/publish-kit` (202). */
export const publishKitRequestResponseSchema = z.object({ status: z.literal("queued") }).strict();
