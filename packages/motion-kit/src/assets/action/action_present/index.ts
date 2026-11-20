import { easing } from "../../../rig/math.js";
import { type ActionClip, pose } from "../../../rig/pose.js";

const present = pose({
  armA: [-14, 16],
  armB: [92, 18],
  legA: [-8, 0],
  legB: [10, 0],
  lean: 4,
  tilt: 4,
});

/**
 * Giới thiệu (ADR-025): đưa tay mở về phía trước như mời nhìn vào đồ vật hay hình minh họa bên cạnh.
 * Nhân vật quay mặt theo `facing`, nên tay luôn chỉ về phía người hoặc vật đối diện.
 */
export const actionPresent: ActionClip = {
  keys: [
    { frame: 0, pose: pose({}) },
    { frame: 5, pose: pose({ armB: [30, 40], lean: -2 }), ease: easing.in },
    { frame: 13, pose: present, ease: easing.outBack(1.3) },
    { frame: 28, pose: pose({ ...present, armB: [98, 26], tilt: 6 }), ease: easing.inOut },
    { frame: 44, pose: present, ease: easing.inOut },
  ],
  cycle: { from: 13, to: 44 },
};
