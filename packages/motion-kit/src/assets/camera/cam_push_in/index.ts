import { easing } from "../../../rig/math.js";
import type { CameraMove } from "../../../stage/types.js";

/** Đẩy máy vào chậm 6% suốt shot. */
export const camPushIn: CameraMove = (t) => ({ zoom: 1 + 0.06 * easing.inOut(t), dx: 0, dy: 0 });
