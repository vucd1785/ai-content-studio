/**
 * Hàm số học dùng chung của motion kit. Mọi tài sản là hàm thuần của frame:
 * không số ngẫu nhiên của runtime, không đọc giờ hệ thống, không state giữa các frame.
 */

/** Số giả ngẫu nhiên tất định trong [0, 1) theo (seed, i); render lại cùng frame ra cùng kết quả. */
export function rnd(seed: number, i: number): number {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export type EasingFn = (t: number) => number;

/** Bộ easing của kit. Tài sản mới dùng các hàm này, không tự viết easing riêng. */
export const easing = {
  linear: (t: number) => t,
  inOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  out: (t: number) => 1 - (1 - t) ** 3,
  in: (t: number) => t * t * t,
  /** Quá đà rồi về: `s` càng lớn càng vượt xa. */
  outBack:
    (s = 1.6): EasingFn =>
    (t: number) => {
      const c = s + 1;
      return 1 + c * (t - 1) ** 3 + s * (t - 1) ** 2;
    },
} as const;

/** Chuỗi số trơn trong [-1, 1] theo frame, tất định theo seed (thở, lắc nhẹ). */
export function wobble(frame: number, seed: number, period: number): number {
  const phase = rnd(seed, 1) * Math.PI * 2;
  return Math.sin((frame / period) * Math.PI * 2 + phase);
}
