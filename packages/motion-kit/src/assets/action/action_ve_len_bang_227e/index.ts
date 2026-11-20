import { easing } from "../../../rig/math.js";
import { type ActionClip, pose } from "../../../rig/pose.js";

// Bảng ở bên phải màn hình. Cánh tay phải giữ gần ngang (80-105 độ) và cẳng tay
// hướng ra xa đầu, nên tay cầm phấn không bao giờ cắt qua mặt.
const drawing = pose({
  armA: [-14, 12],
  armB: [104, 24],
  legA: [-8, 4],
  legB: [12, -4],
  lean: 6,
  tilt: 10,
});

/** Vẽ lên bảng: lấy đà, vươn tay cầm phấn, vẽ vòng nối tiếp, quay lại nhìn khán giả, lặp. */
export const asset: ActionClip = {
  keys: [
    { frame: 0, pose: pose({}) },
    {
      frame: 5,
      pose: pose({ armA: [-8, 6], armB: [30, -20], lean: -3, tilt: -4, squash: 0.95 }),
      ease: easing.in,
    },
    { frame: 12, pose: drawing, ease: easing.outBack(1.3) },
    // Vẽ vòng tròn: khuỷu và cẳng tay xoay quanh một điểm trên bảng.
    {
      frame: 16,
      pose: pose({ ...drawing, armB: [94, 42], tilt: 12, lean: 7 }),
      ease: easing.inOut,
    },
    {
      frame: 20,
      pose: pose({ ...drawing, armB: [82, 22], tilt: 11, lean: 8 }),
      ease: easing.inOut,
    },
    { frame: 24, pose: pose({ ...drawing, armB: [96, 6], tilt: 9, lean: 6 }), ease: easing.inOut },
    // Ngoảnh lại nhìn khán giả, tay vẫn đặt phấn trên bảng.
    {
      frame: 28,
      pose: pose({ ...drawing, armB: [100, 28], armA: [-18, 20], tilt: -9, lean: 2 }),
      ease: easing.out,
    },
    {
      frame: 32,
      pose: pose({ ...drawing, armB: [98, 26], armA: [-16, 18], tilt: -11, lean: 1, squash: 1.02 }),
      ease: easing.inOut,
    },
    { frame: 36, pose: drawing, ease: easing.inOut },
  ],
  cycle: { from: 12, to: 36 },
};
