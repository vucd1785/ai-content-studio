import { readFileSync } from "node:fs";
import { join } from "node:path";
import { easing, PALETTE } from "@studio/motion-kit";
import { qualityCriteria } from "./quality.js";
import type { GeneratableKind } from "./type-check.js";

/** Một yêu cầu tài sản của kịch bản `creative` (contracts `AssetRequest`) kèm ngữ cảnh. */
export type GenerationRequest = {
  kind: GeneratableKind;
  description: string;
  /** Id đề xuất, đã kiểm định dạng và không trùng kho. */
  suggestedId: string;
  /** Chủ đề video để model chọn chi tiết hợp ngữ cảnh. */
  topic: string;
};

/** Đầu ra JSON của model; code được kiểm AST, typecheck, render trước khi dùng. */
export type GeneratedAssetDraft = {
  description: string;
  tags: string[];
  code: string;
};

/**
 * Vai trò (ADR-022, Director 2026-11-12): họa sĩ chính kiêm đạo diễn hoạt hình của kênh giáo dục thiếu nhi.
 * Vai trò chỉ định giọng; tiêu chí đo được nằm ở `quality.ts` và được chấm lại sau khi model trả hình.
 */
export const GENERATION_ROLE =
  "You are a senior 2D animation art director and illustrator at a professional studio making educational cartoon videos for Vietnamese children aged 6-12, in a friendly flat style (think high-quality kids' explainer channels). Every asset must read instantly at phone size, look polished and appealing, and feel alive on screen.";

/**
 * Đúng các hàm và màu kit có, lấy từ chính motion kit để không lệch khi kit đổi. Claude từng đoán tên
 * (`easing.easeInOutCubic`, `easing.inOutSine`) và mất một lượt thử vì lỗi typecheck (2026-11-12).
 */
const EASING_NAMES = Object.keys(easing);
export const KIT_API = [
  "Exact helper API (nothing else exists; never invent names):",
  `easing has only ${EASING_NAMES.map((k) => (k === "outBack" ? "outBack(s?) which returns an easing function" : k)).join(", ")}; each easing takes t in 0..1 and returns a number, e.g. easing.inOut(t), easing.outBack(1.4)(t).`,
  "lerp(a, b, t); clamp(v, lo, hi); rnd(seed, i) returns a stable number in [0, 1); wobble(frame, seed, period) returns a smooth number in [-1, 1].",
  `PALETTE keys: ${Object.keys(PALETTE).join(", ")}. For a color not in PALETTE write a hex string literal.`,
].join(" ");

export const GENERATION_SYSTEM_INSTRUCTION = [
  GENERATION_ROLE,
  "You write one self-contained TypeScript file for a Remotion motion kit: a React (TSX) component that draws a flat 2D cartoon prop or background as SVG, or (for kinds action and pose) plain pose keyframe data for the shared character rig.",
  "Return JSON only: { description, tags, code }. description and tags are Vietnamese. code is the whole file.",
  "The asset must be a pure function of its props: same props, same SVG. Animate only from frame and t. No randomness, no time, no hooks, no effects.",
  "Never draw text, letters or numbers. No images, no links, no scripts, no event handlers, no external data.",
  "Import only from: react, ../../../palette.js (PALETTE), ../../../rig/math.js (easing, lerp, clamp, rnd, wobble), ../../../rig/pose.js (pose, holdClip, ActionClip), ../../../stage/types.js (types), ../../../stage/generated-stage.js (GENERATED_WIDE_BACKGROUND_STAGE), ../../prop/prop_server/index.js (ContactShadow).",
  KIT_API,
  "Use colors from PALETTE when possible, bold dark outlines (PALETTE.ink, strokeWidth 5-8) and soft flat fills, matching the example.",
  "Craft like a pro animator: a clear silhouette, appealing proportions (slightly rounded, chunky shapes), a light source from the top-left (highlight on that side, shade on the other), and motion with easing and follow-through rather than linear wiggles.",
  "Do not use classes, Function, eval, globalThis, window, document, process, Date, Math.random, element access with string keys, or the identifiers constructor/prototype.",
].join(" ");

