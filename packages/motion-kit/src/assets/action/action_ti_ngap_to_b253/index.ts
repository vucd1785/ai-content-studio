import { easing } from "../../../rig/math.js";
import { type ActionClip, pose } from "../../../rig/pose.js";

// Vươn vai: cánh tay trên chỉ giơ ngang (khoảng 95 độ), cẳng tay bẻ ra ngoài, chéo lên trên.
// Bản trước giơ tay thẳng lên trời nên bàn tay và khuỷu tay chạm vào đầu to của Tí.
const stretch = pose({
  armA: [-95, -40],
  armB: [95, 40],
  legA: [-6, 0],
  legB: [6, 0],
  lean: -4,
  tilt: -12,
  squash: 1.06,
});

// Gục xuống bàn: người đổ về trước, đầu cúi, hai tay để thấp trước bụng như đặt lên mặt bàn.
const slump = pose({
  armA: [-20, 50],
  armB: [30, 40],
  legA: [-8, 4],
  legB: [8, -4],
  lean: 13,
  tilt: 16,
  squash: 0.95,
});

/** Ngáp to: khom lấy đà, vươn vai quá đà, rồi gục xuống bàn và gật gù ngủ gật. */
export const asset: ActionClip = {
  keys: [
    { frame: 0, pose: pose({}) },
    {
      frame: 6,
      pose: pose({ armA: [-15, -20], armB: [15, 20], lean: 4, tilt: 6, squash: 0.92 }),
      ease: easing.inOut,
    },
    { frame: 16, pose: stretch, ease: easing.outBack(1.4) },
    { frame: 26, pose: pose({ ...stretch, tilt: -16, squash: 1.08 }), ease: easing.inOut },
    {
      frame: 34,
      pose: pose({ armA: [-40, -20], armB: [40, 20], lean: 2, tilt: 4, squash: 1.0 }),
      ease: easing.inOut,
    },
    { frame: 46, pose: pose({ ...slump, lean: 15, tilt: 19, squash: 0.92 }), ease: easing.in },
    { frame: 52, pose: slump, ease: easing.out },
    { frame: 64, pose: pose({ ...slump, lean: 10, tilt: 12, squash: 0.98 }), ease: easing.inOut },
    { frame: 76, pose: slump, ease: easing.inOut },
  ],
  cycle: { from: 52, to: 76 },
};
