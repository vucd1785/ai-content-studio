import { MUSIC_MIX } from "@studio/audio-kit";

/**
 * Trộn nhạc nền (ADR-019): nhạc hạ xuống khi có lời thoại (ducking) và lên lại giữa các câu, vào dần ở đầu,
 * tắt dần ở cuối. Hàm thuần của frame để render lại cho ra cùng tiếng.
 */

export type FrameRange = { from: number; to: number };

/** Gộp mọi khoảng nói của mọi nhân vật (các shot cùng cảnh lặp lại cùng khoảng) thành dãy rời nhau, tăng dần. */
export function speechRanges(
  shots: readonly { actors: readonly { speakingRanges: readonly FrameRange[] }[] }[],
): FrameRange[] {
  const all = shots
    .flatMap((shot) => shot.actors.flatMap((a) => a.speakingRanges))
    .filter((r) => r.to > r.from)
    .sort((a, b) => a.from - b.from);
  const merged: FrameRange[] = [];
  for (const r of all) {
    const last = merged[merged.length - 1];
    if (last !== undefined && r.from <= last.to) {
      last.to = Math.max(last.to, r.to);
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Mức nhạc 0..1 ở `frame` (tuyệt đối). `ranges` từ `speechRanges`; `total` là tổng frame của video. */
export function musicVolumeAt(
  frame: number,
  ranges: readonly FrameRange[],
  total: number,
  mix: {
    base: number;
    duck: number;
    rampFrames: number;
    fadeInFrames: number;
    fadeOutFrames: number;
  } = MUSIC_MIX,
): number {
  let speaking = 0;
  for (const r of ranges) {
    if (r.from - mix.rampFrames > frame) {
      break;
    }
    // 1 trong khoảng nói, giảm tuyến tính về 0 trong `rampFrames` ở hai đầu.
    const inside = Math.min(frame - (r.from - mix.rampFrames), r.to + mix.rampFrames - frame);
    speaking = Math.max(speaking, clamp01(inside / mix.rampFrames));
  }
  const level = mix.base + (mix.duck - mix.base) * speaking;
  const fadeIn = clamp01(frame / mix.fadeInFrames);
  const fadeOut = clamp01((total - frame) / mix.fadeOutFrames);
  return level * fadeIn * fadeOut;
}
