import { easing } from "../../../rig/math.js";
import { type ActionClip, pose } from "../../../rig/pose.js";

const rest = pose({ armA: [-14, 20], armB: [14, -20] });
const open = pose({ armA: [-18, 24], armB: [62, 58], lean: 2, tilt: 3 });
const beat = pose({ armA: [-30, 50], armB: [40, 40], lean: -1, tilt: -2 });

/** Nói: tay mở lòng bàn tay theo nhịp câu, chu kỳ 36 frame. Miệng do khoảng nói của template điều khiển. */
export const actionTalk: ActionClip = {
  keys: [
    { frame: 0, pose: pose({}) },
    { frame: 8, pose: open, ease: easing.outBack(1.3) },
    { frame: 20, pose: beat },
    { frame: 30, pose: rest },
    { frame: 44, pose: open },
  ],
  cycle: { from: 8, to: 44 },
};
