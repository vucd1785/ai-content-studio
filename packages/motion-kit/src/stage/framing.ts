import { clamp } from "../rig/math.js";
import type { SkinSpec } from "../rig/skin.js";
import type { CameraMove, ShotSize, SlotName, StageLayout } from "./types.js";

export const FRAME_WIDTH = 1080;
export const FRAME_HEIGHT = 1920;

/** Kích thước khung hình (px màn hình). */
export type FrameSize = { width: number; height: number };

/** Khung dọc 9:16, khung chuẩn của studio. */
export const VERTICAL_FRAME: FrameSize = { width: FRAME_WIDTH, height: FRAME_HEIGHT };
/** Khung ngang 16:9 (ADR-022): lựa chọn thử của Director. */
export const WIDE_FRAME: FrameSize = { width: 1920, height: 1080 };

export const isLandscape = (frame: FrameSize) => frame.width > frame.height;

/**
 * Vị trí dọc của mặt đất trong khung ngang (tỷ lệ chiều cao, từ trên): như khung dọc (khoảng 72%), chừa đáy cho
 * phụ đề.
 */
const LANDSCAPE_GROUND_Y = { wide: 0.75, high: 0.72 } as const;
/** Cỡ trung ở khung ngang lấy từ đùi trở lên: tâm khung ở 62% chiều cao nhân vật. */
const LANDSCAPE_MEDIUM_CENTER = 0.62;

/** Khung ngang: bối cảnh phủ rộng hơn khung cỡ rộng một chút, để camera còn chỗ lia. */
const LANDSCAPE_BG_MARGIN = 1.1;

/**
 * Độ phóng bối cảnh (ADR-022). Khung dọc: 1. Khung ngang: bối cảnh vẽ cho khung dọc (rộng 1080) hẹp hơn khung,
 * nên được phóng đều quanh điểm giữa mặt đất cho đủ bề ngang. Nhân vật và đồ vật giữ cỡ, mặt đất giữ chỗ.
 * Bối cảnh vẽ rộng (`GENERATED_WIDE_BACKGROUND_STAGE`) gần như không phải phóng.
 */
export function backgroundScale(stage: StageLayout, frame: FrameSize): number {
  if (!isLandscape(frame)) {
    return 1;
  }
  const worldW = stage.bounds.x1 - stage.bounds.x0;
  return Math.max(1, ((frame.width / SHOT_ZOOM.wide) * LANDSCAPE_BG_MARGIN) / worldW);
}

/** Vùng bối cảnh sau khi phóng `scale` quanh điểm giữa mặt đất. */
export function scaledBounds(stage: StageLayout, scale: number) {
  const b = stage.bounds;
  const mid = (b.x0 + b.x1) / 2;
  const g = stage.groundY;
  return {
    x0: mid - (mid - b.x0) * scale,
    x1: mid + (b.x1 - mid) * scale,
    y0: g - (g - b.y0) * scale,
    y1: g + (b.y1 - g) * scale,
  };
}

/** Giới hạn x của tâm camera; khung rộng hơn cả vùng bối cảnh thì đặt bối cảnh giữa khung. */
function clampCenterX(x: number, half: number, b: { x0: number; x1: number }): number {
  if (2 * half <= b.x1 - b.x0) {
    return clamp(x, b.x0 + half, b.x1 - half);
  }
  return (b.x0 + b.x1) / 2;
}

/** Độ phóng gốc của từng cỡ cảnh. `high` là góc cao: gần cỡ rộng, nhìn xuống sàn nhiều hơn. */
export const SHOT_ZOOM: Record<ShotSize, number> = {
  wide: 1,
  high: 1.12,
  medium: 1.55,
  close: 2.5,
};

/** Khoảng chừa (px thế giới) giữa người ngoài cùng và mép khung khi camera phải lùi để đủ cả nhóm. */
export const GROUP_MARGIN = 40;

/** Vị trí dọc của mặt trong khung ở cỡ cận (tỷ lệ chiều cao khung, tính từ trên). */
export const CLOSE_FACE_Y = 0.42;

