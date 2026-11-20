import {
  actorSlotX,
  characterGeometry,
  defaultFacing,
  type FrameSize,
  getBackground,
  getCamera,
  getMotion,
  getProp,
  getSkin,
  isLandscape,
  layoutProps,
  reserveShift,
  sampleAction,
  shotFraming,
  shotReserve,
  VERTICAL_FRAME,
} from "@studio/motion-kit";
import { z } from "zod/v4";

/**
 * Kiểm tự động ảnh storyboard bằng hình học đã tính, không phân tích ảnh (05 mục Storyboard ảnh tĩnh;
 * ADR-014 bổ sung 2026-11-03: chữ duy nhất trong khung là phụ đề).
 */

export const STORYBOARD_ISSUE_CODES = [
  "storyboard_unsafe_area",
  "storyboard_overlap",
  "storyboard_text_overflow",
  "storyboard_low_contrast",
  "storyboard_placeholder_asset",
] as const;
export type StoryboardIssueCode = (typeof STORYBOARD_ISSUE_CODES)[number];
export type StoryboardIssue = { code: StoryboardIssueCode; message: string };

/** Frame của ảnh tĩnh trong shot: hành động đã qua lấy đà, nhân vật ở tư thế giữ. */
export const STILL_HOLD_FRAME = 24;
/**
 * Mép trên của hộp phụ đề hai dòng trong `StickStory` (P6-21): lề đáy 130, đệm 22 và 26, chữ 58 px × 1,3.
 * 1920 − 130 − (22 + 26 + 2 × 75) = 1592, làm tròn xuống.
 */
export const CAPTION_TOP_Y = 1590;
/**
 * Khung ngang 1920×1080 (ADR-022): lề đáy 36, đệm 14 và 18, chữ 50 px × 1,3.
 * 1080 − 36 − (14 + 18 + 2 × 65) = 882, làm tròn xuống.
 */
export const CAPTION_TOP_Y_WIDE = 880;
/** Mép trên của hộp phụ đề theo khung. */
export const captionTopY = (frame: FrameSize) =>
  isLandscape(frame) ? CAPTION_TOP_Y_WIDE : CAPTION_TOP_Y;
/** Bề ngang một dòng phụ đề (hộp 980, đệm 34 mỗi bên). */
const CAPTION_LINE_WIDTH = 912;
/** Phụ đề xuống dòng được (`pre-wrap`); hộp và vùng an toàn tính cho hai dòng. */
export const CAPTION_TEXT_WIDTH = 2 * CAPTION_LINE_WIDTH;
const CAPTION_FONT_PX = 58;
/** Bề rộng trung bình một ký tự Be Vietnam Pro đậm 700 tính theo cỡ chữ (ước lượng có biên). */
const CHAR_WIDTH_EM = 0.6;
/** Một nhóm phụ đề gom các từ trong 1,2 giây; lời đọc khoảng 300 ms một từ, nên tới 4 từ. */
const WORDS_PER_CAPTION_GROUP = 4;
/** Nền hộp phụ đề `rgba(11,13,18,0.82)` trên khung tối, coi như màu đặc. */
const CAPTION_BACKGROUND = "#0b0d12";

export type StillActor = {
  character: string;
  skin: string;
  action: string;
  expression: string;
  /** Trang phục (ADR-032). */
  outfit?: "spacesuit" | "lab_coat" | "hard_hat" | "business_suit";
  slot: "left" | "center" | "right";
};

export type StillSpec = {
  background: string;
  shotSize: "wide" | "medium" | "close" | "high";
  camera: string;
  focus: string;
  actors: StillActor[];
  /** Id tài sản `prop` của shot (P6-19); đặt theo `layoutProps` như `StageShot`. */
  props: string[];
  caption: { speaker: string; text: string; color: string };
  /** Shot dùng tài sản tạm thay cho một yêu cầu tài sản `creative` còn mở. */
  placeholderAssetIds: string[];
  /** Minh họa của shot (ADR-014 bổ sung 2026-11-11). */
  illustration?: { style: "scene" | "bubble" | "board"; owner: string; items: string[] };
  /** Tông ánh sáng của shot (ADR-023). */
  mood?: "day" | "warm" | "cool" | "night" | "danger" | "wonder";
  /** Hiệu ứng điểm nhấn của shot (ADR-025). */
  effects?: ("flash" | "impact" | "speed_lines" | "sparkle" | "idea" | "confetti" | "question")[];
};

