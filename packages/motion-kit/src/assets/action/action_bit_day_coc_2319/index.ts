import { easing } from "../../../rig/math.js";
import { type ActionClip, pose } from "../../../rig/pose.js";

// Tay phải (armB) duỗi ngang đẩy cốc ra xa, người ngả nhẹ về bên trái để tránh.
// Tay trái (armA) giữ khuỷu thấp, cẳng tay dựng cạnh ngực, không cắt qua mặt.
const refuse = pose({
  armA: [-38, -88],
  armB: [84, -4],
  legA: [-8, 2],
  legB: [10, -4],
  lean: -7,
  tilt: 0,
});

/** Từ chối cà phê: thu tay lấy đà, đẩy ra quá đà, rồi lắc đầu và xua tay lặp lại. */
export const asset: ActionClip = {
  keys: [
    { frame: 0, pose: pose({}) },
    {
      frame: 5,
      pose: pose({
        armA: [-18, -30],
        armB: [28, 95],
        legA: [-4, 2],
        legB: [6, -2],
        lean: 5,
        tilt: 6,
        squash: 0.94,
      }),
      ease: easing.inOut,
    },
    {
      frame: 10,
      pose: pose({ ...refuse, armB: [96, -10], lean: -11, tilt: -6, squash: 1.04 }),
      ease: easing.outBack(1.5),
    },
    { frame: 14, pose: refuse, ease: easing.inOut },
    {
      frame: 18,
      pose: pose({ ...refuse, armA: [-42, -104], armB: [86, -28], tilt: -13, lean: -8 }),
      ease: easing.inOut,
    },
    {
      frame: 22,
      pose: pose({ ...refuse, armA: [-34, -74], armB: [82, 18], tilt: 11, lean: -6 }),
      ease: easing.inOut,
    },
    {
      frame: 26,
      pose: pose({ ...refuse, armA: [-42, -104], armB: [86, -28], tilt: -13, lean: -8 }),
      ease: easing.inOut,
    },
    { frame: 30, pose: refuse, ease: easing.inOut },
  ],
  cycle: { from: 14, to: 30 },
};
