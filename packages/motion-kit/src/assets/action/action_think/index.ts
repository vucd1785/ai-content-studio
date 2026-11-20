import { easing } from "../../../rig/math.js";
import { type ActionClip, pose } from "../../../rig/pose.js";

// Một tay khoanh ngang bụng, tay kia dựng cẳng tay cạnh má (khuỷu hạ thấp như `action_panic`, không chạm mặt).
const think = pose({
  armA: [24, 56],
  armB: [58, 96],
  legA: [-4, 0],
  legB: [8, 0],
  lean: -2,
  tilt: 7,
});

/** Suy nghĩ: chậm rãi khoanh tay, nghiêng đầu, lắc đầu nhẹ lặp như đang cân nhắc. */
export const actionThink: ActionClip = {
  keys: [
    { frame: 0, pose: pose({}) },
    { frame: 12, pose: think, ease: easing.inOut },
    { frame: 30, pose: pose({ ...think, tilt: 11, lean: -3 }), ease: easing.inOut },
    { frame: 48, pose: pose({ ...think, tilt: 4, lean: -1 }), ease: easing.inOut },
    { frame: 66, pose: think, ease: easing.inOut },
  ],
  cycle: { from: 12, to: 66 },
};