type Box = { x0: number; y0: number; x1: number; y1: number };

/** Vị trí đầu và thân của từng nhân vật trên khung (mặc định 1080×1920), theo đúng phép tính của `StageShot`. */
export function screenLayout(spec: StillSpec, frame: FrameSize = VERTICAL_FRAME) {
  const stage = getBackground(spec.background).stage;
  const actorSlots = spec.actors.map((a) => a.slot);
  const floorProps = layoutProps(spec.props, actorSlots, spec.shotSize, getProp).floor.map((p) => {
    const asset = getProp(p.id);
    return { slot: p.slot, halfWidth: asset.placement === "floor" ? asset.halfWidth : 0 };
  });
  // Đồ vật `floor` chiếm chỗ như một người: vị trí và hướng nhìn tính trên mọi chỗ đứng của shot.
  const shotSlots = [...actorSlots, ...floorProps.map((p) => p.slot)];
  const endCardWide = spec.camera === "cam_end_card" && frame.width > frame.height;
  const reserve = shotReserve({
    frame,
    camera: spec.camera,
    shotSize: spec.shotSize,
    hasIllustration: spec.illustration !== undefined && spec.illustration.items.length > 0,
  });
  const view = shotFraming(
    stage,
    spec.shotSize,
    spec.actors.map((a) => ({ skin: getSkin(a.skin), slot: a.slot })),
    Math.max(
      0,
      spec.actors.findIndex((a) => a.character === spec.focus),
    ),
    getCamera(spec.camera),
    0,
    floorProps,
    frame,
    // Cùng luật dồn nhân vật của `StageShot` (ADR-029) để kiểm storyboard khớp video.
    reserve === undefined ? {} : { reserve },
  );
  const spans = spec.actors.map((a) => {
    const x = actorSlotX(stage, a.slot, shotSlots);
    const half = getSkin(a.skin).bodyHalfWidth * stage.actorScale;
    return [x - half, x + half] as const;
  });
  const shift =
    spans.length === 0
      ? 0
      : reserveShift(
          view,
          frame,
          { x0: Math.min(...spans.map((g) => g[0])), x1: Math.max(...spans.map((g) => g[1])) },
          reserve,
        );
  const toScreen = (x: number, y: number) => ({
    x: frame.width / 2 + (x - view.cx) * view.zoom,
    y: frame.height / 2 + (y - view.cy) * view.zoom,
  });
  return spec.actors.map((actor) => {
    const skin = getSkin(actor.skin);
    const pose = sampleAction(getMotion(actor.action), STILL_HOLD_FRAME);
    const g = characterGeometry(skin, pose);
    const facing = endCardWide ? -1 : defaultFacing(actor.slot, shotSlots);
    const scale = stage.actorScale;
    const slotX = actorSlotX(stage, actor.slot, shotSlots) + shift;
    const lift = -g.feetY - pose.hop;
    const head = toScreen(
      slotX + facing * g.headAnchor.x * scale,
      stage.groundY + (g.headAnchor.y + lift) * scale,
    );
    const zone = skin.headZone;
    const headRadius =
      (zone.kind === "circle" ? zone.r : Math.max(zone.halfWidth, zone.halfHeight)) *
      scale *
      view.zoom;
    const topLeft = toScreen(
      slotX - skin.bodyHalfWidth * scale,
      stage.groundY - skin.height * scale,
    );
    const bottomRight = toScreen(slotX + skin.bodyHalfWidth * scale, stage.groundY);
    const body: Box = { x0: topLeft.x, y0: topLeft.y, x1: bottomRight.x, y1: bottomRight.y };
    return { actor, head, headRadius, body };
  });
}

/** Tỷ lệ tương phản WCAG giữa hai màu `#rrggbb`. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
    const [r, g, bl] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as [
      number,
      number,
      number,
    ];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Bề ngang ước lượng (px) của nhóm phụ đề dài nhất trong câu. */
