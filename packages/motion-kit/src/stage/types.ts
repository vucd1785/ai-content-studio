import type { FC } from "react";

export type SlotName = "left" | "center" | "right";
export type ShotSize = "wide" | "medium" | "close" | "high";
export type AmbienceKind = "vignette" | "dust" | "foreground_blur";

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

export type BackgroundAsset = {
  stage: StageLayout;
  Component: FC<BackgroundProps>;
};

/** Chuyển động máy trong một shot: `t` chạy 0..1 từ đầu đến cuối shot. */
export type CameraMove = (t: number) => { zoom: number; dx: number; dy: number };
