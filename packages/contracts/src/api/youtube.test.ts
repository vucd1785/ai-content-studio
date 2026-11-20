import { describe, expect, it } from "vitest";
import {
  charCount,
  fitYoutubeDescription,
  fitYoutubeTags,
  fitYoutubeTitle,
  isYoutubeShort,
  truncateUtf8,
  utf8Bytes,
  YOUTUBE_DESCRIPTION_MAX_BYTES,
  youtubeTagsLength,
  youtubeUploadArtifactSchema,
  youtubeUploadJobPayloadSchema,
  youtubeUploadRequestSchema,
  youtubeVideoUrl,
} from "./youtube.js";

describe("giới hạn văn bản YouTube (ADR-031 mục 5)", () => {
  it("đếm byte UTF-8: chữ có dấu tốn hơn một byte", () => {
    expect(utf8Bytes("a")).toBe(1);
    expect(utf8Bytes("ệ")).toBe(3);
    expect(charCount("Việt Nam")).toBe(8);
  });

  it("cắt theo byte không cắt đôi ký tự, ưu tiên cuối từ", () => {
    const out = truncateUtf8("Những điều thú vị về đom đóm", 20);
    expect(utf8Bytes(out)).toBeLessThanOrEqual(20);
    expect(out.endsWith(" ")).toBe(false);
    expect("Những điều thú vị về đom đóm".startsWith(out)).toBe(true);
  });

  it("mô tả tiếng Việt dài: ≤ 5.000 byte, phần chân còn nguyên, không có < >", () => {
    const head = `Mở đầu <b>đậm</b>\n${"Đom đóm phát sáng nhờ phản ứng hóa học trong bụng. ".repeat(200)}`;
    const footer = "-----\nNGUỒN HÌNH ẢNH\n- Ảnh A\n\nBẢN QUYỀN\nLiên hệ lienhe@example.com";
    expect(head.length).toBeLessThan(12_000);
    const out = fitYoutubeDescription(head, footer);
    expect(utf8Bytes(out)).toBeLessThanOrEqual(YOUTUBE_DESCRIPTION_MAX_BYTES);
    expect(out.endsWith(footer)).toBe(true);
    expect(out).not.toMatch(/[<>]/);
    expect(out.startsWith("Mở đầu ‹b›đậm‹/b›")).toBe(true);
  });

  it("mô tả ngắn giữ nguyên", () => {
    expect(fitYoutubeDescription("Xin chào", "Chân")).toBe("Xin chào\n\nChân");
  });

  it("thẻ: tính dấu phẩy và ngoặc kép cho thẻ có khoảng trắng; cắt cho vừa 500", () => {
    expect(youtubeTagsLength(["Foo-Baz"])).toBe(7);
    expect(youtubeTagsLength(["Foo Baz"])).toBe(9);
    expect(youtubeTagsLength(["a", "b"])).toBe(3);
    const many = Array.from({ length: 80 }, (_, i) => `khoa học vui ${i}`);
    const fitted = fitYoutubeTags([...many, "khoa học vui 1", "<x>"]);
    expect(youtubeTagsLength(fitted)).toBeLessThanOrEqual(500);
    expect(new Set(fitted).size).toBe(fitted.length);
    expect(fitted.join()).not.toMatch(/[<>]/);
  });

  it("tiêu đề: bỏ < >, tối đa 100 ký tự", () => {
    const t = fitYoutubeTitle(`<Vì sao> ${"đ".repeat(150)}`);
    expect(charCount(t)).toBe(100);
    expect(t.startsWith("‹Vì sao›")).toBe(true);
  });
});

describe("hộp xác nhận đăng YouTube", () => {
  const base = {
    title: "Vì sao đom đóm phát sáng?",
    description: "Mô tả",
    tags: ["đom đóm"],
    privacy: "private",
    madeForKids: false,
    containsSyntheticMedia: false,
    includeThumbnail: true,
  } as const;

  it("nhận yêu cầu hợp lệ; thiếu 'Dành cho trẻ em' bị từ chối", () => {
    expect(youtubeUploadRequestSchema.safeParse(base).success).toBe(true);
    const { madeForKids: _, ...missing } = base;
    expect(youtubeUploadRequestSchema.safeParse(missing).success).toBe(false);
  });

  it("từ chối < > trong tiêu đề, mô tả quá 5.000 byte, trường lạ", () => {
    expect(youtubeUploadRequestSchema.safeParse({ ...base, title: "a<b" }).success).toBe(false);
    expect(
      youtubeUploadRequestSchema.safeParse({ ...base, description: "ệ".repeat(1700) }).success,
    ).toBe(false);
    expect(youtubeUploadRequestSchema.safeParse({ ...base, extra: 1 }).success).toBe(false);
  });

  it("hẹn giờ chỉ với Riêng tư và ở tương lai", () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    const past = new Date(Date.now() - 3_600_000).toISOString();
    expect(youtubeUploadRequestSchema.safeParse({ ...base, publishAt: future }).success).toBe(true);
    expect(
      youtubeUploadRequestSchema.safeParse({ ...base, privacy: "public", publishAt: future })
        .success,
    ).toBe(false);
    expect(youtubeUploadRequestSchema.safeParse({ ...base, publishAt: past }).success).toBe(false);
  });

  it("payload job không mang confirmRepeat; artifact kiểm videoId", () => {
    const id = "6f1c2b7e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
    expect(
      youtubeUploadJobPayloadSchema.safeParse({
        exportArtifactId: id,
        brandProfileId: id,
        request: { ...base, confirmRepeat: true },
      }).success,
    ).toBe(false);
    const art = {
      schemaVersion: 1,
      videoId: "dQw4w9WgXcQ",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      channelId: "UC123",
      channelTitle: "Tí Hay Hỏi",
      exportArtifactId: id,
      privacyStatus: "private",
      publishAt: null,
      title: "t",
      thumbnail: "set",
      thumbnailReason: null,
      uploadedAt: new Date().toISOString(),
    };
    expect(youtubeUploadArtifactSchema.safeParse(art).success).toBe(true);
    expect(youtubeUploadArtifactSchema.safeParse({ ...art, videoId: "../x" }).success).toBe(false);
  });
});

describe("link Short hay video thường", () => {
  it("dọc hoặc vuông tối đa 3 phút là Short; ngang hoặc dài hơn là video thường", () => {
    expect(isYoutubeShort(1080, 1920, 68.1)).toBe(true);
    expect(isYoutubeShort(1080, 1080, 180)).toBe(true);
    expect(isYoutubeShort(1080, 1920, 181)).toBe(false);
    expect(isYoutubeShort(1920, 1080, 60)).toBe(false);
    expect(isYoutubeShort(0, 0, 0)).toBe(false);
    expect(youtubeVideoUrl("B2_fwhKvE4o", true)).toBe("https://www.youtube.com/shorts/B2_fwhKvE4o");
    expect(youtubeVideoUrl("B2_fwhKvE4o", false)).toBe(
      "https://www.youtube.com/watch?v=B2_fwhKvE4o",
    );
  });
});
