import { easing } from "../../../rig/math.js";
import { type ActionClip, pose } from "../../../rig/pose.js";

const aim = pose({ armA: [-40, 86], armB: [96, -4], legA: [-8, 0], legB: [10, 0], lean: 4 });

/** Chỉ: kéo tay về lấy đà, đẩy ra quá đà, rồi nhấn nhẹ theo nhịp nói. */
export const actionPoint: ActionClip = {
  keys: [
    { frame: 0, pose: pose({}) },
    {
      frame: 6,
      pose: pose({ armA: [-30, 60], armB: [50, -70], lean: -3, legA: [-8, 0], legB: [10, 0] }),
      ease: easing.out,
    },
    { frame: 12, pose: aim, ease: easing.outBack(1.8) },
    { frame: 30, pose: aim },
    { frame: 36, pose: pose({ ...aim, armB: [90, -12], lean: 6 }) },
    { frame: 44, pose: aim },
  ],
  cycle: { from: 30, to: 44 },
};
