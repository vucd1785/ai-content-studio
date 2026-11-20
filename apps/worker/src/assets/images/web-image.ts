/**
 * ADR-032: tìm ảnh thật trên mọi trang web cho yêu cầu `real` của kịch bản.
 *
 * 1. Claude Code (chỉ bật `WebSearch`) tìm tối đa 5 trang có ảnh chính rõ, đúng thứ cần hiện.
 * 2. Worker tự tải từng trang qua fetch chặn SSRF (mọi host công khai), đọc `og:image`/`twitter:image`, rồi tải ảnh
 *    qua cùng lớp chặn. Chỉ nhận PNG, JPEG, WebP; ảnh nhỏ bị bỏ sau khi chuẩn hóa.
 *
 * Ảnh web thường có bản quyền: giấy phép ghi "chưa rõ", nguồn là trang, Director duyệt ở Cổng 1.
 */
import type { StructuredGenerateClient } from "../../llm/structured-output.js";
import type { LlmUsage } from "../../llm/types.js";
import { decodeEntities, type SafeFetchBytesResult } from "../../research/safe-fetch.js";

/** Số trang tối đa Claude trả và worker thử. */
export const WEB_IMAGE_MAX_PAGES = 5;
/** Trang HTML: chỉ đọc phần đầu, đủ cho thẻ `<meta>` trong `<head>`. */
export const WEB_PAGE_MAX_BYTES = 2 * 1024 * 1024;
export const WEB_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
/** Cạnh dài tối thiểu sau chuẩn hóa: ảnh nhỏ hơn phóng lên sẽ vỡ. */
export const WEB_IMAGE_MIN_EDGE = 600;

export const WEB_IMAGE_LICENSE = "Chưa rõ giấy phép, bản quyền thuộc chủ sở hữu";

const PAGE_TYPES = ["text/html", "application/xhtml+xml"] as const;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export type WebImagePage = { url: string; title: string; imageUrl?: string };

export type WebImageRequest = {
  /** Vài từ tiếng Anh, ví dụ "Falcon 9 booster landing" hoặc "Jensen Huang portrait". */
  query: string;
  /** Mô tả tiếng Việt của kịch bản: hình phải thể hiện gì. */
  description: string;
  /** Chân dung một người có thật. */
  person: boolean;
};

export type WebImageFound = {
  buffer: Buffer;
  pageUrl: string;
  pageTitle: string;
  imageUrl: string;
  host: string;
};

export type WebImageDeps = {
  /** Claude Code có `WebSearch`. */
  search: StructuredGenerateClient;
  fetchBytes: (
    url: string,
    kind: { contentTypes: readonly string[]; accept: string; maxBytes: number; truncate: boolean },
  ) => Promise<SafeFetchBytesResult>;
  log?: (line: string) => void;
  recordUsage?: (usage: LlmUsage) => Promise<void>;
};

const SYSTEM = [
  "You find the single best real photo on the web for one picture in an educational animated video.",
  "Use web search. Return pages whose main image (the og:image shown when the page is shared) is a clear, sharp, large photo of exactly the requested subject, with no big text, watermark or collage.",
  "Prefer official websites and press or media kits, encyclopedias (Wikipedia, Britannica), major news sites, NASA or other agencies. Avoid stock-photo sites with watermarks, social media posts, shops, logos and pages about something else.",
  "If a search result shows a direct image URL (ending in .jpg, .jpeg, .png or .webp) of the subject, add it as imageUrl.",
  `Return at most ${WEB_IMAGE_MAX_PAGES} pages, best first. Return an empty list if nothing fits.`,
].join("\n");

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    pages: {
      type: "array",
      maxItems: WEB_IMAGE_MAX_PAGES,
      items: {
        type: "object",
        properties: {
          url: { type: "string" },
          title: { type: "string" },
          imageUrl: { type: "string" },
        },
        required: ["url", "title"],
      },
    },
  },
  required: ["pages"],
} as const;

/** Prompt người dùng cho lần tìm: không chứa dữ liệu riêng, chỉ mô tả hình. */
export function webImagePrompt(req: WebImageRequest): string {
  return [
    `Subject: ${req.query}`,
    `What the picture must show (Vietnamese): ${req.description}`,
    req.person
      ? "This is a real, well-known person: find a recent, clear portrait or upper-body photo of this exact person, face visible, not a group photo."
      : "Find a photo or clear diagram of exactly this subject.",
  ].join("\n");
}

/** Trang hợp lệ từ kết quả của Claude: chỉ http(s), không trùng. */
export function parsePages(output: unknown): WebImagePage[] {
  const raw = (output as { pages?: unknown } | null)?.pages;
  if (!Array.isArray(raw)) {
    return [];
  }
  const pages: WebImagePage[] = [];
  for (const item of raw) {
    const p = item as { url?: unknown; title?: unknown; imageUrl?: unknown };
    if (typeof p.url !== "string" || !isHttpUrl(p.url)) {
      continue;
    }
    if (pages.some((x) => x.url === p.url)) {
      continue;
    }
    pages.push({
      url: p.url,
      title: typeof p.title === "string" ? p.title.slice(0, 200) : "",
      ...(typeof p.imageUrl === "string" && isHttpUrl(p.imageUrl) ? { imageUrl: p.imageUrl } : {}),
    });
    if (pages.length >= WEB_IMAGE_MAX_PAGES) {
      break;
    }
  }
  return pages;
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** Thuộc tính của một thẻ HTML (tên chữ thường). */
function attributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z:_-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    const name = m[1]?.toLowerCase();
    if (name !== undefined) {
      attrs[name] = decodeEntities(m[3] ?? m[4] ?? m[5] ?? "");
    }
  }
  return attrs;
}

