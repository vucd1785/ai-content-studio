import type { FormatPack } from "../formats/packs.js";
import type { ShotSize } from "./v2.js";

/** Shot đã gắn frame (sau alignment), đủ để kiểm luật nhịp. */
export type TimedShot = {
  shotId: string;
  fromFrame: number;
  durationInFrames: number;
  shotSize: ShotSize;
};

export type PacingViolation =
  | { rule: "cuts_per_minute"; cutsPerMinute: number; min: number; max: number }
  | { rule: "max_static"; shotId: string; seconds: number; maxSeconds: number }
  | { rule: "same_shot_size"; shotId: string; shotSize: ShotSize };

/**
 * Luật nhịp của gói (05 mục Gói thể loại), hàm thuần:
 * - số cắt mỗi phút = số shot × 60 / độ dài video, nằm trong khoảng của gói;
 * - không shot nào dài hơn `maxStaticSec`;
 * - không hai shot liền nhau cùng `shotSize`.
 * Cách đếm theo spike P6-03: 10 shot trong 30 giây là 20 cắt mỗi phút.
 * Template sửa được thì sửa; còn lại thành warning `pacing_violation` của QA.
 */
export function checkPacing(
  shots: readonly TimedShot[],
  pack: FormatPack,
  fps: number,
): PacingViolation[] {
  const out: PacingViolation[] = [];
  const totalFrames = shots.reduce((sum, s) => sum + s.durationInFrames, 0);
  if (shots.length === 0 || totalFrames <= 0) {
    return out;
  }
  const { cutsPerMinute, maxStaticSec, noSameShotSizeInARow } = pack.pacing;
  const cpm = Number(((shots.length * 60 * fps) / totalFrames).toFixed(2));
  if (cpm < cutsPerMinute.min || cpm > cutsPerMinute.max) {
    out.push({
      rule: "cuts_per_minute",
      cutsPerMinute: cpm,
      min: cutsPerMinute.min,
      max: cutsPerMinute.max,
    });
  }
  const sorted = [...shots].sort((a, b) => a.fromFrame - b.fromFrame);
  sorted.forEach((shot, i) => {
    const seconds = shot.durationInFrames / fps;
    if (seconds > maxStaticSec + 1e-9) {
      out.push({
        rule: "max_static",
        shotId: shot.shotId,
        seconds: Number(seconds.toFixed(2)),
        maxSeconds: maxStaticSec,
      });
    }
    const prev = sorted[i - 1];
    if (noSameShotSizeInARow && prev !== undefined && prev.shotSize === shot.shotSize) {
      out.push({ rule: "same_shot_size", shotId: shot.shotId, shotSize: shot.shotSize });
    }
  });
  return out;
}

/**
 * Số cắt mỗi phút một shot list chưa gắn frame sẽ cần, ước theo thời lượng mục tiêu của brief.
 * Dùng trong prompt và kiểm sơ bộ trước khi có audio; con số thật do `checkPacing` đo.
 */
export function shotsNeededForDuration(pack: FormatPack, durationSec: number) {
  const minutes = durationSec / 60;
  return {
    min: Math.ceil(pack.pacing.cutsPerMinute.min * minutes),
    max: Math.floor(pack.pacing.cutsPerMinute.max * minutes),
  };
}
