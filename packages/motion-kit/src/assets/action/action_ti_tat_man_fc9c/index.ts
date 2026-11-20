import { easing } from "../../../rig/math.js";
import { type ActionClip, pose } from "../../../rig/pose.js";

// Cầm điện thoại trước ngực: khuỷu hạ thấp, cẳng tay nằm ngang về giữa thân,
// tay luôn ở dưới cằm để không che mặt.
const holdPhone = pose({
  armA: [-12, 112],
  armB: [16, -118],
  legA: [-4, 2],
  legB: [4, -2],
  tilt: 8,
});

// Ngón tay chạm màn hình: tay trái nhấn thêm một chút.
const tapPhone = pose({
  ...holdPhone,
  armA: [-6, 122],
  squash: 0.98,
});

// Cúi sang phải, thả điện thoại vào ngăn kéo thấp.
const dropInDrawer = pose({
  armA: [-18, 20],
  armB: [38, 12],
  legA: [-8, 10],
  legB: [10, -14],
  lean: 12,
  tilt: 10,
  squash: 0.94,
});

// Đẩy ngăn kéo đóng: tay phải duỗi ngang hơn, người dồn về trước.
const pushDrawer = pose({
  armA: [-24, 24],
  armB: [68, 6],
  legA: [-10, 8],
  legB: [12, -10],
  lean: 14,
  tilt: 6,
  squash: 0.95,
});

// Với lấy cuốn sách trên bàn.
const grabBook = pose({
  armA: [-10, 30],
  armB: [44, 22],
  legA: [-4, 4],
  legB: [6, -6],
  lean: 7,
  tilt: 6,
});

// Đọc sách: hai cẳng tay ôm sách ngang ngực, đầu cúi nhẹ nhìn trang.
const reading = pose({
  armA: [-10, 114],
  armB: [10, -114],
  legA: [-4, 2],
  legB: [4, -2],
  lean: 2,
  tilt: 10,
});

/** Tắt điện thoại, cất vào ngăn kéo, đóng lại rồi cầm sách đọc dưới đèn ngủ. */
export const asset: ActionClip = {
  keys: [
    { frame: 0, pose: pose({}) },
    // Lấy đà nhẹ trước khi đưa điện thoại lên.
    { frame: 5, pose: pose({ armA: [-8, 20], armB: [10, -20], squash: 0.96 }), ease: easing.in },
    { frame: 12, pose: holdPhone, ease: easing.outBack(1.3) },
    { frame: 16, pose: tapPhone, ease: easing.inOut },
    { frame: 20, pose: holdPhone, ease: easing.out },
    // Nghiêng người cất điện thoại vào ngăn kéo.
    { frame: 28, pose: dropInDrawer, ease: easing.inOut },
    { frame: 31, pose: pose({ ...dropInDrawer, armB: [32, 18] }), ease: easing.out },
    // Đẩy ngăn kéo đóng lại, có quá đà rồi hồi.
    { frame: 37, pose: pushDrawer, ease: easing.outBack(1.4) },
    { frame: 42, pose: pose({ armA: [-6, 10], armB: [14, -10], lean: 2, tilt: 2, squash: 1.02 }), ease: easing.out },
    // Với lấy sách rồi đưa lên đọc.
    { frame: 50, pose: grabBook, ease: easing.inOut },
    { frame: 58, pose: reading, ease: easing.outBack(1.3) },
    // Vòng lặp: đầu gật nhẹ theo dòng chữ, tay phải lật trang.
    { frame: 64, pose: pose({ ...reading, tilt: 14, lean: 3 }), ease: easing.inOut },
    { frame: 70, pose: pose({ ...reading, armB: [22, -96], tilt: 6, lean: 1 }), ease: easing.inOut },
    { frame: 76, pose: reading, ease: easing.inOut },
  ],
  cycle: { from: 58, to: 76 },
};
