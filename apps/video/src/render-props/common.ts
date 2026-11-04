/** Khung video dọc của studio (05 mục Template). */
export const MVP_WIDTH = 1080;
export const MVP_HEIGHT = 1920;
export const MVP_FPS = 30;

/** Render props không hợp lệ; worker báo `render_props_invalid`. */
export class RenderPropsError extends Error {
  readonly code = "render_props_invalid" as const;

  constructor(message: string) {
    super(message);
    this.name = "RenderPropsError";
  }
}
