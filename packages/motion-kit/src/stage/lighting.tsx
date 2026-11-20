import type { FC } from "react";
import type { FrameSize } from "./framing.js";
import type { Mood, StageLayout } from "./types.js";

/**
 * Chiều sâu và ánh sáng của shot (ADR-023).
 * - Parallax: lớp xa trượt chậm hơn camera, tiền cảnh trượt nhanh hơn, nên khi máy lia hay đổi cỡ cảnh các lớp
 *   lệch nhau như có khoảng cách thật.
 * - Tông ánh sáng: phủ màu kiểu `multiply` lên bối cảnh (đậm) và lên nhân vật, đồ vật (nhạt, để còn nổi), cộng
 *   một quầng sáng kiểu `screen` và viền tối ở cảnh đêm, cảnh nguy hiểm.
 * Mọi thứ là hàm thuần của frame.
 */

/** Hệ số trượt theo camera: 0 là dính vào thế giới, dương là đi theo camera (xa), âm là đi ngược (gần). */
export const PARALLAX = { far: 0.3, near: -0.45 } as const;

/** Độ lệch (px thế giới) của một lớp so với lớp giữa khi camera nhìn vào (cx, cy). */
export function parallaxOffset(
  stage: StageLayout,
  view: { cx: number; cy: number },
  factor: number,
): { dx: number; dy: number } {
  const refX = (stage.bounds.x0 + stage.bounds.x1) / 2;
  // Mốc dọc là tâm khung cỡ rộng của khung dọc: ở đó các lớp nằm đúng chỗ đã vẽ.
  const refY = stage.groundY - 430;
  return { dx: (view.cx - refX) * factor, dy: (view.cy - refY) * factor };
}

export type MoodSpec = {
  /** Màu phủ từ đỉnh khung xuống đáy khung. */
  top: string;
  bottom: string;
  /** Độ đậm lớp phủ trên bối cảnh và trên nhân vật, đồ vật (0..1). */
  scene: number;
  actors: number;
  /** Lớp màu phủ thường (không `multiply`) trên bối cảnh: kéo sắc về màu của tông mà không làm tối, đục. */
  wash?: number;
  /** Quầng sáng: tâm theo tỷ lệ khung, bán kính theo tỷ lệ cạnh dài. */
  glow: { color: string; x: number; y: number; r: number; opacity: number };
  /** Viền tối quanh khung. */
  veil?: { color: string; opacity: number };
  /** Biên độ nhịp đập của quầng sáng (0 là đứng yên) và chu kỳ tính bằng frame. */
  pulse?: { amount: number; period: number };
};

export const MOODS: Record<Mood, MoodSpec> = {
  day: {
    top: "#fff7e0",
    bottom: "#ffffff",
    scene: 0.35,
    actors: 0,
    glow: { color: "#fff3c4", x: 0.16, y: 0.12, r: 0.75, opacity: 0.3 },
  },
  warm: {
    top: "#ffb066",
    bottom: "#ff8a5c",
    scene: 0.34,
    actors: 0.2,
    wash: 0.3,
    glow: { color: "#ffd27a", x: 0.18, y: 0.2, r: 0.8, opacity: 0.5 },
  },
  cool: {
    top: "#9fc0de",
    bottom: "#7896b8",
    scene: 0.62,
    actors: 0.24,
    glow: { color: "#e3f1ff", x: 0.5, y: 0.08, r: 0.7, opacity: 0.22 },
  },
  night: {
    top: "#1c2a6e",
    bottom: "#33438a",
    scene: 0.8,
    actors: 0.36,
    glow: { color: "#b9ceff", x: 0.8, y: 0.14, r: 0.55, opacity: 0.45 },
    veil: { color: "#050818", opacity: 0.5 },
  },
  danger: {
    top: "#c0281f",
    bottom: "#5e1016",
    scene: 0.72,
    actors: 0.3,
    glow: { color: "#ff5a3c", x: 0.5, y: 0.98, r: 0.85, opacity: 0.42 },
    veil: { color: "#1a0306", opacity: 0.55 },
    pulse: { amount: 0.25, period: 36 },
  },
  wonder: {
    top: "#7a68d8",
    bottom: "#2fa596",
    scene: 0.5,
    actors: 0.18,
    wash: 0.12,
    glow: { color: "#b8fff0", x: 0.5, y: 0.4, r: 0.65, opacity: 0.5 },
    pulse: { amount: 0.18, period: 60 },
  },
};

/** Lớp phủ màu trong hệ màn hình; `target` chọn độ đậm cho bối cảnh hay cho nhân vật, đồ vật. */
export const MoodGrade: FC<{ mood: Mood; target: "scene" | "actors"; frameSize: FrameSize }> = ({
  mood,
  target,
  frameSize,
}) => {
  const spec = MOODS[mood];
  const strength = spec[target];
  if (strength <= 0) {
    return null;
  }
  const id = `mk-mood-${mood}`;
  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={spec.top} />
          <stop offset="1" stopColor={spec.bottom} />
        </linearGradient>
      </defs>
      <rect
        x={-frameSize.width * 0.25}
        y={-frameSize.height * 0.25}
        width={frameSize.width * 1.5}
        height={frameSize.height * 1.5}
        fill={`url(#${id})`}
        opacity={strength}
        style={{ mixBlendMode: "multiply" }}
      />
      {target === "scene" && spec.wash !== undefined ? (
        <rect
          x={-frameSize.width * 0.25}
          y={-frameSize.height * 0.25}
          width={frameSize.width * 1.5}
          height={frameSize.height * 1.5}
          fill={`url(#${id})`}
          opacity={spec.wash}
        />
      ) : null}
    </g>
  );
};

/** Quầng sáng và viền tối của tông, vẽ trên cùng trong hệ màn hình. */
export const MoodLight: FC<{ mood: Mood; frame: number; frameSize: FrameSize }> = ({
  mood,
  frame,
  frameSize,
}) => {
  const spec = MOODS[mood];
  const { width, height } = frameSize;
  const long = Math.max(width, height);
  const beat =
    spec.pulse === undefined
      ? 1
      : 1 + spec.pulse.amount * Math.sin((frame / spec.pulse.period) * Math.PI * 2);
  const glowId = `mk-mood-${mood}-glow`;
  const veilId = `mk-mood-${mood}-veil`;
  return (
    <g>
      <defs>
        <radialGradient
          id={glowId}
          gradientUnits="userSpaceOnUse"
          cx={width * spec.glow.x}
          cy={height * spec.glow.y}
          r={long * spec.glow.r}
        >
          <stop offset="0" stopColor={spec.glow.color} stopOpacity="1" />
          <stop offset="0.35" stopColor={spec.glow.color} stopOpacity="0.45" />
          <stop offset="1" stopColor={spec.glow.color} stopOpacity="0" />
        </radialGradient>
        {spec.veil === undefined ? null : (
          <radialGradient id={veilId} cx="0.5" cy="0.5" r="0.75">
            <stop offset="0.4" stopColor={spec.veil.color} stopOpacity="0" />
            <stop offset="1" stopColor={spec.veil.color} stopOpacity={spec.veil.opacity} />
          </radialGradient>
        )}
      </defs>
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill={`url(#${glowId})`}
        opacity={(spec.glow.opacity * beat).toFixed(3)}
        style={{ mixBlendMode: "screen" }}
      />
      {spec.veil === undefined ? null : (
        <rect x={0} y={0} width={width} height={height} fill={`url(#${veilId})`} />
      )}
    </g>
  );
};
