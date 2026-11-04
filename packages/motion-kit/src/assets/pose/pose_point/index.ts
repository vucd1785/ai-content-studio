import { holdClip, pose } from "../../../rig/pose.js";

/** Giữ tay chỉ sang phải màn hình (lật `facing` để chỉ sang trái). */
export const posePoint = holdClip(
  pose({ armA: [-40, 86], armB: [96, -4], legA: [-8, 0], legB: [10, 0], lean: 4 }),
);
