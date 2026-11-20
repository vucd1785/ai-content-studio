import { easing } from "../../../rig/math.js";
import type { CameraMove } from "../../../stage/types.js";

/**
 * Góc thấp (ADR-025): máy hạ xuống ngang hông, nhìn hơi ngước, đường chân trời thấp và trời rộng, nhân vật
 * trông lớn và mạnh mẽ. Máy nhích lên chậm suốt shot. Hợp cho câu chốt, lúc nhân vật quyết tâm hay tự hào.
 */
export const camLowAngle: CameraMove = (t) => ({
  zoom: 1.08 + 0.03 * easing.inOut(t),
  dx: 0,
  dy: -150 + 40 * easing.inOut(t),
});
