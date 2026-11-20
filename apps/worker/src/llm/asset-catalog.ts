import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MOTION_ASSET_KINDS, type MotionAssetKind } from "@studio/contracts";
import { resolveRepoRoot } from "../cli/paths.js";
import type { CatalogEntry } from "./script-v2-prompt.js";

type Manifest = {
  id?: unknown;
  kind?: unknown;
  status?: unknown;
  brandProfile?: unknown;
  description?: unknown;
  tags?: unknown;
  requestKey?: unknown;
};

/**
 * Kho tài sản được phép dùng trong prompt script `2` (ADR-016): đọc `asset.json` của motion kit trong repo.
 * Manifest là nguồn sự thật; bảng `motion_assets` là bản sao chưa được đồng bộ (script đồng bộ ở P6-13).
 * Chỉ lấy tài sản `approved`, dùng chung (`brandProfile` null) hoặc của đúng kênh (theo slug).
 */
export function loadApprovedAssetCatalog(
  brandSlug: string,
  assetsDir = join(resolveRepoRoot(import.meta.url), "packages", "motion-kit", "src", "assets"),
): CatalogEntry[] {
  if (!existsSync(assetsDir)) {
    return [];
  }
  const out: CatalogEntry[] = [];
  for (const kind of readdirSync(assetsDir)) {
    if (!(MOTION_ASSET_KINDS as readonly string[]).includes(kind)) {
      continue;
    }
    for (const id of readdirSync(join(assetsDir, kind))) {
      const path = join(assetsDir, kind, id, "asset.json");
      if (!existsSync(path)) {
        continue;
      }
      const manifest = JSON.parse(readFileSync(path, "utf8")) as Manifest;
      const brand = manifest.brandProfile;
      if (
        manifest.id !== id ||
        manifest.kind !== kind ||
        manifest.status !== "approved" ||
        (brand !== null && brand !== brandSlug)
      ) {
        continue;
      }
      out.push({
        id,
        kind: kind as MotionAssetKind,
        description: typeof manifest.description === "string" ? manifest.description : "",
        tags: Array.isArray(manifest.tags)
          ? manifest.tags.filter((t) => typeof t === "string")
          : [],
        // Tài sản tự tạo theo yêu cầu của một run có `requestKey` (ADR-017); tài sản làm tay thì null.
        ...(typeof manifest.requestKey === "string" ? { generated: true } : {}),
      });
    }
  }
  return out.sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
}
