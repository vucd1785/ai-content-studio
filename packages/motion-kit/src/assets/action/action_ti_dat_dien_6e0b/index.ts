import { easing } from "../../../rig/math.js";
import { type ActionClip, pose } from "../../../rig/pose.js";

// Cầm điện thoại trước người: khuỷu tay thấp, cẳng tay đưa ra phía trước, tránh xa mặt.
const holdPhone = pose({
  armA: [-12, -8],
  armB: [62, 48],
  legA: [-4, 0],
  legB: [4, 0],
  lean: 4,
  tilt: 8,
});

// Cúi người sang phải đặt điện thoại vào giỏ, chân phải chùng xuống làm trụ.
const placeInBasket = pose({
  armA: [-24, -14],
  armB: [34, 14],
  legA: [-14, 6],
  legB: [20, -14],
  lean: 14,
  tilt: 12,
  squash: 0.94,
});

// Với tay trái sang ngang bấm công tắc: cánh tay trên nằm ngang (khoảng 92 độ),
// cẳng tay dựng hướng ra ngoài nên không cắt qua mặt.
const reachSwitch = pose({
  armA: [-92, -34],
  armB: [18, 12],
  legA: [-16, 4],
  legB: [8, -4],
  lean: -10,
  tilt: -10,
});

// Tư thế buồn ngủ: vai buông, đầu hơi gục.
const sleepy = pose({
  armA: [-10, -8],
  armB: [10, 8],
  legA: [-5, 2],
  legB: [5, -2],
  lean: 2,
  tilt: 10,
  squash: 0.98,
});

/** Cất điện thoại vào giỏ xa giường, quay về tắt đèn, rồi lắc lư buồn ngủ. */
export const asset: ActionClip = {
  keys: [
    { frame: 0, pose: pose({}) },
    // Lấy đà: hạ người, tay phải kéo về sau.
    { frame: 5, pose: pose({ armB: [-16, -20], lean: -4, squash: 0.95 }), ease: easing.in },
    { frame: 12, pose: holdPhone, ease: easing.outBack(1.3) },
    // Bước sang phải về phía giỏ.
    {
      frame: 19,
      pose: pose({ ...holdPhone, legA: [-12, 4], legB: [18, -8], lean: 8, hop: 4 }),
      ease: easing.inOut,
    },
    { frame: 27, pose: placeInBasket, ease: easing.inOut },
    // Thả tay: cổ tay nảy nhẹ sau khi buông điện thoại.
    { frame: 31, pose: pose({ ...placeInBasket, armB: [42, 26], lean: 12, squash: 0.96 }), ease: easing.out },
    // Đứng thẳng, quay lại hướng giường.
    {
      frame: 38,
      pose: pose({ armA: [-14, -6], armB: [12, -10], legA: [-18, -6], legB: [8, 4], lean: -6, tilt: -6, hop: 3 }),
      ease: easing.inOut,
    },
    {
      frame: 45,
      pose: pose({ armA: [10, 6], armB: [-8, -6], legA: [-6, 2], legB: [18, -8], lean: -5, tilt: -4, hop: 4 }),
      ease: easing.inOut,
    },
    // Vươn tay bấm công tắc, vượt quá rồi ấn xuống.
    { frame: 53, pose: reachSwitch, ease: easing.outBack(1.4) },
    { frame: 57, pose: pose({ ...reachSwitch, armA: [-88, -54], squash: 0.97 }), ease: easing.in },
    { frame: 60, pose: pose({ ...reachSwitch, armA: [-84, -40] }), ease: easing.out },
    // Buông tay, chùng người buồn ngủ.
    { frame: 68, pose: sleepy, ease: easing.inOut },
    // Vòng lặp: ngáp vươn nhẹ rồi gục đầu lắc lư.
    {
      frame: 78,
      pose: pose({ ...sleepy, armA: [-16, -14], armB: [16, 14], lean: -3, tilt: -6, squash: 1.04 }),
      ease: easing.inOut,
    },
    { frame: 88, pose: sleepy, ease: easing.inOut },
  ],
  cycle: { from: 68, to: 88 },
};