export type FocusPoint = {
  /** Vị trí x của nhân vật được lấy nét trong thế giới. */
  x: number;
  /** Chiều cao nhân vật trên mặt đất (px thế giới). */
  height: number;
  /** Độ cao của mặt trên mặt đất (px thế giới); cỡ cận nhìn vào đây. */
  face: number;
  /**
   * Bề ngang (px thế giới) của mọi nhân vật trong shot, gồm đầu. Cỡ rộng, góc cao và cỡ trung giữ cả
   * nhóm trong khung: lùi camera nếu cần, cỡ trung lấy giữa nhóm. Cỡ cận chỉ nhìn người được lấy nét.
   */
  group?: { x0: number; x1: number };
};

/**
 * Khung ngang có minh họa (ADR-029): nhân vật dồn vào phần `1 - ILLUSTRATION_SHARE` bên trái khung, phần còn lại
 * bên phải dành cho minh họa. Không dồn thì minh họa chỉ còn dải mỏng trên đầu nhân vật ở cỡ trung.
 */
export const ILLUSTRATION_SHARE = 0.5;

/** Tùy chọn đặt khung theo nội dung của shot. */
export type FramingOptions = {
  /** Khung ngang: chừa nửa phải cho minh họa. Khung dọc và cỡ cận bỏ qua. */
  reserveIllustration?: boolean;
  /**
   * Khung ngang: chừa một bên khung cho lớp phủ (ADR-029: thẻ kết đứng bên trái), nhân vật dồn sang bên kia.
   * `share` là phần bề ngang chừa lại.
   */
  reserve?: { side: "left" | "right"; share: number };
};

/** Phần khung chừa cho thẻ kết ở khung ngang (ADR-029). */
export const END_CARD_SHARE = 0.45;

/** Phần khung chừa của một shot (ADR-029): thẻ kết bên trái, hoặc minh họa bên phải; không chừa thì undefined. */
export function shotReserve(input: {
  frame: FrameSize;
  camera: string;
  shotSize: ShotSize;
  hasIllustration: boolean;
}): FramingOptions["reserve"] {
  if (!isLandscape(input.frame)) {
    return undefined;
  }
  if (input.camera === "cam_end_card") {
    return { side: "left", share: END_CARD_SHARE };
  }
  return input.hasIllustration && input.shotSize !== "close"
    ? { side: "right", share: ILLUSTRATION_SHARE }
    : undefined;
}

/**
 * Độ dời lớp nhân vật (px thế giới) để tâm nhóm vào giữa phần khung còn lại (ADR-029). Máy đã lùi theo `reserve`
 * nhưng bị kẹp ở mép bối cảnh thì nhóm vẫn lấn sang phần chừa; dời lớp nhân vật (bối cảnh đứng yên) bù phần đó.
 */
export function reserveShift(
  view: { cx: number; zoom: number },
  frame: FrameSize,
  group: { x0: number; x1: number },
  reserve: FramingOptions["reserve"],
): number {
  if (reserve === undefined || !isLandscape(frame)) {
    return 0;
  }
  const regionW = frame.width * (1 - reserve.share);
  const desired = reserve.side === "right" ? regionW / 2 : frame.width - regionW / 2;
  const center = frame.width / 2 + ((group.x0 + group.x1) / 2 - view.cx) * view.zoom;
  return (desired - center) / view.zoom;
}

/** Nửa bề ngang mặc định (px thế giới) của một người khi shot không có `group`. */
const SINGLE_HALF = 170;

/**
 * Tâm nhìn và độ phóng của camera trong thế giới. Tâm bị kẹp để khung không nhìn ra ngoài
 * `stage.bounds` (P6-03: dải đen ở đáy khung khi camera nhìn quá mép).
 */