const PROP_RULES = [
  "Kind prop, placement floor: it stands on the ground. The origin (0,0) is the ground point under its center; draw upward (negative y).",
  'Export exactly: export const asset: PropAsset = { placement: "floor", halfWidth, height, Component };',
  "halfWidth is a number literal from 40 to 90: everything you draw (including the shadow) must fit within x -halfWidth..+halfWidth, so draw compactly (a bed or sofa is drawn short and narrow, about 170 wide). height is a number literal up to 320 and is the top of the drawing. Keep it inside those bounds.",
  "Component props: PropProps = { frame, t, seed }. Add a subtle loop (blink, sway, pulse) from frame so it is alive.",
  "If the thing stands on the ground (table, tree, machine), start with <ContactShadow halfWidth={...} /> for a ground shadow.",
  // Bổ sung 2026-11-12 (3): minh họa `scene` vẽ đồ vật lên bầu trời của cảnh; chân đế hay bóng đất trông như treo lơ lửng.
  "If the thing lives in the sky or floats (sun, moon, rainbow, cloud, rain drop, star, light ray), draw only the thing itself: no stand, pole, base, table or ground shadow; the drawing may still use the same origin and bounds.",
];

const BACKGROUND_RULES = [
  "Kind background: a full scene behind the characters. The video may be vertical 9:16 (sees about x 0..1080) or wide 16:9 (sees about x -420..1500), so fill the whole area x -440..1520, y 0..2615 (camera can zoom out). Keep the key scenery inside x 0..1080 and continue it naturally to both sides (more sky, ground, trees, wall, furniture), never a blank or repeated strip.",
  "The floor line is at y=1580: wall/sky above, floor below; characters stand on y=1580 around x=310, 540, 770, so keep that band uncluttered.",
  // ADR-023: ba lớp, kit cho trượt lệch nhau (parallax) và làm mờ tiền cảnh.
  "Draw the scene as three depth layers, each its own component with props BackgroundProps = { frame, lightShaft? }; the kit slides them at different speeds when the camera moves, like the example.",
  "Far: the farthest things. Outdoors: sky gradient, sun or moon, clouds, distant hills, skyline, lighter and less saturated with distance. Indoors: the back wall with its window, shelves and pictures. Far must paint the whole area x -440..1520, y 0..2615 with no holes (start with a full rect).",
  "Component: the middle ground where the characters stand: ground or floor from about y=1500 down to y=2615 across the whole width, plus trees, furniture, buildings beside the standing band. Leave everything above the ground/floor transparent so Far shows through (no full-size background rect here).",
  "Near: 3-6 big, simple, dark foreground silhouettes (grass blades, leaves, a rock, a desk corner, a curtain edge) only in the bottom corners: tops no higher than y=1650, bases around y=2100, placed at x -400..150 and x 930..1480. Nothing between x 200 and 880. No outlines; the kit blurs this layer.",
  "Export exactly: export const asset: BackgroundAsset = { stage: GENERATED_WIDE_BACKGROUND_STAGE, Far, Component, Near };",
  "Use frame only for gentle ambient motion. About 20-40 shapes in total; use <defs> gradients with ids prefixed mk-gen- and repeat the <defs> in each layer that uses them.",
  "Draw neutral daylight colors: the kit adds the lighting mood (sunset, night, danger) on top, so do not darken or tint the whole scene yourself unless the description is specifically a night or sunset place.",
];

