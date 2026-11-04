import { easing } from "../../../rig/math.js";
import { type ActionClip, pose } from "../../../rig/pose.js";

// Khuỷu tay hạ, cẳng tay dựng lên cạnh mặt. Bản phác giơ khuỷu lên cao (130 độ) làm
// cánh tay trên của Tí cắt qua cằm; test khuỷu tay chặn lại.
const scared = pose({
  armA: [-60, -92],
  armB: [60, 92],
  legA: [-18, 6],
  legB: [16, -6],
  lean: -10,
  tilt: -8,
});

/** Hoảng: giật lùi quá đà, rồi run lặp quanh tư thế sợ. */
export const actionPanic: ActionClip = {
  keys: [
    { frame: 0, pose: pose({}) },
    { frame: 3, pose: pose({ armA: [-20, 30], armB: [20, -30], squash: 0.94 }), ease: easing.in },
    { frame: 9, pose: scared, ease: easing.outBack(1.3) },
    { frame: 12, pose: pose({ ...scared, lean: -8, tilt: -10 }) },
    { frame: 15, pose: pose({ ...scared, lean: -12, tilt: -6 }) },
  ],
  cycle: { from: 9, to: 15 },
};
