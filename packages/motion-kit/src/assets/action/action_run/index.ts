import { easing } from "../../../rig/math.js";
import { type ActionClip, pose } from "../../../rig/pose.js";

const lean = 10;
const strideA = pose({
  armA: [34, 45],
  armB: [-34, -45],
  legA: [38, -10],
  legB: [-30, 62],
  lean,
  hop: 4,
});
const flight = pose({
  armA: [4, 45],
  armB: [-4, -45],
  legA: [10, 40],
  legB: [-12, 50],
  lean,
  hop: 18,
});
const strideB = pose({
  armA: [-34, 45],
  armB: [34, -45],
  legA: [-30, 62],
  legB: [38, -10],
  lean,
  hop: 4,
});

/**
 * Chạy tại chỗ (ADR-025): chúi người tới trước, tay gập đánh mạnh, có pha bay hai chân rời đất.
 * Chu kỳ 16 frame, nhanh gấp rưỡi bước đi. Dời vị trí trên khung do template làm.
 */
export const actionRun: ActionClip = {
  keys: [
    { frame: 0, pose: pose({}) },
    { frame: 4, pose: pose({ ...strideA, hop: 0, squash: 0.94 }), ease: easing.in },
    { frame: 8, pose: strideA, ease: easing.out },
    { frame: 12, pose: flight, ease: easing.linear },
    { frame: 16, pose: strideB, ease: easing.linear },
    { frame: 20, pose: { ...flight, legA: [-12, 50], legB: [10, 40] }, ease: easing.linear },
    { frame: 24, pose: strideA, ease: easing.linear },
  ],
  cycle: { from: 8, to: 24 },
};
