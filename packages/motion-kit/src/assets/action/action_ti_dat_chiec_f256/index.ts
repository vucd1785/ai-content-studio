import { easing } from "../../../rig/math.js";
import { type ActionClip, pose } from "../../../rig/pose.js";

// Tay phải (armB) cầm điện thoại, đưa ra phía trước rồi hạ xuống ngăn kéo.
// Khuỷu tay luôn ở thấp và hướng ra ngoài, cẳng tay không gập về phía mặt.
const lift = pose({
  armB: [70, 45],
  armA: [-12, 8],
  legA: [-4, 0],
  legB: [6, -4],
  lean: -4,
  tilt: -6,
  squash: 0.96,
});

const place = pose({
  armB: [52, 14],
  armA: [-18, 10],
  legA: [-8, 6],
  legB: [10, -10],
  lean: 9,
  tilt: 8,
  squash: 0.94,
});

const push = pose({
  armB: [84, 4],
  armA: [-22, 14],
  legA: [-12, 4],
  legB: [14, -8],
  lean: 12,
  tilt: 4,
});

// Phủi tay: hai cẳng tay gập vào trước bụng, xen kẽ trên dưới.
const dustA = pose({
  armA: [-22, 96],
  armB: [20, -74],
  legA: [-6, 0],
  legB: [6, 0],
  lean: -2,
  tilt: -10,
  hop: 2,
});

const dustB = pose({
  armA: [-18, 74],
  armB: [24, -96],
  legA: [-6, 0],
  legB: [6, 0],
  lean: 2,
  tilt: -6,
  hop: 0,
  squash: 0.98,
});

/** Cất điện thoại: nhấc lên, đặt vào ngăn kéo, đẩy đóng quá đà, rồi phủi tay hài lòng lặp lại. */
export const asset: ActionClip = {
  keys: [
    { frame: 0, pose: pose({}) },
    { frame: 6, pose: lift, ease: easing.inOut },
    { frame: 13, pose: place, ease: easing.inOut },
    { frame: 16, pose: pose({ ...place, armB: [60, 30], squash: 0.92 }), ease: easing.in },
    { frame: 20, pose: push, ease: easing.outBack(1.4) },
    { frame: 24, pose: pose({ ...push, lean: 6, armB: [60, 10] }), ease: easing.out },
    { frame: 30, pose: dustA, ease: easing.outBack(1.3) },
    { frame: 34, pose: dustB, ease: easing.inOut },
    { frame: 38, pose: dustA, ease: easing.inOut },
  ],
  cycle: { from: 30, to: 38 },
};
