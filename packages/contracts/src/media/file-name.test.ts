import { describe, expect, it } from "vitest";
import { topicFileSlug } from "./file-name.js";

describe("tên file tải về theo chủ đề (Director 2026-11-12)", () => {
  it.each([
    ["Vì sao đom đóm phát sáng?", "vi-sao-dom-dom-phat-sang"],
    [
      "Viễn thị, loạn thị và lão thị khác nhau thế nào?",
      "vien-thi-loan-thi-va-lao-thi-khac-nhau-the-nao",
    ],
    ["  ĐƯỜNG   đi  của Ánh sáng!!! ", "duong-di-cua-anh-sang"],
    ["Vì sao lướt TikTok mãi mà không dừng được?", "vi-sao-luot-tiktok-mai-ma-khong-dung-duoc"],
    ["Top 10 sự thật về 2026", "top-10-su-that-ve-2026"],
  ])("%s → %s", (topic, slug) => {
    expect(topicFileSlug(topic)).toBe(slug);
  });

  it("rỗng hoặc toàn ký tự lạ thì dùng tên dự phòng; dài thì cắt theo từ", () => {
    expect(topicFileSlug("???")).toBe("video");
    expect(topicFileSlug("", "ban-xuat")).toBe("ban-xuat");
    const long = topicFileSlug("một hai ba bốn năm sáu bảy tám chín mười ".repeat(5), "video", 30);
    expect(long.length).toBeLessThanOrEqual(30);
    expect(long.endsWith("-")).toBe(false);
    expect(long).toBe("mot-hai-ba-bon-nam-sau-bay-tam");
  });
});