export function widestCaptionGroupPx(text: string): number {
  const words = text.split(/\s+/).filter((w) => w !== "");
  let widest = 0;
  for (let i = 0; i < words.length; i += WORDS_PER_CAPTION_GROUP) {
    const group = words.slice(i, i + WORDS_PER_CAPTION_GROUP).join(" ");
    widest = Math.max(widest, group.length * CHAR_WIDTH_EM * CAPTION_FONT_PX);
  }
  return widest;
}

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
export function checkStill(spec: StillSpec, frame: FrameSize = VERTICAL_FRAME): StoryboardIssue[] {
  const issues: StoryboardIssue[] = [];
  const layout = screenLayout(spec, frame);
  const visible = (b: Box) => b.x1 > 0 && b.x0 < frame.width && b.y1 > 0 && b.y0 < frame.height;
  const captionTop = captionTopY(frame);
  for (const item of layout) {
    // Cỡ cận chỉ nhìn người được lấy nét; người kia lộ một phần ở mép là chủ ý (góc qua vai).
    if (!visible(item.body) || (spec.shotSize === "close" && item.actor.character !== spec.focus)) {
      continue;
    }
    const { head, headRadius, actor } = item;
    const headInside =
      head.x - headRadius >= 0 && head.x + headRadius <= frame.width && head.y - headRadius >= 0;
    if (!headInside) {
      issues.push({
        code: "storyboard_unsafe_area",
        message: `Đầu của ${actor.character} bị mép khung cắt`,
      });
    } else if (head.y + headRadius > captionTop) {
      issues.push({
        code: "storyboard_unsafe_area",
        message: `Mặt của ${actor.character} nằm dưới khung phụ đề`,
      });
    }
  }
  // Mọi cặp nhân vật: shot `wide`, `high` có thể có ba người (bổ sung ADR-013 2026-11-03).
  layout.forEach((a, i) => {
    for (const b of layout.slice(i + 1)) {
      if (overlaps(a.body, b.body)) {
        issues.push({
          code: "storyboard_overlap",
          message: `${a.actor.character} và ${b.actor.character} chồng lên nhau`,
        });
      }
    }
  });
  const width = widestCaptionGroupPx(spec.caption.text);
  if (width > CAPTION_TEXT_WIDTH) {
    issues.push({
      code: "storyboard_text_overflow",
      message: `Phụ đề rộng khoảng ${Math.round(width)} px, quá hai dòng (${CAPTION_TEXT_WIDTH} px)`,
    });
  }
  const ratio = contrastRatio(spec.caption.color, CAPTION_BACKGROUND);
  if (ratio < 4.5) {
    issues.push({
      code: "storyboard_low_contrast",
      message: `Màu phụ đề của ${spec.caption.speaker} tương phản ${ratio.toFixed(2)}:1, dưới 4,5:1`,
    });
  }
  if (spec.placeholderAssetIds.length > 0) {
    issues.push({
      code: "storyboard_placeholder_asset",
      message: `Chờ tài sản mới, đang dùng tạm: ${spec.placeholderAssetIds.join(", ")}`,
    });
  }
  return issues;
}

/** Artifact `storyboard` schema `2` (05 mục Storyboard ảnh tĩnh). Lỗi render vào `errors[]`, không chặn cổng. */
export const storyboardV2ArtifactSchema = z
  .object({
    schemaVersion: z.literal(2),
    scriptArtifactId: z.uuid().nullable(),
    variants: z.array(
      z
        .object({
          variantIndex: z.union([z.literal(1), z.literal(2)]),
          scenes: z.array(
            z
              .object({
                sceneId: z.string(),
                shotId: z.string(),
                stillKey: z.string().nullable(),
                issues: z.array(
                  z.object({ code: z.enum(STORYBOARD_ISSUE_CODES), message: z.string() }).strict(),
                ),
                /**
                 * Ảnh thêm của các shot khác trong cảnh có minh họa hoặc đồ vật (bổ sung 2026-11-12): ý chính nằm ở
                 * shot sau vẫn được thấy ở Cổng 1. Thiếu ở artifact cũ.
                 */
                extraStills: z
                  .array(z.object({ shotId: z.string(), stillKey: z.string().nullable() }).strict())
                  .optional(),
              })
              .strict(),
          ),
        })
        .strict(),
    ),
    errors: z.array(
      z
        .object({
          variantIndex: z.number().int().nullable(),
          sceneId: z.string().nullable(),
          message: z.string(),
        })
        .strict(),
    ),
  })
  .strict();

export type StoryboardV2Artifact = z.infer<typeof storyboardV2ArtifactSchema>;
