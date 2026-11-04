import { easing } from "../../../rig/math.js";
import { type ActionClip, pose } from "../../../rig/pose.js";

const base = { armA: [-12, 8], legA: [-6, 0], legB: [6, 0], lean: -3, tilt: -4 } as const;
// Cánh tay trên mở 105 độ (ngang vai, chếch lên) để bàn tay luôn ở ngoài vùng đầu;
// cẳng tay lắc trong 20–42 độ. P6-03: góc hẹp hơn làm Tí trông như gãi đầu.
const up = pose({ ...base, armB: [105, 20] });
const out = pose({ ...base, armB: [105, 42] });

/** Chào: hạ tay lấy đà, vung lên quá đà, rồi vẫy lặp. */
export const actionWave: ActionClip = {
  keys: [
    { frame: 0, pose: pose({}) },
    { frame: 5, pose: pose({ ...base, armB: [40, 30], tilt: 0 }), ease: easing.out },
    { frame: 13, pose: up, ease: easing.outBack(1.2) },
    { frame: 19, pose: out },
    { frame: 25, pose: up },
  ],
  cycle: { from: 13, to: 25 },
};
