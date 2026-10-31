import { useSyncExternalStore } from "react";

/**
 * Cờ hiệu năng và reduced motion của canvas studio (P4-03, 06-3D-UI-DESIGN mục Hiệu năng).
 * Hàm thuần để test được cờ truyền vào `<Canvas>`; hook chỉ đọc media query của trình duyệt.
 */

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export type StudioCanvasFlags = {
  dpr: number | [number, number];
  shadows: boolean;
  /** `demand`: chỉ vẽ lại khi props đổi hoặc người dùng xoay camera, không vòng lặp khung hình. */
  frameloop: "always" | "demand";
};

export function studioCanvasFlags(input: { reducedMotion: boolean; lowPower?: boolean | undefined }): StudioCanvasFlags {
  // Reduced motion kéo theo chế độ hiệu năng thấp: `dpr` 1, tắt shadow, tắt vòng lặp.
  if (input.reducedMotion) {
    return { dpr: 1, shadows: false, frameloop: "demand" };
  }
  if (input.lowPower === true) {
    return { dpr: 1, shadows: false, frameloop: "always" };
  }
  return { dpr: [1, 2], shadows: true, frameloop: "always" };
}

function reducedMotionQuery(): MediaQueryList | null {
  return typeof window === "undefined" || typeof window.matchMedia !== "function"
    ? null
    : window.matchMedia(REDUCED_MOTION_QUERY);
}

function subscribe(onChange: () => void) {
  const query = reducedMotionQuery();
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
}

/** `true` khi hệ điều hành bật giảm chuyển động. Không có `matchMedia` thì `false`. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => reducedMotionQuery()?.matches ?? false,
    () => false,
  );
}
