import { easing } from "../../../rig/math.js";
import type { CameraMove } from "../../../stage/types.js";

/** Lùi máy chậm từ 7% về khung gốc: mở ra toàn cảnh, hợp shot rộng đầu cảnh. */
export const camPullOut: CameraMove = (t) => ({
  zoom: 1.07 - 0.07 * easing.inOut(t),
  dx: 0,
  dy: 0,
});