export function framing(
  stage: StageLayout,
  shotSize: ShotSize,
  focus: FocusPoint,
  move: CameraMove,
  t: number,
  frame: FrameSize = VERTICAL_FRAME,
  options: FramingOptions = {},
) {
  const m = move(clamp(t, 0, 1));
  const zoom = SHOT_ZOOM[shotSize] * m.zoom;
  const g = stage.groundY;
  const W = frame.width;
  const H = frame.height;
  const midX = (stage.bounds.x0 + stage.bounds.x1) / 2;
  const wideLandscape = isLandscape(frame);
  const base = {
    wide: wideLandscape
      ? { cx: midX, cy: g - (H * (LANDSCAPE_GROUND_Y.wide - 0.5)) / zoom }
      : { cx: midX, cy: g - 430 },
    high: wideLandscape
      ? { cx: midX + 20, cy: g - (H * (LANDSCAPE_GROUND_Y.high - 0.5)) / zoom }
      : { cx: midX + 20, cy: g - 330 },
    medium: {
      cx: focus.x,
      cy: g - focus.height * (wideLandscape ? LANDSCAPE_MEDIUM_CENTER : 0.5),
    },
    // Mặt ở khoảng 42% chiều cao khung, chừa chỗ cho phụ đề ở đáy.
    close: {
      cx: focus.x,
      cy: g - focus.face + (H * (0.5 - CLOSE_FACE_Y)) / SHOT_ZOOM.close,
    },
  }[shotSize];
  let fitZoom = zoom;
  let baseCx = base.cx;
  const group = shotSize === "close" ? undefined : focus.group;
  if (group !== undefined) {
    // Report P6-10, P6-17: cỡ trung hai người lấy nét một người làm đầu người kia bị mép khung cắt.
    fitZoom = Math.min(zoom, W / (group.x1 - group.x0 + 2 * GROUP_MARGIN));
    const half = W / 2 / fitZoom;
    baseCx =
      shotSize === "medium"
        ? (group.x0 + group.x1) / 2
        : clamp(base.cx, group.x1 + GROUP_MARGIN - half, group.x0 - GROUP_MARGIN + half);
  }
  const reserve =
    options.reserve ??
    (options.reserveIllustration === true
      ? { side: "right" as const, share: ILLUSTRATION_SHARE }
      : undefined);
  if (reserve !== undefined && wideLandscape && shotSize !== "close") {
    // Nhóm nhân vật vừa phần còn lại của khung, tâm nhóm đặt ở giữa phần đó.
    const g = focus.group ?? { x0: focus.x - SINGLE_HALF, x1: focus.x + SINGLE_HALF };
    const regionW = W * (1 - reserve.share);
    const regionCenter = reserve.side === "right" ? regionW / 2 : W - regionW / 2;
    fitZoom = Math.min(fitZoom, regionW / (g.x1 - g.x0 + 2 * GROUP_MARGIN));
    baseCx = (g.x0 + g.x1) / 2 + (W / 2 - regionCenter) / fitZoom;
  }
  const rotate = m.rotate ?? 0;
  const b = scaledBounds(stage, backgroundScale(stage, frame));
  // Khung nghiêng (ADR-025) nhìn thấy hình bao lớn hơn khung, máy lùi (`cam_end_card`, ADR-026) nhìn rộng hơn: phóng
  // thêm vừa đủ để vùng nhìn nằm trong bối cảnh. Máy thường không chạm giới hạn này.
  const unit = viewHalfExtents(frame, 1, rotate);
  fitZoom = Math.max(fitZoom, unit.halfW / ((b.x1 - b.x0) / 2), unit.halfH / ((b.y1 - b.y0) / 2));
  const { halfW, halfH } = viewHalfExtents(frame, fitZoom, rotate);
  const cx = clampCenterX(baseCx + m.dx, halfW, b);
  const cy = clamp(base.cy + m.dy, b.y0 + halfH, b.y1 - halfH);
  return { cx, cy, zoom: fitZoom, rotate };
}

/**
 * Vị trí thật của một nhân vật trong shot. Shot hai người mà một người là `center` (cảnh có ba người)
 * thì người đó sang bên còn trống, giữ thứ tự trái phải: hai người cách nhau đúng như `left`, `right`.
 */
export function effectiveSlot(slot: SlotName, shotSlots: readonly SlotName[]): SlotName {
  if (slot !== "center" || shotSlots.length !== 2) {
    return slot;
  }
  return shotSlots.includes("left") ? "right" : "left";
}

