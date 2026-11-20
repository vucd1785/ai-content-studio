import type { FC } from "react";

export type SlotName = "left" | "center" | "right";
export type ShotSize = "wide" | "medium" | "close" | "high";
export type AmbienceKind = "vignette" | "dust" | "foreground_blur";
/** Tông ánh sáng của shot (ADR-023): phủ màu lên bối cảnh và nhân vật, thêm quầng sáng. */
export type Mood = "day" | "warm" | "cool" | "night" | "danger" | "wonder";
/** Hiệu ứng điểm nhấn của shot (ADR-025). */
export type EffectKind =
  | "flash"
  | "impact"
  | "speed_lines"
  | "sparkle"
  | "idea"
  | "confetti"
  | "question";

/** Hệ tọa độ thế giới 1080×1920 của một bối cảnh: mặt đất, vị trí đứng, vùng camera được nhìn. */
export type StageLayout = {
  groundY: number;
  actorScale: number;
  slots: Record<SlotName, number>;
  /**
   * Vị trí khi shot có ba người (bổ sung ADR-013 2026-11-03): giãn hai bên để ba thân không chồng nhau.
   * Không có thì dùng `slots`.
   */
  trioSlots?: Record<SlotName, number>;
  /** Vùng đã vẽ; camera không được nhìn ra ngoài (tránh dải trống ở mép khung). */
  bounds: { x0: number; x1: number; y0: number; y1: number };
  /** Vùng bảng hoặc màn hình trong bối cảnh để template vẽ `board` (sơ đồ, code), nếu có. */
  board?: { x: number; y: number; width: number; height: number };
};

export type BackgroundProps = {
  frame: number;
  /** Vệt nắng qua cửa sổ: yếu tố mức 3, mặc định tắt (P6-05 đo chi phí riêng). */
  lightShaft?: boolean;
};

/**
 * Bối cảnh. `Component` là lớp giữa, nơi nhân vật đứng. Hai lớp tùy chọn tạo chiều sâu (ADR-023):
 * - `Far`: lớp xa (trời, núi, tường sau), vẽ kín `bounds`, đứng sau `Component` và trượt chậm hơn camera;
 *   khi có `Far`, `Component` để trong suốt phần nhìn xuyên ra xa.
 * - `Near`: tiền cảnh thưa (lá, cỏ, góc bàn) ở mép dưới khung, vẽ trước nhân vật, trượt nhanh hơn camera và
 *   được kit làm mờ.
 */
export type BackgroundAsset = {
  stage: StageLayout;
  Component: FC<BackgroundProps>;
  Far?: FC<BackgroundProps>;
  Near?: FC<BackgroundProps>;
};

/**
 * Chuyển động máy trong một shot: `t` chạy 0..1 từ đầu đến cuối shot. `dy` âm là nhìn cao hơn.
 * `rotate` (độ, ADR-025) nghiêng khung quanh tâm (góc nghiêng kiểu Hà Lan); kit tự giữ khung trong bối cảnh.
 */
export type CameraMove = (t: number) => { zoom: number; dx: number; dy: number; rotate?: number };

/** Thông tin chung mọi đồ vật nhận: frame tuyệt đối, tiến độ shot `t` 0..1, seed tất định. */
export type PropProps = {
  frame: number;
  t: number;
  seed: number;
};

/** Đồ vật bay trong khung (`air`): bay từ `from` tới `to` theo hệ thế giới, nét theo `scale`. */
export type AirPropProps = PropProps & {
  from: { x: number; y: number };
  to: { x: number; y: number };
  scale: number;
};

/**
 * Tài sản kind `prop` (P6-19).
 * - `floor`: đứng trên sàn, gốc (0, 0) ở giữa đáy, đơn vị như nhân vật (nhân với `actorScale`). Chiếm một
 *   vị trí `left`, `center`, `right` còn trống như một người, nên khung camera tính cả đồ vật.
 * - `air`: vẽ trong hệ thế giới, không chiếm vị trí; tối đa một mỗi shot.
 */
export type PropAsset =
  | { placement: "floor"; halfWidth: number; height: number; Component: FC<PropProps> }
  | { placement: "air"; Component: FC<AirPropProps> };
