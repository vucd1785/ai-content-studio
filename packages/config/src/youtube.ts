import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { readFileSync, renameSync, writeFileSync } from "node:fs";

/**
 * Cấu hình, mã hóa token và các lời gọi OAuth Google dùng chung cho API và worker (ADR-031).
 *
 * - Client ID, client secret do Director tạo trong dự án Google Cloud của mình (loại "Desktop app").
 * - Refresh token mã hóa AES-256-GCM bằng `STUDIO_TOKEN_KEY`, gắn với `brandProfileId` (AAD): chuỗi đã mã hóa
 *   chép sang kênh khác không giải mã được.
 * - Không log token, code, verifier; lỗi chỉ mang mã và thông điệp ngắn của Google.
 */

export const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
] as const;

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
export const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";
export const YOUTUBE_UPLOAD_API = "https://www.googleapis.com/upload/youtube/v3";
/** Host được gọi (ADR-031 mục 4). Mọi lời gọi kiểm URL đích theo danh sách này, không theo redirect. */
export const GOOGLE_HOSTS: ReadonlySet<string> = new Set([
  "oauth2.googleapis.com",
  "www.googleapis.com",
  "youtube.googleapis.com",
]);
export const DEFAULT_REDIRECT_URI = "http://127.0.0.1:3001/api/youtube/oauth/callback";
const USER_AGENT = "AIContentStudio/0.1 (local educational video tool)";
const TIMEOUT_MS = 30_000;

export type YoutubeEnv = {
  clientId: string;
  clientSecret: string;
  tokenKey: Buffer;
  redirectUri: string;
};

/** Đọc cấu hình; thiếu biến nào thì null (giao diện báo "chưa cấu hình", không lưu token thô). */
export function readYoutubeEnv(env: Record<string, string | undefined>): YoutubeEnv | null {
  const clientId = env.YOUTUBE_CLIENT_ID?.trim() ?? "";
  const clientSecret = env.YOUTUBE_CLIENT_SECRET?.trim() ?? "";
  const rawKey = env.STUDIO_TOKEN_KEY?.trim() ?? "";
  if (clientId === "" || clientSecret === "" || rawKey === "") {
    return null;
  }
  const tokenKey = Buffer.from(rawKey, "base64");
  if (tokenKey.length !== 32) {
    throw new Error("STUDIO_TOKEN_KEY phải là 32 byte mã hóa base64");
  }
  const redirectUri = env.YOUTUBE_REDIRECT_URI?.trim() || DEFAULT_REDIRECT_URI;
  const url = new URL(redirectUri);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new Error("YOUTUBE_REDIRECT_URI phải là địa chỉ loopback http");
  }
  return { clientId, clientSecret, tokenKey, redirectUri };
}

const ENV_LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/;

/** Đọc file `.env` (KEY=VALUE, bỏ dòng chú thích, bỏ ngoặc kép bao ngoài). Thiếu file thì rỗng. */
export function readEnvFile(path: string): Record<string, string> {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return {};
  }
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*#/.test(line)) {
      continue;
    }
    const match = ENV_LINE.exec(line);
    if (match?.[1] === undefined) {
      continue;
    }
    const raw = match[2] ?? "";
    out[match[1]] = /^(["']).*\1$/.test(raw) ? raw.slice(1, -1) : raw;
  }
  return out;
}

/**
 * Ghi các biến vào `.env`: thay dòng `KEY=` đã có, thêm dòng mới ở cuối, giữ nguyên mọi dòng khác và kiểu xuống
 * dòng của file. Ghi file tạm rồi đổi tên. Giá trị phải là một dòng, không có ký tự điều khiển.
 */
