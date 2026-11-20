import { easing } from "../../../rig/math.js";
import { type ActionClip, pose } from "../../../rig/pose.js";

// Tay phải duỗi gần ngang vai, cẳng tay chỉ hơi gập lên để chìa đồng hồ ra phía trước,
// bàn tay ở xa đầu. Bản trước giơ tay quá cao nên bàn tay chạm đầu ở frame 9.
const showClock = pose({
  armA: [-18, -12],
  armB: [92, 20],
  legA: [-6, 2],
  legB: [6, -2],
  lean: -3,
  tilt: -5,
});

/** Giơ đồng hồ báo thức: lấy đà, chìa đồng hồ quá đà, rồi tay rung nhẹ theo tiếng chuông. */
export const asset: ActionClip = {
  keys: [
    { frame: 0, pose: pose({}) },
    { frame: 4, pose: pose({ armA: [-10, -6], armB: [28, 12], lean: 3, squash: 0.94 }), ease: easing.in },
    { frame: 9, pose: pose({ ...showClock, armB: [98, 24], lean: -5, squash: 1.04 }), ease: easing.outBack(1.4) },
    { frame: 13, pose: showClock, ease: easing.inOut },
    { frame: 16, pose: pose({ ...showClock, armB: [95, 17], tilt: -7 }), ease: easing.inOut },
    { frame: 19, pose: pose({ ...showClock, armB: [89, 23], tilt: -3 }), ease: easing.inOut },
    { frame: 22, pose: pose({ ...showClock, armB: [94, 16], tilt: -6, squash: 0.98 }), ease: easing.inOut },
    { frame: 25, pose: showClock, ease: easing.inOut },
  ],
  cycle: { from: 13, to: 25 },
};
