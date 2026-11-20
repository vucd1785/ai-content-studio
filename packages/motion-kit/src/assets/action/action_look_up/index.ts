import { easing } from "../../../rig/math.js";
import { type ActionClip, pose } from "../../../rig/pose.js";

const look = pose({
  armA: [-16, 18],
  armB: [122, 14],
  legA: [-8, 0],
  legB: [8, 0],
  lean: -7,
  tilt: -10,
});

/** Nhìn lên trời: ngả người ra sau, một tay chỉ thẳng lên cao; lắc nhẹ như dõi theo thứ đang bay. */
export const actionLookUp: ActionClip = {
  keys: [
    { frame: 0, pose: pose({}) },
    { frame: 5, pose: pose({ armB: [40, 20], squash: 0.95 }), ease: easing.in },
    { frame: 13, pose: look, ease: easing.outBack(1.2) },
    { frame: 30, pose: pose({ ...look, armB: [116, 18], lean: -5, tilt: -7 }), ease: easing.inOut },
    { frame: 47, pose: look, ease: easing.inOut },
  ],
  cycle: { from: 13, to: 47 },
};
