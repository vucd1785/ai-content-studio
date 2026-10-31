import { createHmac, timingSafeEqual } from "node:crypto";
import {
  MAX_SESSION_COOKIE_VALUE_LENGTH,
  SESSION_COOKIE_NAME,
  SESSION_PAYLOAD_VERSION,
  SESSION_TTL_SECONDS,
} from "./constants.js";

export type SessionPayload = {
  v: number;
  exp: number;
};

function encodeBase64Url(buffer: Buffer): string {
  return buffer.toString("base64url");
}

function decodeBase64Url(value: string): Buffer | null {
  if (value.length === 0) {
    return null;
  }
  try {
    return Buffer.from(value, "base64url");
  } catch {
    return null;
  }
}

function signPayload(payloadB64: string, sessionSecret: string): string {
  return encodeBase64Url(
    createHmac("sha256", sessionSecret).update(payloadB64, "utf8").digest(),
  );
}

export function createSessionCookieValue(
  sessionSecret: string,
  nowSeconds: number,
): string {
  const payload: SessionPayload = {
    v: SESSION_PAYLOAD_VERSION,
    exp: nowSeconds + SESSION_TTL_SECONDS,
  };
  const payloadB64 = encodeBase64Url(Buffer.from(JSON.stringify(payload), "utf8"));
  const mac = signPayload(payloadB64, sessionSecret);
  return `${payloadB64}.${mac}`;
}

function timingSafeEqualMac(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }
  return timingSafeEqual(providedBuf, expectedBuf);
}

export function verifySessionCookieValue(
  cookieValue: string,
  sessionSecret: string,
  nowSeconds: number,
): boolean {
  if (cookieValue.length > MAX_SESSION_COOKIE_VALUE_LENGTH) {
    return false;
  }

  const dotIndex = cookieValue.indexOf(".");
  if (dotIndex <= 0 || dotIndex !== cookieValue.lastIndexOf(".")) {
    return false;
  }

  const payloadB64 = cookieValue.slice(0, dotIndex);
  const mac = cookieValue.slice(dotIndex + 1);
  if (payloadB64.length === 0 || mac.length === 0) {
    return false;
  }

  const expectedMac = signPayload(payloadB64, sessionSecret);
  if (!timingSafeEqualMac(mac, expectedMac)) {
    return false;
  }

  const payloadBytes = decodeBase64Url(payloadB64);
  if (payloadBytes === null) {
    return false;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadBytes.toString("utf8"));
  } catch {
    return false;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return false;
  }

  const record = parsed as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 2 || !keys.includes("v") || !keys.includes("exp")) {
    return false;
  }

  if (record.v !== SESSION_PAYLOAD_VERSION) {
    return false;
  }

  if (typeof record.exp !== "number" || !Number.isFinite(record.exp)) {
    return false;
  }

  if (nowSeconds >= record.exp) {
    return false;
  }

  return true;
}

export function parseStudioSessionCookie(
  cookieHeader: string | undefined,
): { ok: true; value: string } | { ok: false } {
  if (cookieHeader === undefined || cookieHeader.length === 0) {
    return { ok: false };
  }

  const values: string[] = [];
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed.toLowerCase().startsWith(`${SESSION_COOKIE_NAME}=`)) {
      continue;
    }
    const rawValue = trimmed.slice(SESSION_COOKIE_NAME.length + 1);
    if (rawValue.length > MAX_SESSION_COOKIE_VALUE_LENGTH) {
      return { ok: false };
    }
    values.push(rawValue);
  }

  if (values.length === 0) {
    return { ok: false };
  }

  const first = values[0];
  if (first === undefined) {
    return { ok: false };
  }

  for (const value of values) {
    if (value !== first) {
      return { ok: false };
    }
  }

  return { ok: true, value: first };
}

export function buildSessionSetCookieHeader(value: string): string {
  return `${SESSION_COOKIE_NAME}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function buildSessionClearCookieHeader(): string {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}
