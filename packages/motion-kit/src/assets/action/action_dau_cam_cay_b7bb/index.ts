import { easing } from "../../../rig/math.js";
import { type ActionClip, pose } from "../../../rig/pose.js";

// Hai tay luôn hạ thấp, chụm về một phía như đang nắm cán chổi. Tay không bao giờ
// giơ quá vai nên cẳng tay không che mặt.
const sweepLeft = pose({
  armA: [-38, -14],
  armB: [-18, -34],
  legA: [-10, 8],
  legB: [8, -4],
  lean: -7,
  tilt: -8,
  squash: 0.95,
});

const sweepRight = pose({
  armA: [18, 34],
  armB: [38, 14],
  legA: [-8, 4],
  legB: [10, -8],
  lean: 7,
  tilt: 8,
  squash: 0.95,
});

// Giữa nhịp: chổi đi qua chính giữa, người bật nhẹ lên.
const midA = pose({
  armA: [-10, -8],
  armB: [8, 8],
  legA: [-6, 2],
  legB: [6, -2],
  lean: 0,
  tilt: 2,
  hop: 9,
  squash: 1.05,
});

const midB = pose({ ...midA, tilt: -2 });

/** Quét chổi: lấy đà sang phải, vung qua trái quá đà, rồi quét trái-phải nhún nhảy theo nhịp. */
export const asset: ActionClip = {
  keys: [
    { frame: 0, pose: pose({}) },
    {
      frame: 5,
      pose: pose({ ...sweepRight, armA: [24, 40], armB: [44, 18], lean: 9, squash: 0.9, hop: 0 }),
      ease: easing.inOut,
    },
    {
      frame: 11,
      pose: pose({ ...sweepLeft, armA: [-46, -18], armB: [-26, -38], lean: -10, tilt: -11 }),
      ease: easing.outBack(1.4),
    },
    { frame: 14, pose: sweepLeft, ease: easing.out },
    { frame: 18, pose: midA, ease: easing.out },
    { frame: 22, pose: sweepRight, ease: easing.in },
    { frame: 26, pose: midB, ease: easing.out },
    { frame: 30, pose: sweepLeft, ease: easing.in },
  ],
  cycle: { from: 14, to: 30 },
};
