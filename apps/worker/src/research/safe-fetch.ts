import { createHash } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import http, { type IncomingMessage } from "node:http";
import https from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
import type { FetchErrorCode, FetchLogRequest } from "@studio/contracts";

/**
 * Fetch có chặn SSRF cho job research (docs/08-SECURITY.md mục Fetch URL):
 * - chỉ `http`/`https`, không có user:pass trong URL;
 * - host của mọi hop phải nằm trong allowlist của run (host của URL Director đưa);
 * - mỗi hop resolve DNS một lần, chặn nếu có địa chỉ private, loopback, link-local, metadata;
 *   socket nối đúng địa chỉ đã kiểm (không resolve lại, chống DNS rebinding);
 * - tối đa 3 redirect, 15 giây tổng, 1 MB thân.
 */

export const FETCH_LIMITS = {
  maxRedirects: 3,
  timeoutMs: 15_000,
  maxBytes: 1024 * 1024,
} as const;

/** Số ký tự văn bản tối đa đưa vào prompt cho một trang. */
const MAX_TEXT_CHARS = 20_000;

const ALLOWED_CONTENT_TYPES = ["text/html", "text/plain", "text/markdown", "application/xhtml+xml"];

export type ResolvedAddress = { address: string; family: 4 | 6 };
export type HostResolver = (hostname: string) => Promise<ResolvedAddress[]>;

export type SafeFetchOptions = {
  /** Host (chữ thường) được phép ở mọi hop. */
  allowedHosts: ReadonlySet<string>;
  resolver?: HostResolver;
  /** Mặc định `isPublicAddress`. Test có thể cho phép đúng 127.0.0.1 của server giả. */
  isAddressAllowed?: (address: string) => boolean;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
};

export type SafeFetchResult = {
  log: FetchLogRequest;
  /** Văn bản đã trích (chỉ khi thành công). */
  text?: string;
  title?: string;
};

// Hai list riêng: BlockList của Node so IPv4 với cả rule IPv6 dạng mapped, nên rule
// `::ffff:0:0/96` trong cùng list sẽ chặn nhầm mọi IPv4.
const blockedV4 = new BlockList();
const blockedV6 = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // CGNAT, gồm metadata 100.100.100.200
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local, gồm metadata 169.254.169.254
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blockedV4.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96], // NAT64 có thể trỏ vào mạng nội bộ
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7], // ULA, gồm metadata fd00:ec2::254
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
] as const) {
  blockedV6.addSubnet(network, prefix, "ipv6");
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    return !blockedV4.check(address, "ipv4");
  }
  if (family !== 6) {
    return false;
  }
  // Chuẩn hóa (`0:0:0:0:0:ffff:7f00:1` → `::ffff:7f00:1`). IPv4-mapped bị chặn hết:
  // DNS hợp lệ không trả dạng này.
  const canonical = new URL(`http://[${address}]/`).hostname.slice(1, -1);
  if (canonical.startsWith("::ffff:")) {
    return false;
  }
  return !blockedV6.check(canonical, "ipv6");
}

const defaultResolver: HostResolver = async (hostname) => {
  const results = await dnsLookup(hostname, { all: true, verbatim: true });
  return results.map((entry) => ({ address: entry.address, family: entry.family === 6 ? 6 : 4 }));
};

class FetchFailure extends Error {
  constructor(
    readonly code: FetchErrorCode,
    readonly status: number | null = null,
  ) {
    super(code);
  }
}

function hostnameOf(url: URL): string {
  // URL giữ IPv6 trong ngoặc vuông.
  return url.hostname.replace(/^\[(.*)\]$/, "$1").toLowerCase();
}

export function hostAllowlistFor(urls: readonly string[]): Set<string> {
  const hosts = new Set<string>();
  for (const raw of urls) {
    try {
      hosts.add(hostnameOf(new URL(raw)));
    } catch {
      // URL hỏng không mở host nào.
    }
  }
  return hosts;
}

