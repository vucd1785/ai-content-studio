import { describe, expect, it } from "vitest";
import type { StructuredGenerateClient } from "../../llm/structured-output.js";
import type { LlmUsage } from "../../llm/types.js";
import { pickCandidate, restrictionsAllowed } from "./commons.js";
import {
  findWebImage,
  pageImageUrls,
  pageTitle,
  parsePages,
  type WebImageDeps,
  webImagePrompt,
} from "./web-image.js";

const usage: LlmUsage = {
  provider: "claude-code",
  model: "claude-sonnet",
  inputTokens: 1,
  outputTokens: 1,
  thinkingTokens: 0,
};

const searchReturning = (pages: unknown): StructuredGenerateClient => ({
  generateStructured: async () => ({ jsonText: JSON.stringify({ pages }), usage }),
});

describe("ảnh trên web (ADR-032)", () => {
  it("đọc ảnh chính của trang theo thứ tự og:image:secure_url, og:image, twitter:image, image_src; ghép URL tương đối", () => {
    const html = `<html><head>
      <link rel="image_src" href="/img/fallback.jpg">
      <meta name="twitter:image" content="https://cdn.example.com/tw.jpg">
      <meta content="/img/og.jpg" property="og:image">
      <meta property="og:image:secure_url" content="https://cdn.example.com/secure.jpg?a=1&amp;b=2">
      <meta property="og:title" content="Jensen Huang | NVIDIA">
      <title>Trang khác</title></head><body></body></html>`;
    expect(pageImageUrls(html, "https://www.example.com/people/jensen")).toEqual([
      "https://cdn.example.com/secure.jpg?a=1&b=2",
      "https://www.example.com/img/og.jpg",
      "https://cdn.example.com/tw.jpg",
      "https://www.example.com/img/fallback.jpg",
    ]);
    expect(pageTitle(html)).toBe("Jensen Huang | NVIDIA");
    expect(pageTitle("<title> Falcon  9 </title>")).toBe("Falcon 9");
    expect(
      pageImageUrls("<meta property='og:image' content='javascript:alert(1)'>", "https://a.b/"),
    ).toEqual([]);
  });

  it("chỉ nhận trang http(s), không trùng, tối đa 5", () => {
    const pages = parsePages({
      pages: [
        { url: "https://a.com/1", title: "A", imageUrl: "https://a.com/1.jpg" },
        { url: "https://a.com/1", title: "trùng" },
        { url: "file:///etc/passwd", title: "file" },
        { url: "https://b.com/2", title: "B", imageUrl: "ftp://x/y.jpg" },
        ...[3, 4, 5, 6, 7].map((i) => ({ url: `https://c.com/${i}`, title: `C${i}` })),
      ],
    });
    expect(pages.map((p) => p.url)).toEqual([
      "https://a.com/1",
      "https://b.com/2",
      "https://c.com/3",
      "https://c.com/4",
      "https://c.com/5",
    ]);
    expect(pages[0]?.imageUrl).toBe("https://a.com/1.jpg");
    expect(pages[1]?.imageUrl).toBeUndefined();
    expect(parsePages(null)).toEqual([]);
  });

  it("prompt chân dung nói rõ là người thật, không chứa gì ngoài mô tả hình", () => {
    const p = webImagePrompt({
      query: "Jensen Huang portrait",
      description: "Chân dung Jensen Huang",
      person: true,
    });
    expect(p).toContain("Jensen Huang portrait");
    expect(p).toContain("real, well-known person");
  });

  it("thử lần lượt: trang lỗi thì sang trang sau, ảnh bị loại thì thử ảnh kế; ghi usage", async () => {
    const fetched: string[] = [];
    const recorded: unknown[] = [];
    const deps: WebImageDeps = {
      search: searchReturning([
        { url: "https://broken.example/page", title: "Hỏng" },
        { url: "https://news.example/a", title: "Bài báo" },
      ]),
      fetchBytes: async (url, kind) => {
        fetched.push(url);
        if (url === "https://broken.example/page") {
          return { ok: false, error: "http_error" };
        }
        if (kind.contentTypes.includes("text/html")) {
          const html =
            '<meta property="og:image" content="/small.jpg"><meta name="twitter:image" content="/big.jpg"><title>Falcon 9 hạ cánh</title>';
          return { ok: true, body: Buffer.from(html), contentType: "text/html", finalUrl: url };
        }
        return { ok: true, body: Buffer.from(url), contentType: "image/jpeg", finalUrl: url };
      },
      recordUsage: async (u) => {
        recorded.push(u);
      },
    };
    const result = await findWebImage(
      { query: "Falcon 9 landing", description: "Tên lửa hạ cánh", person: false },
      deps,
      async (hit) => {
        if (hit.imageUrl.endsWith("small.jpg")) {
          throw new Error("ảnh nhỏ");
        }
        return hit;
      },
    );
    expect(result?.imageUrl).toBe("https://news.example/big.jpg");
    expect(result?.pageUrl).toBe("https://news.example/a");
    expect(result?.pageTitle).toBe("Falcon 9 hạ cánh");
    expect(result?.host).toBe("news.example");
    expect(fetched).toEqual([
      "https://broken.example/page",
      "https://news.example/a",
      "https://news.example/small.jpg",
      "https://news.example/big.jpg",
    ]);
    expect(recorded).toHaveLength(1);
  });

  it("không có trang phù hợp hoặc JSON hỏng thì null", async () => {
    const deps = (search: StructuredGenerateClient): WebImageDeps => ({
      search,
      fetchBytes: async () => ({ ok: false, error: "network_error" }),
    });
    const accept = async () => "x";
    expect(
      await findWebImage(
        { query: "q", description: "d", person: false },
        deps(searchReturning([])),
        accept,
      ),
    ).toBeNull();
    const broken: StructuredGenerateClient = {
      generateStructured: async () => ({ jsonText: "không phải json", usage }),
    };
    expect(
      await findWebImage({ query: "q", description: "d", person: false }, deps(broken), accept),
    ).toBeNull();
  });
});

describe("Commons: quyền nhân thân của chân dung (ADR-032)", () => {
  it("chỉ nhận hạn chế quyền nhân thân khi tìm người; nhãn hiệu luôn bị loại", () => {
    expect(restrictionsAllowed("", false)).toBe(true);
    expect(restrictionsAllowed("personality", false)).toBe(false);
    expect(restrictionsAllowed("personality", true)).toBe(true);
    expect(restrictionsAllowed("personality|trademarked", true)).toBe(false);
    expect(restrictionsAllowed("trademarked", true)).toBe(false);
  });

  it("pickCandidate bỏ chân dung có quyền nhân thân trừ khi person", () => {
    const page = {
      index: 1,
      title: "File:Jensen Huang 2024.jpg",
      imageinfo: [
        {
          thumburl: "https://upload.wikimedia.org/x/Jensen.jpg",
          thumbmime: "image/jpeg",
          width: 900,
          height: 1200,
          descriptionurl: "https://commons.wikimedia.org/wiki/File:Jensen_Huang_2024.jpg",
          extmetadata: {
            License: { value: "cc-by-sa-4.0" },
            LicenseShortName: { value: "CC BY-SA 4.0" },
            Artist: { value: "Ana" },
            Restrictions: { value: "personality" },
          },
        },
      ],
    };
    expect(pickCandidate([page], "Jensen Huang portrait")).toBeNull();
    expect(pickCandidate([page], "Jensen Huang portrait", { person: true })?.title).toBe(
      "Jensen Huang 2024.jpg",
    );
  });
});
