import { easing } from "../../../rig/math.js";
import { type ActionClip, pose } from "../../../rig/pose.js";

const stepA = pose({ armA: [22, 10], armB: [-22, -10], legA: [26, -6], legB: [-26, 30], hop: 0 });
const pass = pose({ armA: [0, 6], armB: [0, -6], legA: [0, 0], legB: [0, 20], hop: 8 });
const stepB = pose({ armA: [-22, 10], armB: [22, -10], legA: [-26, 30], legB: [26, -6], hop: 0 });
const pass2 = pose({ armA: [0, 6], armB: [0, -6], legA: [0, 20], legB: [0, 0], hop: 8 });

/**
 * Bước đi tại chỗ: chu kỳ 24 frame (hai bước), tay đánh ngược chân, nhún ở nhịp chuyển chân.
 * Dời vị trí trên khung do template làm, không nằm trong tài sản.
 */
export const actionWalk: ActionClip = {
  keys: [
    { frame: 0, pose: pose({}) },
    { frame: 4, pose: stepA, ease: easing.out },
    { frame: 10, pose: pass, ease: easing.linear },
    { frame: 16, pose: stepB, ease: easing.linear },
    { frame: 22, pose: pass2, ease: easing.linear },
    { frame: 28, pose: stepA, ease: easing.linear },
  ],
  cycle: { from: 4, to: 28 },
};