/** Vị trí x (px thế giới) của một nhân vật: shot ba người dùng `trioSlots` nếu bối cảnh có. */
export function actorSlotX(
  stage: StageLayout,
  slot: SlotName,
  shotSlots: readonly SlotName[],
): number {
  const slots = shotSlots.length >= 3 ? (stage.trioSlots ?? stage.slots) : stage.slots;
  return slots[effectiveSlot(slot, shotSlots)];
}

/** Hướng nhìn mặc định: người bên phải nhìn sang trái, còn lại nhìn sang phải. */
export function defaultFacing(slot: SlotName, shotSlots: readonly SlotName[]): 1 | -1 {
  return effectiveSlot(slot, shotSlots) === "right" ? -1 : 1;
}

/**
 * Khung của một shot từ danh sách nhân vật: điểm lấy nét theo người `focus`, nhóm theo mọi người và mọi
 * đồ vật `floor` (P6-19: đồ vật chiếm chỗ như một người, không bị mép khung cắt).
 * `StageShot` và kiểm storyboard của worker dùng chung hàm này nên ảnh tĩnh và video đặt khung như nhau.
 */
export function shotFraming(
  stage: StageLayout,
  shotSize: ShotSize,
  actors: readonly { skin: SkinSpec; slot: SlotName }[],
  focus: number,
  move: CameraMove,
  t: number,
  props: readonly { halfWidth: number; slot: SlotName }[] = [],
  frame: FrameSize = VERTICAL_FRAME,
  options: FramingOptions = {},
) {
  const focusActor = actors[focus] ?? actors[0];
  const shotSlots = [...actors.map((a) => a.slot), ...props.map((p) => p.slot)];
  const point: FocusPoint =
    focusActor === undefined
      ? { x: stage.slots.center, height: 600, face: 500 }
      : {
          x: actorSlotX(stage, focusActor.slot, shotSlots),
          height: focusActor.skin.height * stage.actorScale,
          face: -focusActor.skin.headAnchor.y * stage.actorScale,
        };
  if (shotSlots.length >= 2) {
    const edges = [
      ...actors.map((a) => ({ slot: a.slot, half: a.skin.bodyHalfWidth })),
      ...props.map((p) => ({ slot: p.slot, half: p.halfWidth })),
    ].map((o) => {
      const x = actorSlotX(stage, o.slot, shotSlots);
      const half = o.half * stage.actorScale;
      return [x - half, x + half] as const;
    });
    point.group = {
      x0: Math.min(...edges.map((e) => e[0])),
      x1: Math.max(...edges.map((e) => e[1])),
    };
  }
  return framing(stage, shotSize, point, move, t, frame, options);
}

/**
 * Nửa bề ngang và nửa chiều cao (px thế giới) của vùng khung nhìn thấy. Khung nghiêng `rotate` độ
 * (ADR-025) nhìn thấy cả hình chữ nhật bao của khung đã xoay, nên camera phải lùi khỏi mép bối cảnh nhiều hơn.
 */
export function viewHalfExtents(frame: FrameSize, zoom: number, rotate = 0) {
  const a = Math.abs((rotate * Math.PI) / 180);
  const c = Math.cos(a);
  const s = Math.sin(a);
  return {
    halfW: ((frame.width / 2) * c + (frame.height / 2) * s) / zoom,
    halfH: ((frame.width / 2) * s + (frame.height / 2) * c) / zoom,
  };
}

/** Chuỗi `transform` SVG đưa điểm thế giới (cx, cy) về giữa khung với độ phóng `zoom`, nghiêng `rotate` độ. */
export function framingTransform(
  f: { cx: number; cy: number; zoom: number; rotate?: number },
  frame: FrameSize = VERTICAL_FRAME,
): string {
  const tx = frame.width / 2 - f.cx * f.zoom;
  const ty = frame.height / 2 - f.cy * f.zoom;
  const base = `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${f.zoom.toFixed(4)})`;
  if (f.rotate === undefined || f.rotate === 0) {
    return base;
  }
  return `rotate(${f.rotate.toFixed(3)} ${frame.width / 2} ${frame.height / 2}) ${base}`;
}
