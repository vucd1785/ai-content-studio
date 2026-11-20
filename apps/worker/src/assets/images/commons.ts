/**
 * Cách 2 của ADR-030: tìm ảnh thật có giấy phép mở trên Wikimedia Commons cho thứ hình vẽ phẳng không thể hiện đúng.
 *
 * - Chỉ gọi các host cố định: `commons.wikimedia.org` (API), `upload.wikimedia.org` và `thumb.wikimedia.org` (ảnh thu nhỏ). Không theo
 *   redirect, giới hạn thời gian và dung lượng.
 * - Chỉ nhận ảnh phạm vi công cộng, CC0, CC BY, CC BY-SA; bỏ ảnh có hạn chế (nhãn hiệu, quyền nhân thân). Riêng chân
 *   dung người có thật (ADR-032) nhận hạn chế quyền nhân thân, vẫn bỏ nhãn hiệu và hạn chế khác.
 * - Lấy ảnh thu nhỏ PNG/JPEG do Commons render (kể cả từ SVG), không tải SVG gốc.
 * - User-Agent chung của công cụ, không chứa thông tin cá nhân.
 */

const API = "https://commons.wikimedia.org/w/api.php";
const IMAGE_HOSTS: ReadonlySet<string> = new Set(["upload.wikimedia.org", "thumb.wikimedia.org"]);
const USER_AGENT = "AIContentStudio/0.1 (local educational video tool)";
const TIMEOUT_MS = 20_000;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const THUMB_WIDTH = 900;

export type CommonsImage = {
  buffer: Buffer;
  /** Tên file trên Commons, không có tiền tố "File:". */
  title: string;
  pageUrl: string;
  author: string;
  license: string;
  licenseUrl?: string;
  /** Dòng ghi công theo yêu cầu giấy phép. */
  attribution: string;
};

export type CommonsFetch = (url: string, init: RequestInit) => Promise<Response>;

type ExtMeta = Record<string, { value?: string } | undefined>;
type Page = {
  index?: number;
  title?: string;
  imageinfo?: {
    thumburl?: string;
    thumbmime?: string;
    width?: number;
    height?: number;
    descriptionurl?: string;
    extmetadata?: ExtMeta;
  }[];
};

/** Giấy phép được nhận: phạm vi công cộng, CC0, CC BY, CC BY-SA (mọi version). */
export function isFreeLicense(license: string): boolean {
  const l = license.trim().toLowerCase();
  return (
    l === "pd" ||
    l.startsWith("pd-") ||
    l === "public domain" ||
    l === "cc0" ||
    l.startsWith("cc0-") ||
    /^cc-by(-sa)?-\d/.test(l) ||
    /^cc by(-sa)? \d/.test(l)
  );
}

