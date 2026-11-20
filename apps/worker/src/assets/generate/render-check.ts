import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { registerGeneratedAsset } from "@studio/motion-kit";
import {
  createDefaultStoryboardRenderer,
  stillRenderProps,
} from "../../render/storyboard-backend.js";
import type { StillSpec } from "../../render/storyboard-checks.js";
import { assetDir, assetFileName } from "./registry.js";
import { checkRigClip } from "./rig-check.js";
import type { GeneratableKind } from "./type-check.js";

/** Khóa `DATA_DIR` của ảnh xem trước tài sản (ADR-016: đường dẫn ảnh dưới `DATA_DIR`). */
export const previewStorageKey = (id: string) => `motion-assets/${id}.png`;

const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

/** Một cảnh rộng có Tí đứng bên trái và tài sản cần thử. */
function checkSpec(kind: GeneratableKind, id: string): StillSpec {
  return {
    background: kind === "background" ? id : "bg_room",
    // Hành động và tư thế xem ở cỡ trung để thấy rõ tay chân; đồ vật và bối cảnh ở cỡ rộng.
    shotSize: kind === "action" || kind === "pose" ? "medium" : "wide",
    camera: "cam_static",
    focus: "ti",
    props: kind === "prop" ? [id] : [],
    actors: [
      {
        character: "ti",
        skin: "skin_ti",
        action: kind === "action" || kind === "pose" ? id : "pose_stand",
        expression: "expr_happy",
        slot: kind === "action" || kind === "pose" ? "center" : "left",
      },
    ],
    caption: { speaker: "ti", text: "Xem thử", color: "#ffffff" },
    placeholderAssetIds: [],
  };
}

/**
 * Render thử tài sản trong Chromium của Remotion bằng bundle mới (ADR-017 mục 2.4):
 * cùng frame hai lần phải ra cùng ảnh; đồ vật phải có chuyển động. Đạt thì lưu ảnh xem trước và
 * đăng ký tài sản vào danh mục của tiến trình worker (code đã qua kiểm AST và typecheck).
 */
export async function renderCheckAsset(
  dataDir: string,
  kitSrc: string,
  asset: { kind: GeneratableKind; id: string },
): Promise<string | null> {
  // Nạp module trước khi render: hành động và tư thế phải qua luật tay của rig (rẻ, không cần Chromium).
  // Query `?v=` tránh cache ESM khi lần thử thứ hai ghi code mới vào cùng đường dẫn.
  const file = join(assetDir(kitSrc, asset.kind, asset.id), assetFileName(asset.kind));
  const mod = (await import(`${pathToFileURL(file).href}?v=${Date.now()}`)) as { asset?: unknown };
  if (mod.asset === undefined) {
    return "file không xuất `asset`";
  }
  if (asset.kind === "action" || asset.kind === "pose") {
    const rigError = checkRigClip(mod.asset as never);
    if (rigError !== null) {
      return rigError;
    }
  }
  const dir = join(dataDir, "motion-assets", "check", asset.id);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const renderer = createDefaultStoryboardRenderer();
  const props = stillRenderProps(checkSpec(asset.kind, asset.id), {
    fontFamily: "system-ui, sans-serif",
    textColor: "#ffffff",
    speakerColors: { ti: "#ffb08a" },
  });
  const a = join(dir, "f24-a.png");
  const b = join(dir, "f24-b.png");
  // Frame lẻ so với 24 để vòng lặp của hành động khó trùng pha ngẫu nhiên.
  const c = join(dir, "f47.png");
  try {
    await renderer.renderStill(props, 24, a);
    await renderer.renderStill(props, 24, b);
    await renderer.renderStill(props, 47, c);
  } catch (error) {
    return `không render được: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`;
  }
  if (sha(a) !== sha(b)) {
    return "cùng frame render hai lần ra hai ảnh khác nhau (không thuần frame)";
  }
  if ((asset.kind === "prop" || asset.kind === "action") && sha(a) === sha(c)) {
    return `${asset.kind === "prop" ? "đồ vật" : "hành động"} không có chuyển động nào giữa frame 24 và 47`;
  }
  mkdirSync(join(dataDir, "motion-assets"), { recursive: true });
  copyFileSync(a, join(dataDir, previewStorageKey(asset.id)));
  rmSync(dir, { recursive: true, force: true });
  registerGeneratedAsset(asset.kind, asset.id, mod.asset as never);
  return null;
}
