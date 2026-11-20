import { clamp, easing } from "../../../rig/math.js";
import type { CameraMove } from "../../../stage/types.js";

/**
 * Lia gắt (ADR-025): máy quét nhanh từ bên cạnh vào nhân vật trong khoảng 0,3 giây đầu shot rồi khựng lại,
 * như vừa quay sang thấy điều gì. Hợp cho chuyển ý đột ngột, nhân vật mới xuất hiện, phản ứng bất ngờ.
 */
export const camWhip: CameraMove = (t) => {
  const k = easing.outBack(1.1)(clamp(t / 0.14, 0, 1));
  return { zoom: 1.04, dx: -260 * (1 - k), dy: 0 };
};
