import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { syncPublicIntoBundle } from "./render-backend.js";

/** Giọng đọc ghi sau lúc bundle phải được chép vào `<bundle>/public` trước khi render (lỗi 404 `pipeline/*.wav`). */
describe("syncPublicIntoBundle", () => {
  it("chép file mới hoặc khác kích thước, bỏ qua file đã có", () => {
    const root = mkdtempSync(join(tmpdir(), "public-sync-"));
    const publicDir = join(root, "public");
    const bundleDir = join(root, "bundle");
    mkdirSync(join(publicDir, "pipeline"), { recursive: true });
    mkdirSync(join(bundleDir, "public", "pipeline"), { recursive: true });
    writeFileSync(join(publicDir, "pipeline", "old.wav"), "aaaa");
    writeFileSync(join(bundleDir, "public", "pipeline", "old.wav"), "aaaa");

    writeFileSync(join(publicDir, "pipeline", "edu-new.wav"), "new audio");
    expect(syncPublicIntoBundle(publicDir, bundleDir)).toBe(1);
    expect(readFileSync(join(bundleDir, "public", "pipeline", "edu-new.wav"), "utf8")).toBe(
      "new audio",
    );

    expect(syncPublicIntoBundle(publicDir, bundleDir)).toBe(0);
    writeFileSync(join(publicDir, "pipeline", "old.wav"), "changed size");
    expect(syncPublicIntoBundle(publicDir, bundleDir)).toBe(1);
  });

  it("không có publicDir thì không làm gì", () => {
    const root = mkdtempSync(join(tmpdir(), "public-sync-"));
    expect(syncPublicIntoBundle(join(root, "missing"), join(root, "bundle"))).toBe(0);
  });
});
