import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Đuôi ảnh avatar kênh nhận; thứ tự là thứ tự ưu tiên khi có nhiều file. */
export const BRAND_AVATAR_EXTS = [".png", ".webp", ".jpg", ".jpeg"] as const;

/**
 * Avatar kênh cho thẻ kết (ADR-028): file `data/brand/<slug>/avatar.<ext>` do Director đặt. Worker chép sang
 * `render/public/brand/<slug>/avatar-<sha12><ext>` để composition đọc bằng `staticFile`; tên có hash nên đổi ảnh
 * thì props đổi và cache MP4 không trả bản cũ. Kênh chưa có avatar thì null, thẻ kết hiện tên kênh bằng chữ.
 */
export function publishBrandAvatar(dataDir: string, slug: string): string | null {
  if (!/^[a-z0-9-]{1,40}$/.test(slug)) {
    return null;
  }
  for (const ext of BRAND_AVATAR_EXTS) {
    const source = join(dataDir, "brand", slug, `avatar${ext}`);
    if (!existsSync(source)) {
      continue;
    }
    const bytes = readFileSync(source);
    const sha = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
    const key = `brand/${slug}/avatar-${sha}${ext}`;
    const target = join(dataDir, "render", "public", ...key.split("/"));
    if (!existsSync(target)) {
      mkdirSync(join(dataDir, "render", "public", "brand", slug), { recursive: true });
      copyFileSync(source, target);
    }
    return key;
  }
  return null;
}
