import type { ReactNode } from "react";
import type { FaceStyle } from "./face.js";
import type { LimbAngles } from "./pose.js";

export type Pt = { x: number; y: number };

/**
 * Vùng "đầu" trong hệ tọa độ của đầu (gốc là điểm neo đầu, chưa nghiêng).
 * Dùng để kiểm bàn tay giơ lên không nằm trên đầu (P6-03: tay vẫy của Tí trông như gãi đầu).
 */
export type HeadZone =
  | { kind: "circle"; r: number }
  | { kind: "rect"; halfWidth: number; halfHeight: number };

/**
 * Lớp da của một nhân vật trên rig dùng chung. Tọa độ gốc ở giữa hai bàn chân, trục y hướng xuống,
 * nhân vật đứng phía trên gốc (y âm).
 */
export type SkinSpec = {
  /** `character_key` của nhân vật trong kênh (`brand_characters`). */
  characterKey: string;
  /** Chiều cao từ chân tới đỉnh đầu (px hệ hình), để camera cỡ trung căn khung. */
  height: number;
  /** Nửa bề ngang của thân và đầu, không tính tay (px hệ hình); dùng để kiểm hai nhân vật không chồng nhau. */
  bodyHalfWidth: number;
  hip: Pt;
  neck: Pt;
  /** Điểm neo đầu: tâm mặt. Đầu xoay quanh `neck` theo `tilt` nếu `headFollowsTilt`. */
  headAnchor: Pt;
  headFollowsTilt: boolean;
  headZone: HeadZone;
  shoulderA: Pt;
  shoulderB: Pt;
  armLen: LimbAngles;
  legA: Pt;
  legB: Pt;
  legLen: LimbAngles;
  limbWidth: number;
  limbColor: string;
  handRadius: number;
  faceStyle: FaceStyle;
  /** Thân (và phần gắn với thân), vẽ trong hệ tọa độ thân trước khi nghiêng. */
  torso: () => ReactNode;
  /** Đầu quanh điểm neo; `face` là khuôn mặt đã dựng. */
  head: (face: ReactNode) => ReactNode;
  hand: (p: Pt, side: -1 | 1) => ReactNode;
  foot: (p: Pt, side: -1 | 1) => ReactNode;
};