const RIG_RULES = [
  "The characters share one 2D rig. A Pose is { armA, armB, legA, legB, lean, tilt, hop, squash }.",
  "Each limb is [upper angle, lower bend relative to upper] in degrees: 0 points down, 90 points to screen right, 180 points up, -90 to screen left. armA/legA are on the screen-left side, armB/legB on the screen-right side.",
  "lean tilts the body around the hip (degrees, keep within -15..15), tilt tilts the head (within -20..20), hop lifts the whole body in px (0..40), squash scales the body vertically (0.85..1.15).",
  "Build poses with pose({ ...partial }) which starts from the rest pose (arms down, legs straight). Use easing from ../../../rig/math.js for keys.",
  "Keep hands and forearms out of the face: an upper arm raised above about 100 degrees with the forearm folded toward the head crosses the face; prefer the elbow low and the forearm raised beside the head, as in the example.",
  "The file is plain TypeScript (.ts), no JSX, no React. Import only from ../../../rig/math.js and ../../../rig/pose.js.",
];

const ACTION_RULES = [
  ...RIG_RULES,
  "Kind action: an ActionClip of keyframes at 30 fps: anticipation, overshoot to the main pose, then a short readable loop. First key at frame 0 is pose({}) (it is replaced by the previous shot's pose).",
  "Export exactly: export const asset: ActionClip = { keys: [...], cycle: { from, to } }; the loop must visibly move (between 6 and 30 frames long).",
];

const POSE_RULES = [
  ...RIG_RULES,
  "Kind pose: a held body position. Export exactly: export const asset: ActionClip = holdClip(pose({ ... })); you may add a subtle breathing loop instead with keys and cycle if it helps.",
];

/** Đọc một tài sản mẫu trong repo để model bắt chước nét vẽ và API. */
function example(motionKitSrc: string, kind: GeneratableKind): string {
  const path = {
    prop: join(motionKitSrc, "assets", "prop", "prop_router_infected", "index.tsx"),
    background: join(motionKitSrc, "assets", "background", "bg_meadow", "index.tsx"),
    action: join(motionKitSrc, "assets", "action", "action_panic", "index.ts"),
    pose: join(motionKitSrc, "assets", "pose", "pose_hero", "index.ts"),
  }[kind];
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

export function buildGenerationPrompt(motionKitSrc: string, req: GenerationRequest): string {
  const rules = {
    prop: PROP_RULES,
    background: BACKGROUND_RULES,
    action: ACTION_RULES,
    pose: POSE_RULES,
  }[req.kind];
  // ADR-022: cùng bộ tiêu chí worker chấm lại sau khi nhận file; thiếu tiêu chí là phải sửa.
  const criteria = qualityCriteria(req.kind);
  const quality =
    criteria.length === 0
      ? []
      : [
          "",
          "Quality bar (the file is checked against every point; a file that misses one is sent back):",
          ...criteria.map((c) => `- ${c.rule}`),
        ];
  return [
    `Video topic: ${req.topic}`,
    `Asset kind: ${req.kind}`,
    `What it must show (from the script, Vietnamese): ${req.description}`,
    `The file will live at packages/motion-kit/src/assets/${req.kind}/${req.suggestedId}/${req.kind === "action" || req.kind === "pose" ? "index.ts" : "index.tsx"}.`,
    "",
    ...rules,
    ...quality,
    "",
    "Example asset from the same kit (copy its drawing style and code style, not its content):",
    req.kind === "action" || req.kind === "pose" ? "```ts" : "```tsx",
    example(motionKitSrc, req.kind),
    "```",
    "",
    "Return { description: one Vietnamese sentence of what is drawn and how it moves, tags: 3-6 short Vietnamese keywords someone would use to look for it, code }.",
  ].join("\n");
}

export const GENERATION_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    description: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
    code: { type: "string" },
  },
  required: ["description", "tags", "code"],
};

export function parseDraft(value: unknown): GeneratedAssetDraft | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const v = value as Record<string, unknown>;
  if (typeof v.code !== "string" || typeof v.description !== "string" || !Array.isArray(v.tags)) {
    return null;
  }
  const tags = v.tags.filter((t): t is string => typeof t === "string" && t.trim() !== "");
  return {
    code: v.code.replace(/^```(?:tsx?)?\s*\n/, "").replace(/\n```\s*$/, ""),
    description: v.description.trim().slice(0, 300),
    tags: tags.map((t) => t.trim().slice(0, 40)).slice(0, 8),
  };
}
