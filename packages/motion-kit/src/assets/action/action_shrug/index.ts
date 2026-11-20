import { easing } from "../../../rig/math.js";
import { type ActionClip, pose } from "../../../rig/pose.js";

const shrug = pose({
  armA: [-48, -62],
  armB: [48, 62],
  legA: [-6, 0],
  legB: [6, 0],
  tilt: -9,
  hop: 6,
  squash: 1.04,
});

/** Nhún vai: hạ người lấy đà, bật vai và hai tay ngửa sang hai bên, nghiêng đầu; lặp nhún nhẹ. */
export const actionShrug: ActionClip = {
  keys: [
    { frame: 0, pose: pose({}) },
    { frame: 4, pose: pose({ armA: [-20, -10], armB: [20, 10], squash: 0.94 }), ease: easing.in },
    { frame: 11, pose: shrug, ease: easing.outBack(1.4) },
    { frame: 24, pose: pose({ ...shrug, hop: 0, squash: 1, tilt: -6 }), ease: easing.inOut },
    { frame: 36, pose: shrug, ease: easing.inOut },
  ],
  cycle: { from: 11, to: 36 },
};
