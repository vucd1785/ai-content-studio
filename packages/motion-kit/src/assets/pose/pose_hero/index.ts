import { holdClip, pose } from "../../../rig/pose.js";

/** Chống nạnh, đầu hơi nghiêng: tự tin. */
export const poseHero = holdClip(
  pose({ armA: [-40, 86], armB: [40, -86], legA: [-12, 0], legB: [12, 0], tilt: -6 }),
);
