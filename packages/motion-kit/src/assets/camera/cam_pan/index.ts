import { easing } from "../../../rig/math.js";
import type { CameraMove } from "../../../stage/types.js";

/** Lia ngang chậm từ trái sang phải, phóng nhẹ 4% để mép khung không lộ. */
export const camPan: CameraMove = (t) => ({
  zoom: 1.04,
  dx: -24 + 48 * easing.inOut(t),
  dy: 0,
});
