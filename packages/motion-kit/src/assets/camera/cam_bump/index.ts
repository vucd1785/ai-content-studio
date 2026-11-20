import { clamp, easing } from "../../../rig/math.js";
import type { CameraMove } from "../../../stage/types.js";

/** Giật máy vào nhanh rồi lùi về (khoảng 0,3 giây đầu shot): nhấn khoảnh khắc bất ngờ, hoảng hốt. */
export const camBump: CameraMove = (t) => {
  const kick = clamp(t / 0.12, 0, 1);
  const settle = easing.outBack(1.6)(kick);
  return { zoom: 1.09 - 0.05 * settle, dx: 0, dy: 0 };
};