function parseHopUrl(raw: string, base?: URL): URL {
  let url: URL;
  try {
    url = base === undefined ? new URL(raw) : new URL(raw, base);
  } catch {
    throw new FetchFailure("invalid_url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new FetchFailure("protocol_not_allowed");
  }
  if (url.username !== "" || url.password !== "") {
    throw new FetchFailure("invalid_url");
  }
  url.hash = "";
  return url;
}

async function resolveChecked(
  hostname: string,
  resolver: HostResolver,
  isAllowed: (address: string) => boolean,
): Promise<ResolvedAddress[]> {
  let addresses: ResolvedAddress[];
  if (isIP(hostname) !== 0) {
    addresses = [{ address: hostname, family: isIP(hostname) === 6 ? 6 : 4 }];
  } else {
    try {
      addresses = await resolver(hostname);
    } catch {
      throw new FetchFailure("dns_failed");
    }
  }
  if (addresses.length === 0) {
    throw new FetchFailure("dns_failed");
  }
  // Một địa chỉ bị chặn là chặn cả host, tránh chọn trúng địa chỉ nội bộ.
  if (addresses.some((entry) => !isAllowed(entry.address))) {
    throw new FetchFailure("address_blocked");
  }
  return addresses;
}

/** Lookup trả đúng các địa chỉ đã kiểm, nên socket không resolve lại. */
function pinnedLookup(addresses: ResolvedAddress[]): LookupFunction {
  return ((_hostname: string, options: { all?: boolean }, callback: (...args: unknown[]) => void) => {
    if (options.all === true) {
      callback(null, addresses);
      return;
    }
    const first = addresses[0];
    callback(null, first?.address, first?.family);
  }) as LookupFunction;
}

function requestOnce(
  url: URL,
  addresses: ResolvedAddress[],
  signal: AbortSignal,
): Promise<IncomingMessage> {
  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const request = client.request(
      url,
      {
        method: "GET",
        lookup: pinnedLookup(addresses),
        signal,
        headers: {
          accept: "text/html, text/plain, text/markdown;q=0.9",
          "accept-encoding": "identity",
          "user-agent": "AIContentStudio-Research/0.1",
        },
      },
      resolve,
    );
    request.on("error", reject);
    request.end();
  });
}

function readBody(response: IncomingMessage, maxBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    response.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        response.destroy();
        reject(new FetchFailure("too_large", response.statusCode ?? null));
        return;
      }
      chunks.push(chunk);
    });
    response.on("end", () => resolve(Buffer.concat(chunks)));
    response.on("error", reject);
    // Abort (timeout) có thể đóng stream mà không có `end`.
    response.on("close", () => {
      if (!response.complete) {
        reject(new FetchFailure("network_error", response.statusCode ?? null));
      }
    });
  });
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&");
}

/** Văn bản thô từ HTML: bỏ script/style, bỏ thẻ, gộp khoảng trắng. */
export function htmlToText(html: string): { text: string; title?: string } {
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = titleMatch?.[1] !== undefined ? decodeEntities(titleMatch[1]).trim() : undefined;
  const text = decodeEntities(
    html
      .replace(/<(script|style|noscript|template|svg)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<\/(p|div|li|h[1-6]|tr|br|section|article)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
  return title === undefined || title === "" ? { text } : { text, title };
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export async function safeFetch(rawUrl: string, options: SafeFetchOptions): Promise<SafeFetchResult> {
  const resolver = options.resolver ?? defaultResolver;
  const isAllowed = options.isAddressAllowed ?? isPublicAddress;
  const maxRedirects = options.maxRedirects ?? FETCH_LIMITS.maxRedirects;
  const maxBytes = options.maxBytes ?? FETCH_LIMITS.maxBytes;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? FETCH_LIMITS.timeoutMs);
  let current: URL | null = null;
  let status: number | null = null;

  const failure = (code: FetchErrorCode): SafeFetchResult => ({
    log: { url: rawUrl, finalUrl: current?.href ?? null, status, contentHash: null, error: code },
  });

  try {
    current = parseHopUrl(rawUrl);
    for (let hop = 0; ; hop++) {
      if (!options.allowedHosts.has(hostnameOf(current))) {
        throw new FetchFailure("host_not_allowed");
      }
      const addresses = await resolveChecked(hostnameOf(current), resolver, isAllowed);
      const response = await requestOnce(current, addresses, controller.signal);
      status = response.statusCode ?? null;
      const location = response.headers.location;
      if (status !== null && REDIRECT_STATUSES.has(status) && location !== undefined) {
        response.resume();
        if (hop >= maxRedirects) {
          throw new FetchFailure("too_many_redirects");
        }
        current = parseHopUrl(location, current);
        status = null;
        continue;
      }
      if (status === null || status < 200 || status >= 300) {
        response.resume();
        throw new FetchFailure("http_error");
      }
      const contentType = (response.headers["content-type"] ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
      if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
        response.resume();
        throw new FetchFailure("unsupported_content_type");
      }
      const declared = Number(response.headers["content-length"]);
      if (Number.isFinite(declared) && declared > maxBytes) {
        response.destroy();
        throw new FetchFailure("too_large");
      }
      const body = await readBody(response, maxBytes);
      const contentHash = createHash("sha256").update(body).digest("hex");
      const decoded = new TextDecoder("utf-8").decode(body);
      const extracted =
        contentType === "text/html" || contentType === "application/xhtml+xml"
          ? htmlToText(decoded)
          : { text: decoded.trim() };
      return {
        log: { url: rawUrl, finalUrl: current.href, status, contentHash },
        text: extracted.text.slice(0, MAX_TEXT_CHARS),
        ...(extracted.title === undefined ? {} : { title: extracted.title }),
      };
    }
  } catch (error) {
    if (controller.signal.aborted) {
      return failure("timeout");
    }
    if (error instanceof FetchFailure) {
      return failure(error.code);
    }
    return failure("network_error");
  } finally {
    clearTimeout(timer);
  }
}