/**
 * Ảnh chính của trang theo thứ tự ưu tiên: `og:image:secure_url`, `og:image`, `twitter:image`, `link rel=image_src`.
 * URL tương đối được ghép với trang. Không có thì mảng rỗng.
 */
export function pageImageUrls(html: string, pageUrl: string): string[] {
  const head = html.slice(0, WEB_PAGE_MAX_BYTES);
  const ranked: { rank: number; url: string }[] = [];
  const rankOf: Record<string, number> = {
    "og:image:secure_url": 0,
    "og:image": 1,
    "og:image:url": 1,
    "twitter:image": 2,
    "twitter:image:src": 2,
  };
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attributes(m[0]);
    const key = (a.property ?? a.name ?? "").toLowerCase();
    const rank = rankOf[key];
    if (rank !== undefined && a.content) {
      ranked.push({ rank, url: a.content });
    }
  }
  for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
    const a = attributes(m[0]);
    if ((a.rel ?? "").toLowerCase() === "image_src" && a.href) {
      ranked.push({ rank: 3, url: a.href });
    }
  }
  const urls: string[] = [];
  for (const { url } of ranked.sort((x, y) => x.rank - y.rank)) {
    let abs: string;
    try {
      abs = new URL(url, pageUrl).toString();
    } catch {
      continue;
    }
    if (isHttpUrl(abs) && !urls.includes(abs)) {
      urls.push(abs);
    }
  }
  return urls;
}

/** Tiêu đề trang từ `og:title` hoặc `<title>`. */
export function pageTitle(html: string): string | undefined {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attributes(m[0]);
    if ((a.property ?? a.name ?? "").toLowerCase() === "og:title" && a.content) {
      return a.content.trim().slice(0, 200);
    }
  }
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  return t === undefined ? undefined : decodeEntities(t).replace(/\s+/g, " ").trim().slice(0, 200);
}

const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, "");

/**
 * Ứng viên ảnh theo thứ tự: với mỗi trang, URL ảnh trực tiếp Claude thấy rồi ảnh chính của trang. Trả ảnh đầu tiên
 * tải được; `accept` (kiểm sau chuẩn hóa) có thể loại ảnh nhỏ để thử ứng viên kế. Không có thì null.
 */
export async function findWebImage<T>(
  req: WebImageRequest,
  deps: WebImageDeps,
  accept: (found: WebImageFound) => Promise<T | null>,
): Promise<T | null> {
  const log = deps.log ?? (() => {});
  const response = await deps.search.generateStructured({
    systemInstruction: SYSTEM,
    userPrompt: webImagePrompt(req),
    responseJsonSchema: RESPONSE_SCHEMA as unknown as Record<string, unknown>,
    model: "claude-code",
    thinkingLevel: "low",
  });
  await deps.recordUsage?.(response.usage);
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(response.jsonText);
  } catch {
    parsed = null;
  }
  const pages = parsePages(parsed);
  if (pages.length === 0) {
    log(`ảnh web "${req.query}": không có trang phù hợp`);
    return null;
  }
  const tried = new Set<string>();
  for (const page of pages) {
    const candidates: string[] = page.imageUrl === undefined ? [] : [page.imageUrl];
    let title = page.title;
    const html = await deps.fetchBytes(page.url, {
      contentTypes: PAGE_TYPES,
      accept: "text/html,application/xhtml+xml",
      maxBytes: WEB_PAGE_MAX_BYTES,
      truncate: true,
    });
    if (html.ok) {
      const text = new TextDecoder("utf-8").decode(html.body);
      candidates.push(...pageImageUrls(text, html.finalUrl));
      title = pageTitle(text) ?? title;
    } else {
      log(`ảnh web: trang ${page.url} lỗi ${html.error}`);
    }
    for (const imageUrl of candidates) {
      if (tried.has(imageUrl)) {
        continue;
      }
      tried.add(imageUrl);
      const img = await deps.fetchBytes(imageUrl, {
        contentTypes: IMAGE_TYPES,
        accept: "image/webp,image/png,image/jpeg",
        maxBytes: WEB_IMAGE_MAX_BYTES,
        truncate: false,
      });
      if (!img.ok) {
        log(`ảnh web: ảnh ${imageUrl} lỗi ${img.error}`);
        continue;
      }
      const result = await accept({
        buffer: img.body,
        pageUrl: page.url,
        pageTitle: title || hostOf(page.url),
        imageUrl: img.finalUrl,
        host: hostOf(page.url),
      }).catch((error: unknown) => {
        log(`ảnh web: ảnh ${imageUrl} bị loại: ${error instanceof Error ? error.message : error}`);
        return null;
      });
      if (result !== null) {
        return result;
      }
    }
  }
  return null;
}
