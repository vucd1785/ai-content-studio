import type { GeneratableKind } from "./type-check.js";

/**
 * Tiêu chí chất lượng của đồ vật và bối cảnh tự tạo (ADR-022). Một bộ dùng chung cho hai việc:
 * - prompt gửi Claude Code nêu từng tiêu chí (`rule`), nên hình mới được vẽ theo đúng chuẩn sẽ bị chấm;
 * - trước khi dùng lại hình có sẵn, worker chấm mã nguồn của hình đó. Đạt hết thì dùng lại (không tốn token),
 *   thiếu tiêu chí nào thì tạo mới như thường.
 * Chấm bằng đọc mã nguồn, không render, không gọi model: nhanh, tất định, chạy được với mọi hình trong kho.
 * Hành động và tư thế không chấm ở đây (đã có kiểm rig).
 */
export type QualityCriterion = {
  id: string;
  /** Tên tiêu chí cho log và báo cáo (tiếng Việt). */
  label: string;
  /** Câu dặn Claude Code trong prompt (tiếng Anh, như phần còn lại của prompt). */
  rule: string;
};

export type QualityIssue = { id: string; label: string; rule: string };

export const PROP_MIN_SHAPES = 8;
export const PROP_MIN_COLORS = 4;
export const BACKGROUND_MIN_SHAPES = 15;
export const BACKGROUND_MIN_COLORS = 6;
export const BACKGROUND_MIN_GRADIENTS = 2;

const PROP_CRITERIA = {
  detail: {
    id: "detail",
    label: `đủ chi tiết (ít nhất ${PROP_MIN_SHAPES} hình vẽ)`,
    rule: `Rich detail: at least ${PROP_MIN_SHAPES} drawn shapes (main body, secondary parts, small details such as highlights, rivets, leaves, sparkles).`,
  },
  colors: {
    id: "colors",
    label: `đủ màu (ít nhất ${PROP_MIN_COLORS} màu)`,
    rule: `Color: at least ${PROP_MIN_COLORS} distinct colors, a clear base color plus a lighter highlight tone and a darker shade tone.`,
  },
  depth: {
    id: "depth",
    label: "có khối (gradient hoặc lớp sáng/tối)",
    rule: "Volume: give it depth with a <linearGradient>/<radialGradient> (id prefixed mk-gen-) or with at least two semi-transparent highlight/shade layers (opacity).",
  },
  alive: {
    id: "alive",
    label: "sinh động (chuyển động theo frame)",
    rule: "Alive: animate from frame (squash and stretch, sway, sparkle, glow pulse, a small secondary motion), always a gentle loop, never static.",
  },
  outline: {
    id: "outline",
    label: "có nét viền",
    rule: "Outline: bold dark outline (stroke PALETTE.ink) on the main shapes, like the example.",
  },
  sky: {
    id: "sky",
    label: "vật trên trời không chân đế, không bóng đất",
    rule: "Sky things (sun, moon, rainbow, cloud, rain, star, light ray, lightning) have no stand, pole, base or ContactShadow.",
  },
} satisfies Record<string, QualityCriterion>;

const BACKGROUND_CRITERIA = {
  detail: {
    id: "detail",
    label: `đủ chi tiết (ít nhất ${BACKGROUND_MIN_SHAPES} hình vẽ)`,
    rule: `Rich detail: at least ${BACKGROUND_MIN_SHAPES} drawn shapes with a foreground, middle ground and far layer.`,
  },
  colors: {
    id: "colors",
    label: `đủ màu (ít nhất ${BACKGROUND_MIN_COLORS} màu)`,
    rule: `Color: at least ${BACKGROUND_MIN_COLORS} distinct colors in one harmonious palette; keep the area behind the characters calmer and less saturated so they stand out.`,
  },
  depth: {
    id: "depth",
    label: `có chiều sâu (ít nhất ${BACKGROUND_MIN_GRADIENTS} gradient)`,
    rule: `Depth: at least ${BACKGROUND_MIN_GRADIENTS} gradients (sky or wall, floor or ground) and atmospheric perspective (far things lighter).`,
  },
  alive: {
    id: "alive",
    label: "sinh động (chuyển động nhẹ theo frame)",
    rule: "Alive: gentle ambient motion from frame (clouds drifting, leaves swaying, water shimmer, light flicker).",
  },
  // ADR-023: ba lớp chiều sâu, kit cho các lớp trượt lệch nhau theo camera.
  layers: {
    id: "layers",
    label: "ba lớp chiều sâu (Far, Component, Near)",
    rule: "Layers: the asset exports three layers, { stage, Far, Component, Near }: Far (sky or back wall and distant things), Component (the middle ground where the characters stand) and Near (a few foreground silhouettes).",
  },
} satisfies Record<string, QualityCriterion>;

/** Tiêu chí đưa vào prompt theo loại tài sản; hành động và tư thế không có. */
export function qualityCriteria(kind: GeneratableKind): QualityCriterion[] {
  if (kind === "prop") {
    return Object.values(PROP_CRITERIA);
  }
  if (kind === "background") {
    return Object.values(BACKGROUND_CRITERIA);
  }
  return [];
}

