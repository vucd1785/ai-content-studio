import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { publishBrandAvatar } from "./brand-avatar.js";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
});

function dataDirWith(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "brand-avatar-"));
  dirs.push(dir);
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(dir, ...path.split("/").slice(0, -1)), { recursive: true });
    writeFileSync(join(dir, ...path.split("/")), body);
  }
  return dir;
}

describe("avatar kênh cho thẻ kết (ADR-028)", () => {
  it("chép avatar sang render/public với tên có hash; đổi ảnh thì đổi khóa", () => {
    const dir = dataDirWith({ "brand/kenh-a/avatar.webp": "anh-1" });
    const key = publishBrandAvatar(dir, "kenh-a");
    expect(key).toMatch(/^brand\/kenh-a\/avatar-[0-9a-f]{12}\.webp$/);
    expect(readdirSync(join(dir, "render", "public", "brand", "kenh-a"))).toEqual([
      key?.split("/").at(-1),
    ]);
    // Gọi lại cùng ảnh: cùng khóa, không chép thêm.
    expect(publishBrandAvatar(dir, "kenh-a")).toBe(key);
    writeFileSync(join(dir, "brand", "kenh-a", "avatar.webp"), "anh-2");
    const next = publishBrandAvatar(dir, "kenh-a");
    expect(next).not.toBe(key);
  });

  it("ưu tiên png; kênh chưa có avatar hoặc slug lạ thì null", () => {
    const dir = dataDirWith({
      "brand/kenh-b/avatar.png": "png",
      "brand/kenh-b/avatar.jpg": "jpg",
    });
    expect(publishBrandAvatar(dir, "kenh-b")).toMatch(/\.png$/);
    expect(publishBrandAvatar(dir, "kenh-khong-co")).toBeNull();
    expect(publishBrandAvatar(dir, "../kenh-b")).toBeNull();
  });
});
