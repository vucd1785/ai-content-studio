import type { FC } from "react";
import { CharacterFigure } from "./character.js";
import type { ExpressionSpec } from "./face.js";
import { rnd } from "./math.js";
import { type ActionClip, type Pose, sampleAction } from "./pose.js";
import type { SkinSpec } from "./skin.js";

/** Khoảng frame tuyệt đối nhân vật đang nói, `to` không tính. */
export type SpeakingRange = { from: number; to: number };

/** Chớp mắt 4 frame, chu kỳ 90–129 frame tùy `seed`, để hai nhân vật không chớp cùng lúc. */
export function blinkAt(frame: number, seed: number): boolean {
  const period = 90 + Math.floor(rnd(seed, 7) * 40);
  const phase = Math.floor(rnd(seed, 3) * period);
  return (frame + phase) % period < 4;
}

/** Độ mở miệng 0..1 khi `frame` nằm trong một khoảng nói, ngược lại null (miệng theo biểu cảm). */
export function mouthOpenAt(
  frame: number,
  ranges: readonly SpeakingRange[],
  seed: number,
): number | null {
  const range = ranges.find((r) => frame >= r.from && frame < r.to);
  if (range === undefined) {
    return null;
  }
  // Khép dần ở 2 frame cuối để không cắt miệng đang mở.
  const tail = Math.min(1, (range.to - frame) / 3);
  const wave = Math.abs(
    Math.sin(frame * 0.9 + seed) * 0.6 + Math.sin(frame * 0.37 + seed * 2) * 0.4,
  );
  return (0.15 + 0.85 * wave) * tail;
}

export type ActorProps = {
  skin: SkinSpec;
  action: ActionClip;
  expression: ExpressionSpec;
  /** Frame tuyệt đối của composition. */
  frame: number;
  /** Frame bắt đầu hành động (đầu shot). */
  startFrame: number;
  /** Tư thế ở cuối shot trước, để chuyển liền mạch. */
  fromPose?: Pose;
  speakingRanges?: readonly SpeakingRange[];
  /** Hạt giống riêng của nhân vật (chớp mắt, thở, miệng). */
  seed: number;
  facing: 1 | -1;
};

/** Tư thế của nhân vật ở một frame; template dùng để lấy `fromPose` cho shot sau. */
export function actorPoseAt(action: ActionClip, frame: number, startFrame: number, from?: Pose) {
  return sampleAction(action, frame - startFrame, from);
}

/** Nhân vật diễn một hành động, đứng tại gốc tọa độ. Hàm thuần của `frame`. */
export const Actor: FC<ActorProps> = ({
  skin,
  action,
  expression,
  frame,
  startFrame,
  fromPose,
  speakingRanges = [],
  seed,
  facing,
}) => (
  <CharacterFigure
    skin={skin}
    pose={actorPoseAt(action, frame, startFrame, fromPose)}
    expression={expression}
    blink={blinkAt(frame, seed)}
    mouthOpen={mouthOpenAt(frame, speakingRanges, seed)}
    breathe={Math.sin(frame / 12 + seed) * 2}
    facing={facing}
  />
);
