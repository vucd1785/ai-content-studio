import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GeneratableKind } from "./type-check.js";

/**
 * Ghi tài sản tự tạo vào `packages/motion-kit/src/assets` (ADR-017 mục 2.5).
 * Tài sản tự tạo có `requestKey` khác null; tài sản làm tay có `requestKey: null` và đăng ký trong `index.ts`.
 */
export type AssetManifest = {
  id: string;
  kind: string;
  version: string;
  description: string;
  tags: string[];
  brandProfile: string | null;
  createdBy: "director" | "claude-code";
  status: "candidate" | "approved";
  requestKey: string | null;
  licenses: AssetLicense[];
};

/**
 * Giấy phép của tài sản. Tài sản Claude vẽ không có; tài sản lấy từ nguồn (cờ, ảnh thật, ADR-029, ADR-030) ghi
 * tên giấy phép, nguồn, tác giả để bộ đăng bài ghi công khi giấy phép yêu cầu.
 */
export type AssetLicense =
  | string
  | {
      name: string;
      source: string;
      author?: string;
      url?: string;
      file?: string;
      /** Dòng ghi công đưa vào mô tả video; có thì bộ đăng bài bắt buộc ghi. */
      attribution?: string;
    };

export const GENERATABLE_KINDS: readonly GeneratableKind[] = [
  "prop",
  "background",
  "action",
  "pose",
];

/** Đồ vật và bối cảnh là component SVG (`.tsx`); hành động và tư thế là dữ liệu khung khóa (`.ts`). */
export const assetFileName = (kind: string) =>
  kind === "action" || kind === "pose" ? "index.ts" : "index.tsx";

export const assetDir = (kitSrc: string, kind: string, id: string) =>
  join(kitSrc, "assets", kind, id);

export function readManifest(kitSrc: string, kind: string, id: string): AssetManifest | null {
  const path = join(assetDir(kitSrc, kind, id), "asset.json");
  if (!existsSync(path)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, "utf8")) as AssetManifest;
  } catch {
    return null;
  }
}

/** Mọi manifest trong kho (mọi trạng thái), để tìm tài sản dùng lại được. */
export function listManifests(kitSrc: string): AssetManifest[] {
  const root = join(kitSrc, "assets");
  const out: AssetManifest[] = [];
  for (const kind of readdirSync(root, { withFileTypes: true })) {
    if (!kind.isDirectory()) {
      continue;
    }
    for (const id of readdirSync(join(root, kind.name), { withFileTypes: true })) {
      if (id.isDirectory()) {
        const m = readManifest(kitSrc, kind.name, id.name);
        if (m !== null) {
          out.push(m);
        }
      }
    }
  }
  return out;
}

export function writeAssetFiles(kitSrc: string, manifest: AssetManifest, code: string): string {
  const dir = assetDir(kitSrc, manifest.kind, manifest.id);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, assetFileName(manifest.kind));
  writeFileSync(file, code.endsWith("\n") ? code : `${code}\n`, "utf8");
  writeManifest(kitSrc, manifest);
  return file;
}

export function writeManifest(kitSrc: string, manifest: AssetManifest): void {
  const dir = assetDir(kitSrc, manifest.kind, manifest.id);
  writeFileSync(join(dir, "asset.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

export function removeAsset(kitSrc: string, kind: string, id: string): void {
  rmSync(assetDir(kitSrc, kind, id), { recursive: true, force: true });
}

const camel = (id: string) => `gen_${id}`;

/** Sinh lại `assets/generated.ts` từ các thư mục tài sản tự tạo đang có. */
export function rewriteGeneratedRegistry(kitSrc: string): { kind: string; id: string }[] {
  const generated = listManifests(kitSrc)
    .filter(
      (m) => m.requestKey !== null && (GENERATABLE_KINDS as readonly string[]).includes(m.kind),
    )
    .filter((m) => existsSync(join(assetDir(kitSrc, m.kind, m.id), assetFileName(m.kind))))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
  const imports = generated.map(
    (m) => `import { asset as ${camel(m.id)} } from "./${m.kind}/${m.id}/index.js";`,
  );
  const entries = (kind: string) =>
    generated
      .filter((m) => m.kind === kind)
      .map((m) => `    ${m.id}: ${camel(m.id)},`)
      .join("\n");
  const block = (kind: string) =>
    `  ${kind}: {${entries(kind) === "" ? "" : `\n${entries(kind)}\n  `}},`;
  const body = [
    'import type { ActionClip } from "../rig/pose.js";',
    'import type { BackgroundAsset, PropAsset } from "../stage/types.js";',
    ...imports,
    "",
    "/**",
    " * Tài sản do worker tự tạo bằng Claude Code headless (ADR-017). File này do worker sinh lại sau mỗi lần",
    " * thêm hoặc bỏ tài sản; không sửa tay. Tài sản ở đây có `asset.json` trạng thái `candidate` cho tới khi",
    " * Director duyệt phương án dùng nó ở Cổng 1.",
    " */",
    "export const GENERATED_ASSETS: {",
    "  prop: Record<string, PropAsset>;",
    "  background: Record<string, BackgroundAsset>;",
    "  action: Record<string, ActionClip>;",
    "  pose: Record<string, ActionClip>;",
    "} = {",
    block("prop"),
    block("background"),
    block("action"),
    block("pose"),
    "};",
    "",
  ];
  writeFileSync(join(kitSrc, "assets", "generated.ts"), body.join("\n"), "utf8");
  return generated.map((m) => ({ kind: m.kind, id: m.id }));
}
