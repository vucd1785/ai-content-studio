import { createHash, timingSafeEqual } from "node:crypto";

export function sha256DigestUtf8(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function verifyPassword(submitted: string, configured: string): boolean {
  const a = sha256DigestUtf8(submitted);
  const b = sha256DigestUtf8(configured);
  return timingSafeEqual(a, b);
}
