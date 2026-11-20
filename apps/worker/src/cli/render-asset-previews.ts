/**
 * Render ảnh xem trước cho Kho hình động (P7-09): `pnpm --dir apps/worker previews` (thêm `--force` để vẽ lại).
 * Chỉ dùng Remotion tại máy, không gọi LLM. Xong thì đồng bộ `motion_assets` để web thấy ảnh.
 */
import { isAbsolute, join, resolve } from "node:path";
import { loadDataDir } from "@studio/config/data-dir";
import { createDbConnection } from "@studio/db";
import { renderMissingPreviews } from "../assets/generate/asset-previews.js";
import { syncAllAssetRows } from "../assets/generate/storyboard-assets.js";
import { resolveRepoRoot } from "./paths.js";

const repoRoot = resolveRepoRoot(import.meta.url);
const rawDataDir = loadDataDir();
const dataDir = isAbsolute(rawDataDir) ? rawDataDir : resolve(repoRoot, rawDataDir);
const kitSrc = join(repoRoot, "packages", "motion-kit", "src");

const result = await renderMissingPreviews(dataDir, kitSrc, {
  force: process.argv.includes("--force"),
  log: (line) => console.log(line),
});
console.log(`đã vẽ ${result.rendered.length} ảnh, lỗi ${result.failed.length}`);
for (const f of result.failed) {
  console.log(`  lỗi ${f.id}: ${f.error}`);
}
const { db, close } = createDbConnection(
  process.env.DATABASE_URL ?? "postgresql://studio:studio@localhost:5432/studio",
);
console.log(`đồng bộ motion_assets: ${await syncAllAssetRows(db, kitSrc, dataDir)} hàng đổi`);
await close();
