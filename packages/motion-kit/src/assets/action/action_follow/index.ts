import { easing } from "../../../rig/math.js";
import { type ActionClip, pose } from "../../../rig/pose.js";

// Đứng thẳng nhìn người xem, một tay chỉ chếch lên nút theo dõi ở phần trên khung (thẻ kết, ADR-021).
// Cánh tay trên 128 độ, nhấn xuống 122 độ: bàn tay và khuỷu luôn ngoài vùng đầu (kiểm ở kit.test); tay kia chống hông.
const point = pose({
  armA: [-34, 70],
  armB: [128, 8],
  legA: [-8, 0],
  legB: [8, 0],
  lean: -4,
  tilt: -8,
  hop: 8,
});
// "Bấm": gập cẳng tay xuống như nhấn nút, người nhún theo.
const tap = pose({ ...point, armB: [122, 20], hop: 0, squash: 0.95 });

/** Mời theo dõi: lấy đà, chỉ tay lên nút theo dõi, rồi nhấn nhấn lặp như đang bấm giúp người xem. */
export const actionFollow: ActionClip = {
  keys: [
    { frame: 0, pose: pose({}) },
    { frame: 5, pose: pose({ armB: [80, 6], squash: 0.94 }), ease: easing.in },
    { frame: 13, pose: point, ease: easing.out },
    { frame: 19, pose: tap, ease: easing.in },
    { frame: 25, pose: point, ease: easing.out },
    { frame: 31, pose: tap, ease: easing.in },
    { frame: 37, pose: point, ease: easing.out },
  ],
  cycle: { from: 25, to: 37 },
};
