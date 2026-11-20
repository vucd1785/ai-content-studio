import { easing } from "../../../rig/math.js";
import { type ActionClip, pose } from "../../../rig/pose.js";

// Cầm điện thoại: khuỷu tay phải hạ thấp, cẳng tay gập lên trước ngực, điện thoại
// nằm dưới cằm chứ không che mặt. Tay trái đỡ nhẹ từ dưới.
const holdPhone = pose({
  armA: [-18, -78],
  armB: [22, 104],
  legA: [-6, 0],
  legB: [6, 0],
  lean: 4,
  tilt: 10,
});

// Úp điện thoại vào ngăn kéo thấp bên phải: cúi người, tay vươn xuống.
const putDown = pose({
  armA: [-24, -20],
  armB: [62, 14],
  legA: [-10, 8],
  legB: [14, -10],
  lean: 13,
  tilt: 8,
  squash: 0.94,
});

// Đẩy ngăn kéo đóng: tay duỗi thẳng ngang hông.
const push = pose({
  armA: [-30, -24],
  armB: [80, -4],
  legA: [-14, 6],
  legB: [12, -6],
  lean: 9,
  tilt: 2,
  squash: 0.97,
});

// Phủi tay hài lòng sau khi cất điện thoại.
const dustA = pose({
  armA: [-14, -96],
  armB: [16, 96],
  legA: [-4, 0],
  legB: [4, 0],
  lean: -2,
  tilt: -6,
});
const dustB = pose({
  armA: [-24, -80],
  armB: [26, 82],
  legA: [-4, 0],
  legB: [4, 0],
  lean: 1,
  tilt: 4,
  squash: 0.98,
});

/** Cầm điện thoại trong đêm, rồi cất vào ngăn kéo, đóng lại và phủi tay lặp. */
export const asset: ActionClip = {
  keys: [
    { frame: 0, pose: pose({}) },
    { frame: 4, pose: pose({ armB: [10, 30], tilt: -4, squash: 0.95 }), ease: easing.in },
    { frame: 11, pose: pose({ ...holdPhone, armB: [26, 112], tilt: 13, lean: 6 }), ease: easing.outBack(1.4) },
    { frame: 15, pose: holdPhone, ease: easing.inOut },
    { frame: 22, pose: pose({ ...holdPhone, tilt: 7, armB: [20, 100] }), ease: easing.inOut },
    { frame: 29, pose: pose({ ...holdPhone, tilt: 11 }), ease: easing.inOut },
    // anticipation: hơi ngả về trái trước khi cúi sang ngăn kéo
    { frame: 34, pose: pose({ ...holdPhone, lean: -5, tilt: -4, squash: 1.03 }), ease: easing.inOut },
    { frame: 42, pose: pose({ ...putDown, lean: 15, armB: [66, 10] }), ease: easing.outBack(1.3) },
    { frame: 46, pose: putDown, ease: easing.inOut },
    // rút tay lấy đà
    { frame: 51, pose: pose({ ...putDown, armB: [44, 50], lean: 6, squash: 1.0 }), ease: easing.inOut },
    // đẩy đóng mạnh, quá đà
    { frame: 56, pose: pose({ ...push, armB: [86, -8], lean: 12 }), ease: easing.out },
    { frame: 60, pose: push, ease: easing.inOut },
    // đứng thẳng, phủi tay
    { frame: 67, pose: dustA, ease: easing.outBack(1.2) },
    { frame: 72, pose: dustB, ease: easing.inOut },
    { frame: 77, pose: dustA, ease: easing.inOut },
  ],
  cycle: { from: 67, to: 77 },
};
