import { easing } from "../../../rig/math.js";
import { type ActionClip, pose } from "../../../rig/pose.js";

// Hai tay vươn sang phải nắm đầu thước dây, người ngả ra sau về bên trái như đang kéo căng dây.
// 2026-11-11 (Director duyệt): tay trái (armA) hạ thấp, không vắt ngang thân, để không chạm đầu tròn
// của Đậu (luật tay của rig, kiểm bằng `checkRigClip`).
const pullA = pose({
  armA: [32, 18],
  armB: [80, 8],
  legA: [-24, 12],
  legB: [14, -4],
  lean: -12,
  tilt: -6,
  squash: 0.97,
});

// Bước lùi tiếp: đổi chân, người hơi nhổm lên, tay giật về một chút.
const pullB = pose({
  armA: [29, 34],
  armB: [72, 24],
  legA: [-10, 4],
  legB: [-4, 10],
  lean: -8,
  tilt: -9,
  hop: 4,
  squash: 1.02,
});

/** Kéo thước dây: cúi người lấy đà, ngả mạnh ra sau, rồi bước lùi giật kéo lặp lại. */
export const asset: ActionClip = {
  keys: [
    { frame: 0, pose: pose({}) },
    {
      frame: 6,
      pose: pose({
        armA: [18, 20],
        armB: [50, 14],
        lean: 8,
        tilt: 4,
        squash: 0.92,
        legA: [-6, 8],
        legB: [6, -8],
      }),
      ease: easing.in,
    },
    {
      frame: 14,
      pose: pose({ ...pullA, lean: -15, armA: [35, 10], armB: [86, 4] }),
      ease: easing.outBack(1.4),
    },
    { frame: 18, pose: pullA, ease: easing.inOut },
    { frame: 25, pose: pullB, ease: easing.inOut },
    { frame: 32, pose: pullA, ease: easing.inOut },
  ],
  cycle: { from: 18, to: 32 },
};
