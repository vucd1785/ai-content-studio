import { easing } from "../../../rig/math.js";
import type { CameraMove } from "../../../stage/types.js";

/**
 * Góc nghiêng (ADR-025): khung nghiêng dần tới khoảng 6 độ và đẩy vào nhẹ, gây cảm giác chênh vênh, bất an.
 * Hợp cho lúc có vấn đề, nhầm lẫn, căng thẳng. Kit tự lùi khung để góc xoay không lộ mép bối cảnh.
 */
export const camDutch: CameraMove = (t) => ({
  zoom: 1.04 + 0.04 * easing.inOut(t),
  dx: 0,
  dy: 0,
  rotate: -3 - 3 * easing.out(t),
});
