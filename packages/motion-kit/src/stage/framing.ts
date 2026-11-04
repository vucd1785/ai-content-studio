import { clamp } from "../rig/math.js";
import type { SkinSpec } from "../rig/skin.js";
import type { CameraMove, ShotSize, SlotName, StageLayout } from "./types.js";

export const FRAME_WIDTH = 1080;
export const FRAME_HEIGHT = 1920;

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
 * Tâm nhìn và độ phóng của camera trong thế giới. Tâm bị kẹp để khung không nhìn ra ngoài
 * `stage.bounds` (P6-03: dải đen ở đáy khung khi camera nhìn quá mép).
 */
export function framing(
  stage: StageLayout,
  shotSize: ShotSize,
  focus: FocusPoint,
  move: CameraMove,
  t: number,
) {
  const m = move(clamp(t, 0, 1));
  const zoom = SHOT_ZOOM[shotSize] * m.zoom;
  const g = stage.groundY;
  const base = {
    wide: { cx: FRAME_WIDTH / 2, cy: g - 430 },
    high: { cx: FRAME_WIDTH / 2 + 20, cy: g - 330 },
    medium: { cx: focus.x, cy: g - focus.height * 0.5 },
    // Mặt ở khoảng 42% chiều cao khung, chừa chỗ cho phụ đề ở đáy.
    close: {
      cx: focus.x,
      cy: g - focus.face + (FRAME_HEIGHT * (0.5 - CLOSE_FACE_Y)) / SHOT_ZOOM.close,
    },
  }[shotSize];
  let fitZoom = zoom;
  let baseCx = base.cx;
  const group = shotSize === "close" ? undefined : focus.group;
  if (group !== undefined) {
    // Report P6-10, P6-17: cỡ trung hai người lấy nét một người làm đầu người kia bị mép khung cắt.
    fitZoom = Math.min(zoom, FRAME_WIDTH / (group.x1 - group.x0 + 2 * GROUP_MARGIN));
    const half = FRAME_WIDTH / 2 / fitZoom;
    baseCx =
      shotSize === "medium"
        ? (group.x0 + group.x1) / 2
        : clamp(base.cx, group.x1 + GROUP_MARGIN - half, group.x0 - GROUP_MARGIN + half);
  }
  const halfW = FRAME_WIDTH / 2 / fitZoom;
  const halfH = FRAME_HEIGHT / 2 / fitZoom;
  const b = stage.bounds;
  const cx = clamp(baseCx + m.dx, b.x0 + halfW, b.x1 - halfW);
  const cy = clamp(base.cy + m.dy, b.y0 + halfH, b.y1 - halfH);
  return { cx, cy, zoom: fitZoom };
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
 * Khung của một shot từ danh sách nhân vật: điểm lấy nét theo người `focus`, nhóm theo mọi người.
 * `StageShot` và kiểm storyboard của worker dùng chung hàm này nên ảnh tĩnh và video đặt khung như nhau.
 */
export function shotFraming(
  stage: StageLayout,
  shotSize: ShotSize,
  actors: readonly { skin: SkinSpec; slot: SlotName }[],
  focus: number,
  move: CameraMove,
  t: number,
) {
  const focusActor = actors[focus] ?? actors[0];
  const shotSlots = actors.map((a) => a.slot);
  const point: FocusPoint =
    focusActor === undefined
      ? { x: stage.slots.center, height: 600, face: 500 }
      : {
          x: actorSlotX(stage, focusActor.slot, shotSlots),
          height: focusActor.skin.height * stage.actorScale,
          face: -focusActor.skin.headAnchor.y * stage.actorScale,
        };
  if (actors.length >= 2) {
    const edges = actors.map((a) => {
      const x = actorSlotX(stage, a.slot, shotSlots);
      const half = a.skin.bodyHalfWidth * stage.actorScale;
      return [x - half, x + half] as const;
    });
    point.group = {
      x0: Math.min(...edges.map((e) => e[0])),
      x1: Math.max(...edges.map((e) => e[1])),
    };
  }
  return framing(stage, shotSize, point, move, t);
}

/** Chuỗi `transform` SVG đưa điểm thế giới (cx, cy) về giữa khung với độ phóng `zoom`. */
export function framingTransform(f: { cx: number; cy: number; zoom: number }): string {
  const tx = FRAME_WIDTH / 2 - f.cx * f.zoom;
  const ty = FRAME_HEIGHT / 2 - f.cy * f.zoom;
  return `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${f.zoom.toFixed(4)})`;
}