export function updateEnvFile(path: string, values: Record<string, string>): void {
  for (const [key, value] of Object.entries(values)) {
    const hasControl = [...value].some((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code < 0x20 || code === 0x7f;
    });
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key) || hasControl) {
      throw new Error(`giá trị .env không hợp lệ cho ${key}`);
    }
  }
  let text = "";
  try {
    text = readFileSync(path, "utf8");
  } catch {
    text = "";
  }
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text === "" ? [] : text.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  const pending = new Map(Object.entries(values));
  const next = lines.map((line) => {
    const key = ENV_LINE.exec(line)?.[1];
    if (key !== undefined && !/^\s*#/.test(line) && pending.has(key)) {
      const value = pending.get(key) ?? "";
      pending.delete(key);
      return `${key}=${value}`;
    }
    return line;
  });
  for (const [key, value] of pending) {
    next.push(`${key}=${value}`);
  }
  const temp = `${path}.${randomBytes(6).toString("hex")}.tmp`;
  writeFileSync(temp, `${next.join(eol)}${eol}`, { encoding: "utf8", mode: 0o600 });
  renameSync(temp, path);
}

/** Cấu hình YouTube mới nhất: giá trị trong file `.env` (Director có thể vừa lưu từ giao diện) đè `process.env`. */
export function loadYoutubeEnvFresh(
  envPath: string,
  base: Record<string, string | undefined> = process.env,
): YoutubeEnv | null {
  return readYoutubeEnv({ ...base, ...readEnvFile(envPath) });
}

/** Khóa mã hóa mới, 32 byte base64 (chỉ tạo khi `.env` chưa có). */
export function generateTokenKey(): string {
  return randomBytes(32).toString("base64");
}

const b64u = (b: Buffer) => b.toString("base64url");

/** Mã hóa refresh token: `v1.<iv>.<tag>.<ciphertext>` (base64url), AAD là `aad`. */
export function encryptToken(key: Buffer, plaintext: string, aad: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return ["v1", b64u(iv), b64u(cipher.getAuthTag()), b64u(ct)].join(".");
}

