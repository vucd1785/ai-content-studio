import { easing } from "../../../rig/math.js";
import type { CameraMove } from "../../../stage/types.js";

/**
 * Khung kết mời theo dõi (ADR-026): máy lùi nhẹ và nâng lên, nhân vật xuống phần dưới khung, chừa trời phía trên
 * cho thẻ kết (tên kênh, lời mời, nút Follow). Máy đẩy vào rất chậm để hình không đứng im.
 */
export const camEndCard: CameraMove = (t) => ({
  zoom: 0.9 + 0.04 * easing.inOut(t),
  dx: 0,
  dy: -230 + 20 * easing.inOut(t),
});
