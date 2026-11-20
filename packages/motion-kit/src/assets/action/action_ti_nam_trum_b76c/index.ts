import { easing } from "../../../rig/math.js";
import { type ActionClip, pose } from "../../../rig/pose.js";

// Hai khuỷu tay hạ sát sườn, cẳng tay gập vào giữa ngực để cầm điện thoại ngay trước bụng,
// không cho tay nào chạm lên mặt. Đầu cúi nhìn màn hình, người hơi khom như đang nằm co trong chăn.
const scrolling = pose({
  armA: [-14, 104],
  armB: [16, -98],
  legA: [-8, 14],
  legB: [8, -14],
  lean: 6,
  tilt: 12,
  squash: 0.95,
});

// Ngón cái vuốt lên: cẳng tay phải gập thêm một chút, cổ tay trái giữ máy hơi nghiêng theo.
const flick = pose({
  ...scrolling,
  armA: [-12, 100],
  armB: [20, -114],
  tilt: 10,
});

// Gật gà buồn ngủ: đầu gục xuống thêm, người chùng xuống.
const nod = pose({
  ...scrolling,
  armA: [-16, 106],
  armB: [14, -100],
  lean: 8,
  tilt: 17,
  squash: 0.93,
});

/** Lướt điện thoại đêm khuya: thu người lại, đưa máy lên quá đà rồi lướt liên tục và gật gà. */
export const asset: ActionClip = {
  keys: [
    { frame: 0, pose: pose({}) },
    {
      frame: 5,
      pose: pose({ armA: [-24, 30], armB: [24, -30], lean: -3, tilt: -4, squash: 0.92 }),
      ease: easing.in,
    },
    {
      frame: 12,
      pose: pose({ ...scrolling, armA: [-10, 112], armB: [12, -108], tilt: 6, squash: 0.98 }),
      ease: easing.outBack(1.4),
    },
    { frame: 16, pose: scrolling, ease: easing.inOut },
    { frame: 19, pose: flick, ease: easing.out },
    { frame: 23, pose: scrolling, ease: easing.inOut },
    { frame: 26, pose: flick, ease: easing.out },
    { frame: 31, pose: nod, ease: easing.inOut },
    { frame: 36, pose: scrolling, ease: easing.outBack(1.2) },
  ],
  cycle: { from: 16, to: 36 },
};
