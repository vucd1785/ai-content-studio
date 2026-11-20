import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";

const ink = PALETTE.ink;

const BANDS = ["#E8453C", "#F28C28", "#F7D23E", "#5DBB4A", "#3E9BE0", "#3F4FB0", "#8A4FC2"];
const BAND_W = 9;
const OUT_RX = 84;
const OUT_RY = 160;

const arc = (rx: number, ry: number): string =>
  `M ${(-rx).toFixed(2)} 0 A ${rx.toFixed(2)} ${ry.toFixed(2)} 0 0 1 ${rx.toFixed(2)} 0`;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number): number => v * v * (3 - 2 * v);

/** Cầu vồng bảy màu: hiện dần từ trái sang phải rồi lung linh nhẹ. */
const RainbowArc: FC<PropProps> = ({ frame, seed }) => {
  const reveal = smooth(clamp01(frame / 45));
  const off = (1 - reveal).toFixed(4);
  const total = BANDS.length * BAND_W;
  const midRx = OUT_RX - total / 2;
  const midRy = OUT_RY - total / 2;
  const innerRx = OUT_RX - total;
  const breathe = 1 + 0.01 * wobble(frame, seed, 90);
  const sweep = (frame % 120) / 120;
  const sparkle = reveal >= 1 ? 0.55 : 0;
  return (
    <g transform={`scale(${breathe.toFixed(4)})`}>
      <path
        d={arc(midRx, midRy)}
        fill="none"
        stroke={ink}
        strokeWidth={total + 12}
        pathLength={1}
        strokeDasharray="1 1"
        strokeDashoffset={off}
      />
      {BANDS.map((c, i) => {
        const r = OUT_RX - BAND_W / 2 - i * BAND_W;
        const ry = OUT_RY - BAND_W / 2 - i * BAND_W;
        const op = 0.86 + 0.14 * Math.sin(frame * 0.12 - i * 0.7 + seed);
        return (
          <path
            key={c}
            d={arc(r, ry)}
            fill="none"
            stroke={c}
            strokeWidth={BAND_W + 0.6}
            opacity={op}
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={off}
          />
        );
      })}
      <path
        d={arc(OUT_RX - 6, OUT_RY - 6)}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={3}
        strokeLinecap="round"
        opacity={sparkle}
        pathLength={1}
        strokeDasharray="0.08 1"
        strokeDashoffset={(-sweep * 1.1 + 0.05).toFixed(4)}
      />
      {reveal > 0 ? (
        <line
          x1={-OUT_RX - 6}
          y1={0}
          x2={-innerRx + 6}
          y2={0}
          stroke={ink}
          strokeWidth={6}
          strokeLinecap="round"
        />
      ) : null}
      {reveal >= 1 ? (
        <line
          x1={innerRx - 6}
          y1={0}
          x2={OUT_RX + 6}
          y2={0}
          stroke={ink}
          strokeWidth={6}
          strokeLinecap="round"
        />
      ) : null}
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 170,
  Component: RainbowArc,
};
