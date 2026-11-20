import type { FC, ReactNode } from "react";
import { rnd } from "../rig/math.js";
import type { AmbienceKind } from "./types.js";

/**
 * Yếu tố mức 3, bật theo `ambience` của shot (P6-03: đắt, chỉ dùng cho cảnh cần không khí).
 * `back` (bụi) vẽ sau bối cảnh, trước nhân vật; `front` (tiền cảnh mờ) vẽ trước nhân vật; cả hai đi theo camera.
 * `screen` (tấm che tối) phủ khung sau camera.
 */

const Dust: FC<{ frame: number }> = ({ frame }) => {
  const dots: ReactNode[] = [];
  for (let i = 0; i < 30; i++) {
    const bx = 560 + rnd(3, i) * 360;
    const by = 900 + rnd(7, i) * 600;
    const drift = (frame * (0.15 + rnd(11, i) * 0.3)) % 120;
    dots.push(
      <circle
        key={`d${i}`}
        cx={(bx + Math.sin((frame + i * 13) / 25) * 12).toFixed(1)}
        cy={(by - drift).toFixed(1)}
        r={(1.5 + rnd(5, i) * 2.5).toFixed(2)}
        fill="#fff6d8"
        opacity={(0.35 + rnd(9, i) * 0.4).toFixed(2)}
      />,
    );
  }
  return <g>{dots}</g>;
};

const ForegroundBlur: FC = () => (
  <g>
    <defs>
      <filter id="mk-amb-blur" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="9" />
      </filter>
    </defs>
    <g filter="url(#mk-amb-blur)">
      <ellipse cx={60} cy={1780} rx={120} ry={230} fill="#3f6f35" transform="rotate(18 60 1780)" />
      <ellipse
        cx={150}
        cy={1840}
        rx={90}
        ry={200}
        fill="#4d8240"
        transform="rotate(-10 150 1840)"
      />
    </g>
  </g>
);

const Vignette: FC<{ width: number; height: number }> = ({ width, height }) => (
  <g>
    <defs>
      <radialGradient id="mk-amb-veil" cx="0.5" cy="0.55" r="0.75">
        <stop offset="0.45" stopColor="#120c08" stopOpacity="0" />
        <stop offset="1" stopColor="#120c08" stopOpacity="0.62" />
      </radialGradient>
    </defs>
    <rect x={0} y={0} width={width} height={height} fill="url(#mk-amb-veil)" />
  </g>
);

export const Ambience: FC<{
  kinds: readonly AmbienceKind[];
  layer: "back" | "front" | "screen";
  frame: number;
  /** Khung hình của lớp `screen`; mặc định khung dọc. */
  frameSize?: { width: number; height: number };
}> = ({ kinds, layer, frame, frameSize = { width: 1080, height: 1920 } }) => {
  if (layer === "screen") {
    return kinds.includes("vignette") ? (
      <Vignette width={frameSize.width} height={frameSize.height} />
    ) : null;
  }
  if (layer === "back") {
    return kinds.includes("dust") ? <Dust frame={frame} /> : null;
  }
  return kinds.includes("foreground_blur") ? <ForegroundBlur /> : null;
};
