import { easing } from "../../../rig/math.js";
import { type ActionClip, pose } from "../../../rig/pose.js";

// Ngồi: đùi dạng ra, cẳng chân thả xuống.
const seatLegs = {
  legA: [-70, 70] as [number, number],
  legB: [70, -70] as [number, number],
};

// Ngáp vươn vai: tay dang ngang ngang vai, cẳng tay duỗi ra ngoài, tránh xa đầu.
// Bản trước giơ tay cao gập về phía đầu nên bàn tay chạm mặt; giờ giữ cánh tay trên ~95 độ.
const yawn = pose({
  ...seatLegs,
  armA: [-95, 12],
  armB: [95, -12],
  lean: -6,
  tilt: -14,
  squash: 1.06,
});

// Tì tay lên bàn: khuỷu thấp, cẳng tay hướng vào giữa trước bụng.
const desk = pose({
  ...seatLegs,
  armA: [-25, 60],
  armB: [25, -60],
  lean: 3,
  tilt: 6,
  squash: 0.98,
});

const nod = pose({ ...desk, armA: [-22, 64], armB: [22, -64], lean: 10, tilt: 17, squash: 0.95 });
const jolt = pose({ ...desk, armA: [-32, 50], armB: [32, -50], lean: -6, tilt: -10, hop: 6, squash: 1.06 });

/** Ngáp dài, rồi gật gà buồn ngủ và giật mình ngẩng lên (vòng lặp). */
export const asset: ActionClip = {
  keys: [
    { frame: 0, pose: pose({}) },
    { frame: 5, pose: pose({ ...seatLegs, armA: [-20, 20], armB: [20, -20], lean: 4, tilt: 6, squash: 0.94 }), ease: easing.in },
    { frame: 14, pose: yawn, ease: easing.outBack(1.3) },
    { frame: 24, pose: pose({ ...yawn, armA: [-98, 8], armB: [98, -8], tilt: -16, squash: 1.08 }), ease: easing.inOut },
    { frame: 34, pose: desk, ease: easing.inOut },
    { frame: 46, pose: nod, ease: easing.in },
    { frame: 50, pose: jolt, ease: easing.outBack(1.6) },
    { frame: 56, pose: desk, ease: easing.inOut },
  ],
  cycle: { from: 34, to: 56 },
};
