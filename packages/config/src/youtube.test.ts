import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createPkce,
  decryptToken,
  encryptToken,
  GoogleApiError,
  generateTokenKey,
  googleFetch,
  loadYoutubeEnvFresh,
  readEnvFile,
  readYoutubeEnv,
  updateEnvFile,
} from "./youtube.js";

const KEY = randomBytes(32).toString("base64");

describe("cấu hình YouTube (ADR-031)", () => {
  it("thiếu biến thì null; khóa sai độ dài hoặc redirect không phải loopback thì báo lỗi", () => {
    expect(readYoutubeEnv({})).toBeNull();
    expect(readYoutubeEnv({ YOUTUBE_CLIENT_ID: "a", YOUTUBE_CLIENT_SECRET: "b" })).toBeNull();
    const env = readYoutubeEnv({
      YOUTUBE_CLIENT_ID: "a",
      YOUTUBE_CLIENT_SECRET: "b",
      STUDIO_TOKEN_KEY: KEY,
    });
    expect(env?.redirectUri).toBe("http://127.0.0.1:3001/api/youtube/oauth/callback");
    expect(() =>
      readYoutubeEnv({
        YOUTUBE_CLIENT_ID: "a",
        YOUTUBE_CLIENT_SECRET: "b",
        STUDIO_TOKEN_KEY: "ngan",
      }),
    ).toThrow(/32 byte/);
    expect(() =>
      readYoutubeEnv({
        YOUTUBE_CLIENT_ID: "a",
        YOUTUBE_CLIENT_SECRET: "b",
        STUDIO_TOKEN_KEY: KEY,
        YOUTUBE_REDIRECT_URI: "https://example.com/cb",
      }),
    ).toThrow(/loopback/);
  });

  it("mã hóa AES-GCM: giải mã đúng; sai khóa, sai kênh hoặc sửa một ký tự thì lỗi", () => {
    const key = randomBytes(32);
    const sealed = encryptToken(key, "1//secret", "brand-1");
    expect(sealed).not.toContain("secret");
    expect(sealed.startsWith("v1.")).toBe(true);
    expect(decryptToken(key, sealed, "brand-1")).toBe("1//secret");
    expect(() => decryptToken(randomBytes(32), sealed, "brand-1")).toThrow();
    expect(() => decryptToken(key, sealed, "brand-2")).toThrow();
    const tampered = `${sealed.slice(0, -2)}${sealed.endsWith("A") ? "B" : "A"}${sealed.slice(-1)}`;
    expect(() => decryptToken(key, tampered, "brand-1")).toThrow();
    expect(encryptToken(key, "1//secret", "brand-1")).not.toBe(sealed);
  });

  it("ghi .env: thay dòng có sẵn, thêm dòng mới, giữ dòng khác, chú thích và CRLF; chặn xuống dòng", async () => {
    const dir = await mkdtemp(join(tmpdir(), "envfile-"));
    const path = join(dir, ".env");
    await writeFile(
      path,
      "# chú thích\r\nSTUDIO_PASSWORD=abc\r\nYOUTUBE_CLIENT_ID=\r\n# YOUTUBE_CLIENT_SECRET=cu\r\n",
    );
    updateEnvFile(path, { YOUTUBE_CLIENT_ID: "1-a", YOUTUBE_CLIENT_SECRET: "s3cret" });
    const text = await readFile(path, "utf8");
    expect(text).toBe(
      "# chú thích\r\nSTUDIO_PASSWORD=abc\r\nYOUTUBE_CLIENT_ID=1-a\r\n# YOUTUBE_CLIENT_SECRET=cu\r\nYOUTUBE_CLIENT_SECRET=s3cret\r\n",
    );
    expect(readEnvFile(path)).toEqual({
      STUDIO_PASSWORD: "abc",
      YOUTUBE_CLIENT_ID: "1-a",
      YOUTUBE_CLIENT_SECRET: "s3cret",
    });
    expect(() =>
      updateEnvFile(path, { YOUTUBE_CLIENT_SECRET: "x\nSTUDIO_PASSWORD=hack" }),
    ).toThrow();
    expect(() => updateEnvFile(path, { "bad key": "x" })).toThrow();
    expect(readEnvFile(path).STUDIO_PASSWORD).toBe("abc");
    expect(readEnvFile(join(dir, "khong-co"))).toEqual({});
    await rm(dir, { recursive: true, force: true });
  });

  it("cấu hình mới nhất: giá trị trong file đè process.env", async () => {
    const dir = await mkdtemp(join(tmpdir(), "envfile-"));
    const path = join(dir, ".env");
    await writeFile(
      path,
      `YOUTUBE_CLIENT_ID="moi"\nYOUTUBE_CLIENT_SECRET=b\nSTUDIO_TOKEN_KEY=${KEY}\n`,
    );
    const env = loadYoutubeEnvFresh(path, { YOUTUBE_CLIENT_ID: "cu" });
    expect(env?.clientId).toBe("moi");
    expect(Buffer.from(generateTokenKey(), "base64")).toHaveLength(32);
    await rm(dir, { recursive: true, force: true });
  });

  it("PKCE: verifier đủ dài, challenge là SHA-256 base64url", () => {
    const { verifier, challenge } = createPkce();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("chỉ gọi host Google trong danh sách, https, không theo redirect", async () => {
    const seen: RequestInit[] = [];
    const fake = async (_url: string, init: RequestInit) => {
      seen.push(init);
      return new Response("{}");
    };
    await expect(googleFetch(fake, "https://evil.example.com/token")).rejects.toBeInstanceOf(
      GoogleApiError,
    );
    await expect(googleFetch(fake, "http://www.googleapis.com/x")).rejects.toBeInstanceOf(
      GoogleApiError,
    );
    await googleFetch(fake, "https://www.googleapis.com/youtube/v3/videos");
    expect(seen).toHaveLength(1);
    expect(seen[0]?.redirect).toBe("error");
  });
});
