import { easing } from "../../../rig/math.js";
import { type ActionClip, pose } from "../../../rig/pose.js";

const lean = pose({ armA: [-12, 14], armB: [12, -14], lean: 3, tilt: 2 });

/**
 * Lắng nghe và gật gù (ADR-025): hơi chồm tới, gật đầu theo nhịp. Hợp cho shot nhìn người nghe (ADR-024).
 */
export const actionListen: ActionClip = {
  keys: [
    { frame: 0, pose: pose({}) },
    { frame: 8, pose: lean, ease: easing.out },
    { frame: 14, pose: pose({ ...lean, lean: 6, tilt: -4, squash: 0.98 }), ease: easing.out },
    { frame: 20, pose: lean, ease: easing.inOut },
    { frame: 26, pose: pose({ ...lean, lean: 6, tilt: -4, squash: 0.98 }), ease: easing.out },
    { frame: 34, pose: lean, ease: easing.inOut },
    { frame: 56, pose: lean },
  ],
  cycle: { from: 8, to: 56 },
};
