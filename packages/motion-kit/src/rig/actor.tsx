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

/** Frame (tính từ đầu shot) mà hành động không lặp đã chạy xong khóa cuối; hành động lặp thì null. */
function settleFrame(action: ActionClip): number | null {
  if (action.cycle !== undefined) {
    return null;
  }
  return action.keys.reduce((m, k) => Math.max(m, k.frame), 0);
}

/**
 * Diễn xuất tự động khi nhân vật đứng yên (ADR-014 bổ sung 2026-11-12): sau khi tư thế hoặc hành động một lần
 * đã xong, người đang nghe gật đầu theo chu kỳ riêng và đung đưa nhẹ, người đang nói nghiêng đầu nhấn nhá.
 * Hành động lặp (nói, vẫy, đi) đã tự chuyển động nên không cộng thêm. Biên độ nhỏ để không chạm luật tay.
 */
export function aliveOffset(
  action: ActionClip,
  local: number,
  frame: number,
  seed: number,
  speaking: boolean,
): { tilt: number; lean: number } {
  const settle = settleFrame(action);
  if (settle === null) {
    return { tilt: 0, lean: 0 };
  }
  // Vào dần trong 12 frame sau khi tư thế đã đứng.
  const weight = Math.min(1, Math.max(0, (local - settle - 4) / 12));
  if (weight === 0) {
    return { tilt: 0, lean: 0 };
  }
  if (speaking) {
    return {
      tilt: weight * 3.2 * Math.sin(frame * 0.19 + seed),
      lean: weight * 1.6 * Math.sin(frame * 0.11 + seed * 2),
    };
  }
  const period = 64 + (Math.floor(seed * 13) % 37);
  const phase = (frame + Math.floor(seed * 7)) % period;
  const nod = phase < 16 ? Math.sin((Math.PI * phase) / 16) : 0;
  return {
    tilt: weight * (5.5 * nod + 1.2 * Math.sin(frame / 37 + seed)),
    lean: weight * 1.4 * Math.sin(frame / 43 + seed * 3),
  };
}

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
}) => {
  const base = actorPoseAt(action, frame, startFrame, fromPose);
  const mouthOpen = mouthOpenAt(frame, speakingRanges, seed);
  const speaking = speakingRanges.some((r) => frame >= r.from && frame < r.to);
  const alive = aliveOffset(action, frame - startFrame, frame, seed, speaking);
  return (
    <CharacterFigure
      skin={skin}
      pose={{ ...base, tilt: base.tilt + alive.tilt, lean: base.lean + alive.lean }}
      expression={expression}
      blink={blinkAt(frame, seed)}
      mouthOpen={mouthOpen}
      breathe={Math.sin(frame / 12 + seed) * 2}
      facing={facing}
    />
  );
};
