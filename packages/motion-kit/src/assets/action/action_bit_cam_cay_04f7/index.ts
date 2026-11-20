import { easing } from "../../../rig/math.js";
import { type ActionClip, pose } from "../../../rig/pose.js";

// Chổi nằm thấp: hai tay chụm về một bên, khuỷu luôn dưới ngang vai để không che mặt.
const sweepLeft = pose({
  armA: [-38, -14],
  armB: [-18, -42],
  legA: [-12, 4],
  legB: [10, -4],
  lean: -7,
  tilt: -5,
  squash: 0.97,
});

const sweepRight = pose({
  armA: [18, 42],
  armB: [40, 14],
  legA: [-10, 4],
  legB: [12, -4],
  lean: 7,
  tilt: 5,
  squash: 0.99,
});

// Ôm sách trước ngực: cẳng tay nằm ngang, thấp hơn cằm.
const holdBook = pose({
  armA: [-22, -72],
  armB: [22, 72],
  legA: [-6, 2],
  legB: [6, -2],
  tilt: -4,
});

// Đẩy sách vào ngăn kéo bên phải.
const pushDrawer = pose({
  armA: [24, 48],
  armB: [72, 12],
  legA: [-14, 6],
  legB: [14, -4],
  lean: 9,
  tilt: 6,
});

/** Quét rác vào sọt ba nhịp, rồi cất sách vào ngăn kéo và lặp nhịp đẩy khép ngăn kéo. */
export const asset: ActionClip = {
  keys: [
    { frame: 0, pose: pose({}) },
    // Lấy đà: chùng người, gom tay về bên trái.
    { frame: 5, pose: pose({ ...sweepLeft, lean: -11, squash: 0.92, hop: 0 }), ease: easing.in },
    // Đường quét 1, vượt nhẹ rồi về.
    { frame: 12, pose: pose({ ...sweepRight, lean: 10 }), ease: easing.outBack(1.4) },
    { frame: 15, pose: sweepRight, ease: easing.out },
    { frame: 22, pose: sweepLeft, ease: easing.inOut },
    // Đường quét 2.
    { frame: 29, pose: pose({ ...sweepRight, lean: 10 }), ease: easing.inOut },
    { frame: 36, pose: sweepLeft, ease: easing.inOut },
    // Đường quét 3 hất mạnh vào sọt, nảy nhẹ.
    { frame: 42, pose: pose({ ...sweepRight, lean: 12, hop: 6, tilt: 8 }), ease: easing.outBack(1.5) },
    { frame: 47, pose: pose({ ...sweepRight, hop: 0 }), ease: easing.out },
    // Bỏ chổi, cầm sách lên ôm trước ngực.
    { frame: 55, pose: pose({ ...holdBook, squash: 0.95 }), ease: easing.inOut },
    { frame: 60, pose: holdBook, ease: easing.out },
    // Lấy đà kéo sách về rồi đẩy vào ngăn kéo.
    { frame: 64, pose: pose({ ...holdBook, lean: -5, squash: 0.95 }), ease: easing.in },
    { frame: 71, pose: pose({ ...pushDrawer, armB: [78, 4], lean: 12 }), ease: easing.outBack(1.4) },
    { frame: 75, pose: pushDrawer, ease: easing.out },
    // Vòng lặp: nhích tay ra rồi đẩy khép ngăn kéo lại.
    { frame: 81, pose: pose({ ...pushDrawer, armB: [62, 30], lean: 5, tilt: 3 }), ease: easing.inOut },
    { frame: 87, pose: pushDrawer, ease: easing.inOut },
  ],
  cycle: { from: 75, to: 87 },
};
