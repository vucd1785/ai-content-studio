import { clamp, type EasingFn, easing, lerp } from "./math.js";

/** Góc khớp của một chi: [góc đoạn trên, góc gập đoạn dưới so với đoạn trên], đơn vị độ. */
export type LimbAngles = readonly [number, number];

/**
 * Tư thế của rig dùng chung. Góc 0 = chỉ xuống, 90 = sang phải màn hình, 180 = chỉ lên.
 * `armA`, `legA` ở phía trái màn hình; `armB`, `legB` ở phía phải.
 * `lean` nghiêng thân quanh hông, `tilt` nghiêng đầu quanh cổ, `hop` nhấc cả người lên (px).
 * `squash` co giãn thân theo chiều dọc (1 = không đổi), dùng cho lớp da mềm như Đậu.
 */
export type Pose = {
  armA: LimbAngles;
  armB: LimbAngles;
  legA: LimbAngles;
  legB: LimbAngles;
  lean: number;
  tilt: number;
  hop: number;
  squash: number;
};

export const POSE_REST: Pose = {
  armA: [-10, 6],
  armB: [10, -6],
  legA: [-6, 0],
  legB: [6, 0],
  lean: 0,
  tilt: 0,
  hop: 0,
  squash: 1,
};

/** Tạo tư thế từ phần khác với tư thế nghỉ. */
export const pose = (partial: Partial<Pose>): Pose => ({ ...POSE_REST, ...partial });

const lerpPair = (a: LimbAngles, b: LimbAngles, t: number): LimbAngles => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
];

export function mixPose(a: Pose, b: Pose, t: number): Pose {
  return {
    armA: lerpPair(a.armA, b.armA, t),
    armB: lerpPair(a.armB, b.armB, t),
    legA: lerpPair(a.legA, b.legA, t),
    legB: lerpPair(a.legB, b.legB, t),
    lean: lerp(a.lean, b.lean, t),
    tilt: lerp(a.tilt, b.tilt, t),
    hop: lerp(a.hop, b.hop, t),
    squash: lerp(a.squash, b.squash, t),
  };
}

/** Một khóa của hành động: tư thế đạt được tại `frame`, easing dùng cho đoạn đi tới khóa này. */
export type PoseKey = { frame: number; pose: Pose; ease?: EasingFn };

/**
 * Hành động là chuỗi khóa: lấy đà, đạt đích (thường quá đà), giữ nhịp.
 * `cycle` lặp đoạn [from, to) mãi sau khi chạy qua `to` (vẫy tay, bước đi, nói).
 */
export type ActionClip = {
  keys: readonly PoseKey[];
  cycle?: { from: number; to: number };
};

function wrapFrame(clip: ActionClip, local: number): number {
  const c = clip.cycle;
  if (c === undefined || local < c.to) {
    return local;
  }
  const len = c.to - c.from;
  return c.from + ((local - c.from) % len);
}

/**
 * Tư thế của hành động tại frame `local` (tính từ đầu shot).
 * `from` là tư thế nhân vật đang có ở shot trước; khóa đầu tiên được thay bằng nó để chuyển liền mạch.
 */
export function sampleAction(clip: ActionClip, local: number, from?: Pose): Pose {
  const keys = clip.keys;
  const first = keys[0];
  if (first === undefined) {
    return from ?? POSE_REST;
  }
  const f = wrapFrame(clip, Math.max(0, local));
  const startPose = from ?? first.pose;
  if (f <= first.frame) {
    return startPose;
  }
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i] as PoseKey;
    const prev = keys[i - 1] as PoseKey;
    if (f <= k.frame) {
      const span = k.frame - prev.frame;
      const t = span <= 0 ? 1 : clamp((f - prev.frame) / span, 0, 1);
      const a = i === 1 ? startPose : prev.pose;
      return mixPose(a, k.pose, (k.ease ?? easing.inOut)(t));
    }
  }
  return (keys[keys.length - 1] as PoseKey).pose;
}

/** Hành động chỉ giữ một tư thế, chuyển vào trong `blend` frame có quá đà nhẹ. */
export function holdClip(target: Pose, blend = 10): ActionClip {
  return {
    keys: [
      { frame: 0, pose: target },
      { frame: blend, pose: target, ease: easing.outBack(1.4) },
    ],
  };
}