/** Từ khóa vật trên trời (tiếng Việt có dấu và tiếng Anh): mô tả hay tag có từ này thì cấm bóng đất. */
const SKY_WORDS = [
  "mặt trời",
  "mặt trăng",
  "trăng",
  "cầu vồng",
  "đám mây",
  "mây",
  "mưa",
  "giọt nước",
  "ngôi sao",
  "vì sao",
  "tia nắng",
  "ánh nắng",
  "tia sáng",
  "tia chớp",
  "sấm sét",
  "bầu trời",
  "sun",
  "moon",
  "rainbow",
  "cloud",
  "rain",
  "star",
  "lightning",
];

/** Số chữ đầu của mô tả nói vật chính là gì; phần sau tả cảnh xung quanh ("lăng kính ... tia nắng"). */
const HEAD_WORDS = 6;

/**
 * Vật trên trời theo phần đầu của mô tả (so khớp nguyên từ, có dấu, để "mây" không khớp "máy").
 * Không xét tag: tag hay chứa từ của chủ đề (lăng kính có tag "cầu vồng").
 */
export function isSkyThing(description: string): boolean {
  const words = description
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .slice(0, HEAD_WORDS);
  const t = ` ${words.join(" ")} `;
  return SKY_WORDS.some((w) => t.includes(` ${w} `));
}

const SHAPE_TAG = /<(path|circle|ellipse|rect|polygon|polyline|line)\b/g;
/** Một vòng lặp vẽ (map, for, Array.from) tính như nhiều hình. */
const LOOP = /\.map\(|\bfor\s*\(|Array\.from\(/g;
const LOOP_WEIGHT = 3;

const count = (source: string, re: RegExp) => source.match(re)?.length ?? 0;

/** Số hình vẽ ước lượng từ mã nguồn. */
export function shapeCount(source: string): number {
  return count(source, SHAPE_TAG) + LOOP_WEIGHT * count(source, LOOP);
}

/** Số màu khác nhau: mã hex, `PALETTE.x`, `rgb()/hsl()`. */
export function colorCount(source: string): number {
  const colors = new Set<string>();
  for (const m of source.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)) {
    colors.add(m[0].toLowerCase());
  }
  for (const m of source.matchAll(/PALETTE\.(\w+)/g)) {
    colors.add(`palette:${m[1]}`);
  }
  for (const m of source.matchAll(/\b(?:rgba?|hsla?)\([^)]*\)/g)) {
    colors.add(m[0].replace(/\s+/g, ""));
  }
  return colors.size;
}

const gradientCount = (source: string) => count(source, /<(linearGradient|radialGradient)\b/g);
const opacityLayers = (source: string) => count(source, /\bopacity=/g);
/** `frame` dùng trong biểu thức (không chỉ trong khai báo props). */
const usesFrame = (source: string) => count(source, /\bframe\b/g) >= 2;
const usesShadow = (source: string) => /<ContactShadow\b/.test(source);
/** Đối tượng `asset` có khóa lớp `Far` hoặc `Near` (viết tắt `Far,` hoặc `Far: X`). */
const exportsLayer = (source: string, name: "Far" | "Near") =>
  new RegExp(`[{,]\\s*${name}\\s*[,:}]`).test(source);
const hasOutline = (source: string) =>
  /\bstroke=\{?\s*(?:PALETTE\.ink|ink|INK|"#2b2b3a")/.test(source);

/**
 * Chấm một đồ vật hoặc bối cảnh. `description` là mô tả vật (để biết vật trên trời).
 * Trả danh sách tiêu chí chưa đạt; rỗng là đạt.
 */
export function checkAssetQuality(
  kind: string,
  source: string,
  description: string,
): QualityIssue[] {
  const fail: QualityCriterion[] = [];
  if (kind === "prop") {
    const c = PROP_CRITERIA;
    if (shapeCount(source) < PROP_MIN_SHAPES) fail.push(c.detail);
    if (colorCount(source) < PROP_MIN_COLORS) fail.push(c.colors);
    if (gradientCount(source) === 0 && opacityLayers(source) < 2) fail.push(c.depth);
    if (!usesFrame(source)) fail.push(c.alive);
    if (!hasOutline(source)) fail.push(c.outline);
    if (isSkyThing(description) && usesShadow(source)) fail.push(c.sky);
  } else if (kind === "background") {
    const c = BACKGROUND_CRITERIA;
    if (shapeCount(source) < BACKGROUND_MIN_SHAPES) fail.push(c.detail);
    if (colorCount(source) < BACKGROUND_MIN_COLORS) fail.push(c.colors);
    if (gradientCount(source) < BACKGROUND_MIN_GRADIENTS) fail.push(c.depth);
    if (!usesFrame(source)) fail.push(c.alive);
    if (!exportsLayer(source, "Far") || !exportsLayer(source, "Near")) fail.push(c.layers);
  }
  return fail.map(({ id, label, rule }) => ({ id, label, rule }));
}
