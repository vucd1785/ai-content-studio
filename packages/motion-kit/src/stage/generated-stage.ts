import type { StageLayout } from "./types.js";

/**
 * Sân khấu chuẩn của bối cảnh do worker tự tạo (ADR-017): giống `bg_room`, nên luật khung hình, vị trí
 * đứng và camera của P6-17 dùng lại được mà không phải kiểm riêng. Bối cảnh phải vẽ kín vùng `bounds`.
 */
export const GENERATED_BACKGROUND_STAGE: StageLayout = {
  groundY: 1580,
  actorScale: 1.7,
  slots: { left: 310, center: 540, right: 770 },
  trioSlots: { left: 230, center: 540, right: 850 },
  bounds: { x0: 0, x1: 1080, y0: 0, y1: 2615 },
};

/** Phần vẽ thêm mỗi bên của bối cảnh rộng: khung ngang 16:9 cỡ rộng nhìn khoảng x -420..1500. */
export const WIDE_BACKGROUND_MARGIN = 440;

/**
 * Sân khấu của bối cảnh tự tạo vẽ rộng (ADR-022): như `GENERATED_BACKGROUND_STAGE` nhưng vẽ kín cả
 * x -440..1520, để khung ngang 16:9 thấy cảnh thật ở hai bên thay vì bản soi gương. Khung dọc vẫn đứng ở giữa.
 */
export const GENERATED_WIDE_BACKGROUND_STAGE: StageLayout = {
  ...GENERATED_BACKGROUND_STAGE,
  bounds: { x0: -WIDE_BACKGROUND_MARGIN, x1: 1080 + WIDE_BACKGROUND_MARGIN, y0: 0, y1: 2615 },
};
