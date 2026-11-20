/** Khung video dọc của studio (05 mục Template). */
export const MVP_WIDTH = 1080;
export const MVP_HEIGHT = 1920;
export const MVP_FPS = 30;

/** Khung ngang 16:9 (ADR-022): lựa chọn thử khi bắt đầu run. */
export const WIDE_WIDTH = 1920;
export const WIDE_HEIGHT = 1080;

/** Tỷ lệ khung chọn khi bắt đầu run (ADR-022). */
export type AspectRatio = "9:16" | "16:9";

/** Kích thước khung theo tỷ lệ. */
export function frameDimensions(aspect: AspectRatio): { width: number; height: number } {
  return aspect === "16:9"
    ? { width: WIDE_WIDTH, height: WIDE_HEIGHT }
    : { width: MVP_WIDTH, height: MVP_HEIGHT };
}

/** Render props không hợp lệ; worker báo `render_props_invalid`. */
export class RenderPropsError extends Error {
  readonly code = "render_props_invalid" as const;

  constructor(message: string) {
    super(message);
    this.name = "RenderPropsError";
  }
}
