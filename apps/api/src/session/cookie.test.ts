import { describe, expect, it } from "vitest";
import {
  createSessionCookieValue,
  parseStudioSessionCookie,
  verifySessionCookieValue,
} from "./cookie.js";
import { SESSION_COOKIE_NAME } from "./constants.js";

const SECRET = "0123456789abcdef0123456789abcdef0123456789ab";
const NOW = 1_700_000_000;

describe("session cookie (U3–U8, extras)", () => {
  it("U3 signs and verifies before exp", () => {
    const value = createSessionCookieValue(SECRET, NOW);
    expect(verifySessionCookieValue(value, SECRET, NOW)).toBe(true);
  });

  it("U4 rejects tampered MAC", () => {
    const value = createSessionCookieValue(SECRET, NOW);
    const tampered = `${value.slice(0, -1)}x`;
    expect(verifySessionCookieValue(tampered, SECRET, NOW)).toBe(false);
  });

  it("U4 rejects tampered payload", () => {
    const value = createSessionCookieValue(SECRET, NOW);
    const [payload] = value.split(".");
    const tampered = `${payload}x.${value.split(".")[1]}`;
    expect(verifySessionCookieValue(tampered, SECRET, NOW)).toBe(false);
  });

  it("U5 rejects different secret", () => {
    const value = createSessionCookieValue(SECRET, NOW);
    expect(verifySessionCookieValue(value, `${SECRET}x`, NOW)).toBe(false);
  });

  it("U6 rejects expired session", () => {
    const value = createSessionCookieValue(SECRET, NOW);
    expect(verifySessionCookieValue(value, SECRET, NOW + 604_801)).toBe(false);
  });

  it("U7 rejects single segment", () => {
    expect(verifySessionCookieValue("only-one-part", SECRET, NOW)).toBe(false);
  });

  it("U7 rejects three segments (JWT shape)", () => {
    expect(verifySessionCookieValue("a.b.c", SECRET, NOW)).toBe(false);
  });

  it("U7 rejects extra JSON keys", () => {
    const value = createSessionCookieValue(SECRET, NOW);
    const [payloadB64, mac] = value.split(".");
    const json = JSON.parse(Buffer.from(payloadB64 ?? "", "base64url").toString("utf8"));
    const extra = Buffer.from(JSON.stringify({ ...json, extra: true }), "utf8").toString(
      "base64url",
    );
    expect(verifySessionCookieValue(`${extra}.${mac}`, SECRET, NOW)).toBe(false);
  });

  it("U7 rejects v !== 1", () => {
    const value = createSessionCookieValue(SECRET, NOW);
    const [payloadB64, mac] = value.split(".");
    const json = JSON.parse(Buffer.from(payloadB64 ?? "", "base64url").toString("utf8"));
    const bad = Buffer.from(JSON.stringify({ ...json, v: 2 }), "utf8").toString("base64url");
    expect(verifySessionCookieValue(`${bad}.${mac}`, SECRET, NOW)).toBe(false);
  });

  it("U8 rejects invalid MAC length without throwing", () => {
    const value = createSessionCookieValue(SECRET, NOW);
    const [payloadB64] = value.split(".");
    expect(() =>
      verifySessionCookieValue(`${payloadB64}.tooshort`, SECRET, NOW),
    ).not.toThrow();
    expect(verifySessionCookieValue(`${payloadB64}.tooshort`, SECRET, NOW)).toBe(false);
  });

  it("rejects malformed base64url payload", () => {
    expect(verifySessionCookieValue("%%%invalid%%%.abcdef", SECRET, NOW)).toBe(false);
  });

  it("rejects oversized cookie value", () => {
    const huge = `${"a".repeat(5000)}.${"b".repeat(100)}`;
    expect(verifySessionCookieValue(huge, SECRET, NOW)).toBe(false);
  });

  it("parse rejects duplicate studio_session with different values", () => {
    const a = createSessionCookieValue(SECRET, NOW);
    const b = createSessionCookieValue(`${SECRET}2`, NOW);
    const header = `${SESSION_COOKIE_NAME}=${a}; ${SESSION_COOKIE_NAME}=${b}`;
    expect(parseStudioSessionCookie(header).ok).toBe(false);
  });

  it("parse accepts duplicate studio_session with same value", () => {
    const a = createSessionCookieValue(SECRET, NOW);
    const header = `${SESSION_COOKIE_NAME}=${a}; ${SESSION_COOKIE_NAME}=${a}`;
    const parsed = parseStudioSessionCookie(header);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value).toBe(a);
    }
  });
});