/** Bỏ thẻ HTML và khoảng trắng thừa trong trường "Artist" của Commons. */
export function plainText(html: string | undefined): string {
  return (html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function withTimeout(): { signal: AbortSignal } {
  return { signal: AbortSignal.timeout(TIMEOUT_MS) };
}

/** Từ khóa (≥ 3 ký tự, chữ thường, bỏ dấu) để so với tên file. */
const keywords = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3);

/** Hạn chế chấp nhận được: không có, hoặc chỉ quyền nhân thân khi tìm chân dung (ADR-032). */
export function restrictionsAllowed(restrictions: string, person: boolean): boolean {
  const tokens = restrictions
    .split(/[|,\s]+/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t !== "");
  return tokens.length === 0 || (person && tokens.every((t) => t === "personality"));
}

/**
 * Ứng viên tốt nhất có giấy phép mở, không hạn chế (trừ quyền nhân thân của chân dung), có ảnh thu nhỏ PNG/JPEG.
 * Tìm kiếm của Commons hay xếp ảnh chụp phong cảnh trước bản đồ, nên xếp theo số từ khóa của câu tìm có trong tên
 * file (cần ít nhất một nửa), rồi theo thứ tự tìm kiếm.
 */
export function pickCandidate(
  pages: readonly Page[],
  query = "",
  options: { person?: boolean } = {},
): {
  thumb: string;
  title: string;
  pageUrl: string;
  author: string;
  license: string;
  licenseUrl?: string;
} | null {
  const want = [...new Set(keywords(query))];
  const hits = (p: Page) => {
    const have = new Set(keywords(p.title ?? ""));
    return want.filter((w) => have.has(w)).length;
  };
  const sorted = [...pages]
    .filter((p) => want.length === 0 || hits(p) * 2 >= want.length)
    .sort((a, b) => hits(b) - hits(a) || (a.index ?? 0) - (b.index ?? 0));
  for (const page of sorted) {
    const info = page.imageinfo?.[0];
    const meta = info?.extmetadata ?? {};
    const license = meta.License?.value ?? meta.LicenseShortName?.value ?? "";
    const restrictions = (meta.Restrictions?.value ?? "").trim();
    if (
      info?.thumburl === undefined ||
      !/^image\/(png|jpeg)$/.test(info.thumbmime ?? "") ||
      (info.width ?? 0) < 300 ||
      !isFreeLicense(license) ||
      !restrictionsAllowed(restrictions, options.person === true)
    ) {
      continue;
    }
    let thumb: URL;
    try {
      thumb = new URL(info.thumburl);
    } catch {
      continue;
    }
    if (thumb.protocol !== "https:" || !IMAGE_HOSTS.has(thumb.hostname)) {
      continue;
    }
    const title = (page.title ?? "").replace(/^File:/, "");
    return {
      thumb: thumb.toString(),
      title,
      pageUrl:
        info.descriptionurl ??
        `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(title)}`,
      author: plainText(meta.Artist?.value) || "Không rõ tác giả",
      license: (meta.LicenseShortName?.value ?? license).trim(),
      ...(meta.LicenseUrl?.value === undefined ? {} : { licenseUrl: meta.LicenseUrl.value }),
    };
  }
  return null;
}

async function readLimited(res: Response, max: number): Promise<Buffer> {
  const length = Number(res.headers.get("content-length") ?? "0");
  if (length > max) {
    throw new Error("ảnh quá lớn");
  }
  const reader = res.body?.getReader();
  if (reader === undefined) {
    return Buffer.alloc(0);
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      throw new Error("ảnh quá lớn");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

/**
 * Tìm và tải một ảnh cho `query` (tiếng Anh, vài từ). Không có ảnh hợp lệ thì null; lỗi mạng ném ra để nơi gọi
 * quyết định dùng hình Claude vẽ thay thế.
 */
export async function findCommonsImage(
  query: string,
  fetchImpl: CommonsFetch = fetch,
  options: { person?: boolean } = {},
): Promise<CommonsImage | null> {
  const q = query.replace(/\s+/g, " ").trim().slice(0, 80);
  if (q === "") {
    return null;
  }
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    generator: "search",
    gsrnamespace: "6",
    gsrlimit: "12",
    gsrsearch: `${q} filetype:bitmap|drawing`,
    prop: "imageinfo",
    iiprop: "url|mime|thumbmime|size|extmetadata",
    iiurlwidth: String(THUMB_WIDTH),
    iiextmetadatafilter: "License|LicenseShortName|LicenseUrl|Artist|Restrictions",
  });
  const headers = { "user-agent": USER_AGENT, accept: "application/json" };
  const res = await fetchImpl(`${API}?${params}`, { headers, redirect: "error", ...withTimeout() });
  if (!res.ok) {
    throw new Error(`Commons API ${res.status}`);
  }
  const body = (await res.json()) as { query?: { pages?: Page[] | Record<string, Page> } };
  const pages = body.query?.pages;
  const list = Array.isArray(pages) ? pages : Object.values(pages ?? {});
  const picked = pickCandidate(list, q, options);
  if (picked === null) {
    return null;
  }
  const img = await fetchImpl(picked.thumb, {
    headers: { "user-agent": USER_AGENT, accept: "image/png,image/jpeg" },
    redirect: "error",
    ...withTimeout(),
  });
  if (!img.ok || !/^image\/(png|jpeg)/.test(img.headers.get("content-type") ?? "")) {
    throw new Error(`tải ảnh Commons lỗi ${img.status}`);
  }
  const buffer = await readLimited(img, MAX_IMAGE_BYTES);
  return {
    buffer,
    title: picked.title,
    pageUrl: picked.pageUrl,
    author: picked.author,
    license: picked.license,
    ...(picked.licenseUrl === undefined ? {} : { licenseUrl: picked.licenseUrl }),
    attribution: `"${picked.title}" – ${picked.author}, ${picked.license}, Wikimedia Commons (${picked.pageUrl})`,
  };
}
