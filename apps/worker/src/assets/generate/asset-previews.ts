import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  createDefaultStoryboardRenderer,
  type StoryboardRenderer,
  stillRenderProps,
} from "../../render/storyboard-backend.js";
import type { StillSpec } from "../../render/storyboard-checks.js";
import { listManifests } from "./registry.js";
import { previewStorageKey } from "./render-check.js";

/** Nhân vật dùng cho ảnh xem trước theo skin (skin lạ thì Tí). */
const CHARACTER_BY_SKIN: Record<string, string> = {
  skin_ti: "ti",
  skin_bit: "bit",
  skin_dau: "dau",
};

/**
 * Cảnh mẫu để xem một tài sản bất kỳ (P7-09): Tí đứng giữa phòng, thay đúng phần của tài sản.
 * Loại không vẽ được trong một ảnh tĩnh (sfx, brand_card) trả null.
 */
export function previewSpec(kind: string, id: string): StillSpec | null {
  const actor = {
    character: "ti",
    skin: "skin_ti",
    action: "pose_stand",
    expression: "expr_happy",
    slot: "center" as const,
  };
  const base: StillSpec = {
    background: "bg_room",
    shotSize: "medium",
    camera: "cam_static",
    focus: "ti",
    props: [],
    actors: [actor],
    caption: { speaker: "ti", text: "", color: "#ffffff" },
    placeholderAssetIds: [],
  };
  switch (kind) {
    case "background":
      return { ...base, background: id, shotSize: "wide" };
    case "prop":
      return { ...base, shotSize: "wide", props: [id], actors: [{ ...actor, slot: "left" }] };
    case "action":
    case "pose":
      return { ...base, actors: [{ ...actor, action: id }] };
    case "expression":
      return { ...base, shotSize: "close", actors: [{ ...actor, expression: id }] };
    case "character_skin": {
      const character = CHARACTER_BY_SKIN[id] ?? "ti";
      return { ...base, focus: character, actors: [{ ...actor, character, skin: id }] };
    }
    case "camera":
      return { ...base, camera: id, shotSize: "wide" };
    default:
      return null;
  }
}

/**
 * Render ảnh xem trước cho mọi tài sản trong kho chưa có ảnh (Remotion tại máy, không gọi LLM).
 * Một bundle cho cả lượt. Trả danh sách id đã render và id lỗi.
 */
export async function renderMissingPreviews(
  dataDir: string,
  kitSrc: string,
  options: { renderer?: StoryboardRenderer; force?: boolean; log?: (line: string) => void } = {},
): Promise<{ rendered: string[]; failed: { id: string; error: string }[] }> {
  const renderer = options.renderer ?? createDefaultStoryboardRenderer();
  const log = options.log ?? (() => {});
  const rendered: string[] = [];
  const failed: { id: string; error: string }[] = [];
  mkdirSync(join(dataDir, "motion-assets"), { recursive: true });
  for (const manifest of listManifests(kitSrc)) {
    const target = join(dataDir, previewStorageKey(manifest.id));
    if (!options.force && existsSync(target)) {
      continue;
    }
    const spec = previewSpec(manifest.kind, manifest.id);
    if (spec === null) {
      continue;
    }
    try {
      await renderer.renderStill(
        stillRenderProps(spec, {
          fontFamily: "system-ui, sans-serif",
          textColor: "#ffffff",
          speakerColors: {},
        }),
        // Sau đà của hành động: tư thế giữ.
        30,
        target,
      );
      rendered.push(manifest.id);
      log(`ảnh xem trước: ${manifest.id}`);
    } catch (error) {
      failed.push({
        id: manifest.id,
        error: error instanceof Error ? (error.message.split("\n")[0] ?? "") : String(error),
      });
    }
  }
  return { rendered, failed };
}