export function decryptToken(key: Buffer, sealed: string, aad: string): string {
  const [version, iv, tag, ct] = sealed.split(".");
  if (version !== "v1" || iv === undefined || tag === undefined || ct === undefined) {
    throw new Error("token đã mã hóa sai định dạng");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString(
    "utf8",
  );
}

/** PKCE (RFC 7636, S256). */
export function createPkce(): { verifier: string; challenge: string } {
  const verifier = b64u(randomBytes(48));
  const challenge = b64u(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function buildAuthUrl(env: YoutubeEnv, state: string, challenge: string): string {
  const params = new URLSearchParams({
    client_id: env.clientId,
    redirect_uri: env.redirectUri,
    response_type: "code",
    scope: YOUTUBE_SCOPES.join(" "),
    access_type: "offline",
    // Luôn hỏi lại để Google cấp refresh token mới và Director chọn đúng kênh.
    prompt: "consent select_account",
    include_granted_scopes: "false",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

/** Lỗi gọi Google; `code` là mã ngắn để phân loại, `status` là HTTP status (0 khi lỗi mạng). */
export class GoogleApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "GoogleApiError";
  }
}

export type GoogleFetch = (url: string, init: RequestInit) => Promise<Response>;

/** Gọi Google: kiểm host, không theo redirect, có thời hạn, User-Agent chung. */
export async function googleFetch(
  fetchImpl: GoogleFetch,
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const target = new URL(url);
  if (target.protocol !== "https:" || !GOOGLE_HOSTS.has(target.hostname)) {
    throw new GoogleApiError("host_not_allowed", 0, `host ${target.hostname} không được phép`);
  }
  const headers = new Headers(init.headers);
  headers.set("user-agent", USER_AGENT);
  const { timeoutMs, ...rest } = init;
  try {
    return await fetchImpl(target.toString(), {
      ...rest,
      headers,
      // Upload resumable trả 308 "Resume Incomplete" (không có Location): nơi gọi chọn "manual" và tự kiểm.
      redirect: init.redirect === "manual" ? "manual" : "error",
      signal: AbortSignal.timeout(timeoutMs ?? TIMEOUT_MS),
    });
  } catch (error) {
    throw new GoogleApiError(
      "network",
      0,
      `lỗi mạng khi gọi Google: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** Đọc lỗi JSON của Google thành `GoogleApiError` (chỉ mã và thông điệp, không lặp lại request). */
export async function googleError(res: Response): Promise<GoogleApiError> {
  let reason = `http_${res.status}`;
  let message = `Google trả ${res.status}`;
  try {
    const body = (await res.json()) as {
      error?: string | { message?: string; errors?: { reason?: string }[]; status?: string };
      error_description?: string;
    };
    if (typeof body.error === "string") {
      reason = body.error;
      message = body.error_description ?? body.error;
    } else if (body.error !== undefined) {
      reason = body.error.errors?.[0]?.reason ?? body.error.status ?? reason;
      message = body.error.message ?? message;
    }
  } catch {
    // Thân không phải JSON: giữ mã theo status.
  }
  return new GoogleApiError(reason, res.status, message.slice(0, 300));
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  expires_in?: number;
};

async function tokenRequest(fetchImpl: GoogleFetch, body: URLSearchParams): Promise<TokenResponse> {
  const res = await googleFetch(fetchImpl, GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body,
  });
  if (!res.ok) {
    throw await googleError(res);
  }
  return (await res.json()) as TokenResponse;
}

/** Đổi authorization code lấy token (có PKCE verifier). */
export async function exchangeCode(
  fetchImpl: GoogleFetch,
  env: YoutubeEnv,
  code: string,
  verifier: string,
): Promise<{ accessToken: string; refreshToken: string; scope: string }> {
  const body = await tokenRequest(
    fetchImpl,
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      client_id: env.clientId,
      client_secret: env.clientSecret,
      redirect_uri: env.redirectUri,
    }),
  );
  if (body.access_token === undefined || body.refresh_token === undefined) {
    throw new GoogleApiError("no_refresh_token", 400, "Google không cấp refresh token");
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    scope: body.scope ?? "",
  };
}

/** Lấy access token mới từ refresh token. Google từ chối (`invalid_grant`) là phải kết nối lại. */
export async function refreshAccessToken(
  fetchImpl: GoogleFetch,
  env: YoutubeEnv,
  refreshToken: string,
): Promise<string> {
  const body = await tokenRequest(
    fetchImpl,
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: env.clientId,
      client_secret: env.clientSecret,
    }),
  );
  if (body.access_token === undefined) {
    throw new GoogleApiError("no_access_token", 400, "Google không cấp access token");
  }
  return body.access_token;
}

/** Thu hồi token ở Google; lỗi bỏ qua (token có thể đã hết hạn). */
export async function revokeToken(fetchImpl: GoogleFetch, token: string): Promise<void> {
  try {
    await googleFetch(fetchImpl, GOOGLE_REVOKE_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    });
  } catch {
    // Không chặn việc xóa kết nối ở Studio.
  }
}

/** Kênh của tài khoản vừa đăng nhập (`channels.list mine=true`). */
export async function fetchMyChannel(
  fetchImpl: GoogleFetch,
  accessToken: string,
): Promise<{ id: string; title: string; thumbnail: string | null }> {
  const res = await googleFetch(fetchImpl, `${YOUTUBE_API}/channels?part=snippet&mine=true`, {
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
  });
  if (!res.ok) {
    throw await googleError(res);
  }
  const body = (await res.json()) as {
    items?: {
      id?: string;
      snippet?: { title?: string; thumbnails?: { default?: { url?: string } } };
    }[];
  };
  const item = body.items?.[0];
  if (item?.id === undefined) {
    throw new GoogleApiError("no_channel", 404, "Tài khoản Google này chưa có kênh YouTube");
  }
  const thumb = item.snippet?.thumbnails?.default?.url ?? null;
  return {
    id: item.id,
    title: item.snippet?.title ?? item.id,
    // Chỉ giữ ảnh đại diện từ host ảnh của Google.
    thumbnail:
      thumb !== null && /^https:\/\/yt\d\.(ggpht|googleusercontent)\.com\//.test(thumb)
        ? thumb
        : null,
  };
}
