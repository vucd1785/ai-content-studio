import { type PublishCopy, publishCopySchema, publishKitSchema } from "@studio/contracts";
import { describe, expect, it } from "vitest";
import { buildPublishKit, fixCastNames, MISSING_CONTACT } from "./publish-text.js";

const COPY: PublishCopy = {
  youtube: {
    title: "Vì sao bầu trời màu xanh? Giải thích trong 90 giây",
    description:
      "Trời xanh không phải vì phản chiếu nước biển!\nCùng Tí, Đậu và Bit tìm hiểu ánh sáng Mặt Trời và không khí.",
    tags: ["bầu trời màu xanh", "tán xạ ánh sáng", "khoa học vui"],
    hashtags: ["#KhoaHocVui", "#BauTroi"],
  },
  facebook: {
    title: "Vì sao trời xanh mà hoàng hôn lại đỏ?",
    caption: "Bạn có biết trời xanh là nhờ không khí? Xem Bit giải thích nhé. Bạn đoán đúng không?",
    hashtags: ["#KhoaHocVui"],
  },
  tiktok: {
    caption: "Trời xanh vì biển? Sai rồi!",
    hashtags: ["#KhoaHoc", "#HocVui", "#BauTroi"],
  },
};

const CTX = {
  channelName: "Tí và Bit",
  copyrightContact: "lienhe@example.com",
  videoTitle: "Vì sao bầu trời màu xanh?",
  durationSec: 92,
  sources: [{ title: "NASA Space Place", url: "https://spaceplace.nasa.gov/blue-sky/" }],
};

describe("bộ đăng bài (ADR-018)", () => {
  it("mỗi nền tảng có ô riêng; mô tả có AI, nguồn, liên hệ bản quyền; video ≤ 3 phút có #Shorts", () => {
    expect(publishCopySchema.parse(COPY)).toBeTruthy();
    const kit = publishKitSchema.parse(buildPublishKit(COPY, CTX));
    const yt = Object.fromEntries(kit.platforms.youtube.map((f) => [f.label, f.value]));
    expect(yt["Tiêu đề"]).toBe(COPY.youtube.title);
    expect(yt["Mô tả"]).toContain("#KhoaHocVui #BauTroi #Shorts");
    expect(yt["Mô tả"]).toContain("hỗ trợ của công cụ AI");
    expect(yt["Mô tả"]).toContain("NASA Space Place: https://spaceplace.nasa.gov/blue-sky/");
    expect(yt["Mô tả"]).toContain("vui lòng liên hệ lienhe@example.com");
    expect(yt["Thẻ (tags)"]).toBe("bầu trời màu xanh, tán xạ ánh sáng, khoa học vui");
    expect(kit.platforms.facebook.map((f) => f.label)).toEqual(["Tiêu đề", "Mô tả"]);
    const tiktok = kit.platforms.tiktok[0]?.value ?? "";
    expect(tiktok).toContain("#KhoaHoc #HocVui #BauTroi");
    expect(tiktok).toContain("hỗ trợ AI");
    expect(tiktok.length).toBeLessThanOrEqual(2200);
  });

  it("chưa có liên hệ: mọi mô tả có dòng nhắc rõ; video dài hơn 3 phút không có #Shorts", () => {
    const kit = buildPublishKit(COPY, { ...CTX, copyrightContact: "  ", durationSec: 200 });
    expect(kit.copyrightContact).toBeNull();
    for (const field of [
      ...kit.platforms.youtube,
      ...kit.platforms.facebook,
      ...kit.platforms.tiktok,
    ]) {
      if (field.label === "Mô tả" || field.label === "Chú thích") {
        expect(field.value).toContain(MISSING_CONTACT);
      }
    }
    expect(kit.platforms.youtube[1]?.value).not.toContain("#Shorts");
  });

  it("chú thích TikTok quá dài bị cắt ở phần LLM viết, dòng bản quyền vẫn còn", () => {
    const long = { ...COPY, tiktok: { ...COPY.tiktok, caption: "a".repeat(1500) } };
    const kit = buildPublishKit(long, {
      ...CTX,
      channelName: "K".repeat(900),
    });
    const value = kit.platforms.tiktok[0]?.value ?? "";
    expect(value.length).toBeLessThanOrEqual(2200);
    expect(value.endsWith("lienhe@example.com")).toBe(true);
  });

  it("YouTube (ADR-031): mô tả tiếng Việt dài ≤ 5.000 byte, chân và nguồn hình còn; không có < >", () => {
    const long = {
      ...COPY,
      youtube: {
        ...COPY.youtube,
        title: "Vì sao <trời> xanh?",
        description: `Ánh sáng <xanh> tán xạ mạnh hơn. ${"Đây là đoạn giải thích rất dài. ".repeat(110)}`,
      },
    };
    const credits = Array.from({ length: 6 }, (_, i) => `"Ảnh ${i}" – Tác giả, CC BY-SA 4.0`);
    const kit = buildPublishKit(long, { ...CTX, imageCredits: credits });
    const yt = Object.fromEntries(kit.platforms.youtube.map((f) => [f.label, f.value]));
    const description = yt["Mô tả"] ?? "";
    expect(long.youtube.description.length).toBeLessThan(5000);
    expect(new TextEncoder().encode(description).length).toBeLessThanOrEqual(5000);
    expect(description).toContain("NGUỒN HÌNH ẢNH");
    expect(description).toContain(credits[5]);
    expect(description.endsWith("Chúng tôi sẽ phản hồi và xử lý sớm.")).toBe(true);
    expect(description).not.toMatch(/[<>]/);
    expect(yt["Tiêu đề"]).toBe("Vì sao ‹trời› xanh?");
  });

  it("hashtag có khoảng trắng hoặc thiếu # bị Zod chặn để LLM sửa", () => {
    const bad = { ...COPY, tiktok: { ...COPY.tiktok, hashtags: ["#Khoa Hoc", "HocVui", "#Ok"] } };
    expect(publishCopySchema.safeParse(bad).success).toBe(false);
  });
});

describe("sửa tên nhân vật viết sai dấu (ADR-020)", () => {
  it("Bít thành Bit, giữ từ viết thường và tên đúng", () => {
    expect(
      fixCastNames("Tí đoán sai, Bít giải thích. Một bit dữ liệu.", ["Tí", "Bit", "Đậu"]),
    ).toBe("Tí đoán sai, Bit giải thích. Một bit dữ liệu.");
    expect(fixCastNames("Dau cười.", ["Đậu"])).toBe("Đậu cười.");
  });
});
