import { easing } from "../../../rig/math.js";
import { type ActionClip, pose } from "../../../rig/pose.js";

// Vươn vai kiểu dang ngang: cánh tay trên chỉ khoảng 95 độ, cẳng tay hất chéo ra ngoài
// (không gập vào trong) để bàn tay và khuỷu tay luôn cách xa đầu.
const stretch = pose({
  armA: [-95, -22],
  armB: [95, 22],
  legA: [-6, 0],
  legB: [6, 0],
  lean: -6,
  tilt: -10,
  squash: 1.04,
});

// Thả lỏng sau khi tắt báo thức: tay phải còn hạ thấp cạnh hông, mặt tươi tỉnh.
const settled = pose({
  armA: [-18, 12],
  armB: [38, 14],
  legA: [-6, 0],
  legB: [6, 0],
  lean: 4,
  tilt: -4,
});

/** Bật dậy: nhún lấy đà, bật lên vươn vai quá đà, nghiêng người, với tay tắt báo thức, rồi đung đưa vui. */
export const asset: ActionClip = {
  keys: [
    { frame: 0, pose: pose({}) },
    {
      frame: 5,
      pose: pose({
        armA: [-20, 30],
        armB: [20, -30],
        legA: [-8, 10],
        legB: [8, -10],
        lean: 6,
        tilt: 6,
        squash: 0.88,
      }),
      ease: easing.in,
    },
    {
      frame: 12,
      pose: pose({ ...stretch, armA: [-100, -28], armB: [100, 28], hop: 22, squash: 1.1, lean: -4 }),
      ease: easing.outBack(1.4),
    },
    { frame: 18, pose: stretch, ease: easing.inOut },
    { frame: 26, pose: pose({ ...stretch, lean: 5, tilt: 8 }), ease: easing.inOut },
    {
      frame: 34,
      pose: pose({ armA: [-25, 15], armB: [55, 28], legA: [-6, 0], legB: [6, 0], lean: 10, tilt: 6 }),
      ease: easing.inOut,
    },
    {
      frame: 38,
      pose: pose({ armA: [-25, 15], armB: [62, 16], legA: [-6, 0], legB: [6, 0], lean: 11, tilt: 8, squash: 0.97 }),
      ease: easing.in,
    },
    { frame: 42, pose: settled, ease: easing.out },
    {
      frame: 48,
      pose: pose({ ...settled, armA: [-24, 16], armB: [32, 10], lean: 1, tilt: 5, squash: 1.02 }),
      ease: easing.inOut,
    },
    { frame: 54, pose: settled, ease: easing.inOut },
  ],
  cycle: { from: 42, to: 54 },
};
