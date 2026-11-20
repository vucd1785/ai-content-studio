import { easing } from "../../../rig/math.js";
import { type ActionClip, pose } from "../../../rig/pose.js";

// Cầm cốc: khuỷu tay thấp cạnh hông, cẳng tay dựng chéo ra phía phải màn hình,
// cốc nằm ngang ngực chứ không che mặt.
const holdCup = pose({
  armA: [-10, -10],
  armB: [30, 105],
  legA: [-4, 0],
  legB: [4, 0],
  tilt: 4,
});

// Nhìn đồng hồ: đầu ngoảnh lên phía trái, người hơi ngả theo.
const lookClock = pose({
  ...holdCup,
  armB: [28, 100],
  lean: -4,
  tilt: -15,
});

// Đặt cốc xuống: cúi người về phía phải, tay hạ thấp.
const putDown = pose({
  armA: [-14, -12],
  armB: [62, 28],
  legA: [-6, 4],
  legB: [8, -4],
  lean: 9,
  tilt: 6,
  squash: 0.96,
});

// Đẩy ra xa: tay phải duỗi thẳng ra, người ngả lùi, tay trái giơ ngang như "thôi".
const pushAway = pose({
  armA: [-38, -68],
  armB: [88, 4],
  legA: [-10, 4],
  legB: [12, -4],
  lean: -8,
  tilt: 8,
});

/** Cầm cốc cà phê, nhìn đồng hồ, đặt cốc xuống rồi đẩy ra xa; lặp lắc tay từ chối. */
export const asset: ActionClip = {
  keys: [
    { frame: 0, pose: pose({}) },
    { frame: 6, pose: pose({ armB: [14, 40], squash: 0.95, tilt: 2 }), ease: easing.in },
    { frame: 14, pose: holdCup, ease: easing.outBack(1.4) },
    { frame: 24, pose: pose({ ...holdCup, armB: [32, 112], tilt: 7 }), ease: easing.inOut },
    { frame: 32, pose: lookClock, ease: easing.inOut },
    { frame: 42, pose: pose({ ...lookClock, tilt: -17, lean: -5 }), ease: easing.inOut },
    { frame: 46, pose: pose({ ...lookClock, tilt: -6, squash: 0.97 }), ease: easing.in },
    { frame: 54, pose: putDown, ease: easing.inOut },
    { frame: 57, pose: pose({ ...putDown, armB: [70, 20], squash: 0.94 }), ease: easing.in },
    { frame: 64, pose: pose({ ...pushAway, armB: [96, -6], lean: -11, tilt: 10 }), ease: easing.outBack(1.5) },
    { frame: 70, pose: pushAway, ease: easing.out },
    { frame: 76, pose: pose({ ...pushAway, armA: [-30, -82], armB: [80, 14], lean: -6, tilt: 3 }), ease: easing.inOut },
    { frame: 82, pose: pushAway, ease: easing.inOut },
  ],
  cycle: { from: 70, to: 82 },
};
