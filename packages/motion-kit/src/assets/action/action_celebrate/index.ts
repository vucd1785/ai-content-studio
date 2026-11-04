import { easing } from "../../../rig/math.js";
import { type ActionClip, pose } from "../../../rig/pose.js";

// Tay mở chữ V rộng (110 độ) để bàn tay không chạm đầu khi nhảy.
const air = pose({
  armA: [-110, -15],
  armB: [110, 15],
  legA: [-28, 40],
  legB: [28, -40],
  hop: 56,
  squash: 1.06,
});
const land = pose({
  armA: [-110, -15],
  armB: [110, 15],
  legA: [-14, 10],
  legB: [14, -10],
  squash: 0.9,
});

/** Ăn mừng: ngồi thụp lấy đà, bật nhảy, tiếp đất co thân, nảy lặp. */
export const actionCelebrate: ActionClip = {
  keys: [
    { frame: 0, pose: pose({}) },
    {
      frame: 6,
      pose: pose({
        armA: [-30, 20],
        armB: [30, -20],
        legA: [-16, 24],
        legB: [16, -24],
        squash: 0.86,
      }),
      ease: easing.out,
    },
    { frame: 13, pose: air, ease: easing.out },
    { frame: 20, pose: land, ease: easing.in },
    { frame: 25, pose: pose({ ...land, squash: 1 }), ease: easing.out },
    { frame: 31, pose: pose({ ...air, hop: 28 }), ease: easing.out },
    { frame: 37, pose: land, ease: easing.in },
    { frame: 42, pose: pose({ ...land, squash: 1 }), ease: easing.out },
  ],
  cycle: { from: 25, to: 42 },
};
