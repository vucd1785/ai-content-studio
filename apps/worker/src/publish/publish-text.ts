import {
  fitYoutubeDescription,
  fitYoutubeTags,
  fitYoutubeTitle,
  type PublishCopy,
  type PublishKit,
} from "@studio/contracts";

/**
 * Ghép bộ đăng bài (ADR-018): nội dung LLM viết + phần chân cố định do code viết, để câu về AI, bản quyền và
 * nguồn luôn đúng, không phụ thuộc LLM. Director chọn: ghi "nội dung gốc, có hỗ trợ AI" thay vì câu fair use.
 */

export type PublishContext = {
  channelName: string;
  copyrightContact: string | null;
  videoTitle: string;
  durationSec: number;
  sources: { title: string; url?: string | undefined }[];
  /** Tên hiển thị của dàn nhân vật; LLM viết sai dấu (Bít thay Bit) thì code sửa lại (ADR-020). */
  castNames?: readonly string[];
  /** ADR-030: dòng ghi công của ảnh thật có giấy phép yêu cầu ghi công (Wikimedia Commons). */
  imageCredits?: readonly string[];
};

const stripMarks = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

/**
 * Sửa tên nhân vật viết sai dấu: một từ viết hoa chữ đầu, bỏ dấu thì trùng tên nhân vật nhưng khác cách viết,
 * được thay bằng đúng tên. Không đụng từ viết thường (ví dụ "bit" trong "bit dữ liệu").
 */
export function fixCastNames(text: string, names: readonly string[]): string {
  if (names.length === 0) {
    return text;
  }
  return text.replace(/[\p{Lu}][\p{L}\p{M}]*/gu, (word) => {
    const match = names.find((name) => name !== word && stripMarks(name) === stripMarks(word));
    return match ?? word;
  });
}

/** Dòng nhắc khi chưa có liên hệ: Director phải sửa trước khi đăng. */
export const MISSING_CONTACT = "[CHƯA CÓ LIÊN HỆ - điền ở Bộ nhận diện kênh rồi tạo lại]";

/** YouTube coi video dọc ≤ 3 phút là Shorts. */
export const SHORTS_MAX_SEC = 180;

const TIKTOK_MAX = 2200;

function contactOf(ctx: PublishContext): string {
  return ctx.copyrightContact?.trim() || MISSING_CONTACT;
}

function sourceLines(ctx: PublishContext): string[] {
  return ctx.sources.slice(0, 6).map((s) => (s.url ? `- ${s.title}: ${s.url}` : `- ${s.title}`));
}

/** Phần chân đầy đủ cho YouTube và Facebook. */
export function fullFooter(ctx: PublishContext): string {
  const parts = [
    "-----",
    "VỀ VIDEO NÀY",
    `Video do kênh ${ctx.channelName} tự sản xuất. Kịch bản, nhân vật hoạt hình, hình động và giọng đọc được làm với sự hỗ trợ của công cụ AI, rồi được người biên tập kiểm tra và duyệt trước khi đăng.`,
    "Nội dung nhằm phổ biến kiến thức, có thể đơn giản hóa để dễ hiểu.",
  ];
  const sources = sourceLines(ctx);
  if (sources.length > 0) {
    parts.push("", "NGUỒN THAM KHẢO", ...sources);
  }
  const credits = ctx.imageCredits ?? [];
  if (credits.length > 0) {
    parts.push("", "NGUỒN HÌNH ẢNH", ...credits.map((c) => `- ${c}`));
  }
  parts.push(
    "",
    "BẢN QUYỀN",
    `Nhân vật, hình ảnh và âm thanh trong video thuộc kênh ${ctx.channelName}${credits.length > 0 ? ", trừ các hình ảnh ghi ở mục Nguồn hình ảnh (dùng theo giấy phép của tác giả)" : ""}. Nếu bạn cho rằng video có nội dung vi phạm bản quyền của bạn, vui lòng liên hệ ${contactOf(ctx)}. Chúng tôi sẽ phản hồi và xử lý sớm.`,
  );
  return parts.join("\n");
}

/** Phần chân ngắn cho TikTok (chú thích ngắn hơn). */
export function shortFooter(ctx: PublishContext): string {
  const credits = ctx.imageCredits ?? [];
  const imageNote =
    credits.length > 0 ? ` Ảnh từ Wikimedia Commons, ghi nguồn đầy đủ ở mô tả YouTube.` : "";
  return `Video gốc của ${ctx.channelName}, làm với hỗ trợ AI.${imageNote} Khiếu nại bản quyền: ${contactOf(ctx)}`;
}

const uniq = (items: readonly string[]) => [...new Set(items)];

export function buildPublishKit(raw: PublishCopy, ctx: PublishContext): PublishKit {
  const copy = fixCopyNames(raw, ctx.castNames ?? []);
  const isShort = ctx.durationSec <= SHORTS_MAX_SEC;
  const ytHashtags = uniq([...copy.youtube.hashtags, ...(isShort ? ["#Shorts"] : [])]);
  // ADR-031 mục 5: YouTube tính mô tả theo 5.000 byte UTF-8 và cấm `<` `>`; phần chân luôn còn nguyên.
  const ytDescription = fitYoutubeDescription(
    [copy.youtube.description.trim(), "", ytHashtags.join(" ")].join("\n"),
    fullFooter(ctx),
  );
  const fbText = [
    copy.facebook.caption.trim(),
    "",
    uniq(copy.facebook.hashtags).join(" "),
    "",
    fullFooter(ctx),
  ].join("\n");
  const tiktokHead = [copy.tiktok.caption.trim(), uniq(copy.tiktok.hashtags).join(" ")].join(
    "\n\n",
  );
  const tiktokFooter = shortFooter(ctx);
  // Cắt phần LLM viết, không cắt phần chân, để dòng bản quyền luôn còn.
  const room = TIKTOK_MAX - tiktokFooter.length - 2;
  const tiktokText = `${tiktokHead.slice(0, Math.max(0, room))}\n\n${tiktokFooter}`;
  return {
    schemaVersion: 1,
    videoTitle: ctx.videoTitle,
    durationSec: ctx.durationSec,
    copyrightContact: ctx.copyrightContact?.trim() || null,
    platforms: {
      youtube: [
        { label: "Tiêu đề", value: fitYoutubeTitle(copy.youtube.title) },
        { label: "Mô tả", value: ytDescription },
        { label: "Thẻ (tags)", value: fitYoutubeTags(copy.youtube.tags).join(", ") },
      ],
      facebook: [
        { label: "Tiêu đề", value: copy.facebook.title.trim() },
        { label: "Mô tả", value: fbText },
      ],
      tiktok: [{ label: "Chú thích", value: tiktokText }],
    },
    copy,
  };
}

/** Áp `fixCastNames` lên mọi trường chữ của bản LLM viết (tiêu đề, mô tả, chú thích). */
function fixCopyNames(copy: PublishCopy, names: readonly string[]): PublishCopy {
  if (names.length === 0) {
    return copy;
  }
  const fix = (value: unknown): unknown =>
    typeof value === "string"
      ? fixCastNames(value, names)
      : Array.isArray(value)
        ? value.map(fix)
        : typeof value === "object" && value !== null
          ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fix(v)]))
          : value;
  return fix(copy) as PublishCopy;
}
