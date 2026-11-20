import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../../prop/prop_server/index.js";

const ink = PALETTE.ink;

const BANDS = ["#e53935", "#fb8c00", "#fdd835", "#43a047", "#1e88e5", "#3949ab", "#8e24aa"];

/** Bảng minh họa: tia nắng trắng đi vào lăng kính, tỏa thành bảy dải màu như chiếc quạt, nhấp nháy nhẹ. */
const RainbowFan: FC<PropProps> = ({ frame, seed }) => {
  const cy = -132;
  const px = -6;
  const beamGlow = 0.75 + 0.25 * wobble(frame, seed, 24);
  const right = 80;
  const top = -206;
  const bottom = -58;
  const step = (bottom - top) / BANDS.length;
  return (
    <g>
      <ContactShadow halfWidth={80} />
      <line x1={-50} y1={-50} x2={-64} y2={-4} stroke={ink} strokeWidth={7} strokeLinecap="round" />
      <line x1={50} y1={-50} x2={64} y2={-4} stroke={ink} strokeWidth={7} strokeLinecap="round" />
      <rect
        x={-84}
        y={-216}
        width={168}
        height={168}
        rx={12}
        fill="#1f2a44"
        stroke={ink}
        strokeWidth={6}
      />
      {BANDS.map((c, i) => {
        const y1 = top + step * i;
        const y2 = y1 + step;
        const flick = 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(frame * 0.18 + i * 0.9 + seed));
        return (
          <polygon
            key={c}
            points={`${px},${cy + (i - 3.5) * 1.6} ${right},${y1.toFixed(2)} ${right},${y2.toFixed(2)} ${px},${cy + (i - 2.5) * 1.6}`}
            fill={c}
            opacity={flick}
          />
        );
      })}
      <polygon
        points={`-80,${cy - 6} ${px},${cy - 4} ${px},${cy + 4} -80,${cy + 6}`}
        fill="#ffffff"
        opacity={beamGlow}
      />
      <polygon
        points={`-80,${cy - 11} ${px},${cy - 7} ${px},${cy + 7} -80,${cy + 11}`}
        fill="#fff9c4"
        opacity={0.3 * beamGlow}
      />
      <polygon
        points={`${px},${cy - 26} ${px - 20},${cy + 18} ${px + 20},${cy + 18}`}
        fill="#e3f2fd"
        opacity={0.85}
        stroke={ink}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <line
        x1={px - 6}
        y1={cy - 10}
        x2={px - 12}
        y2={cy + 6}
        stroke="#ffffff"
        strokeWidth={4}
        strokeLinecap="round"
      />
      <rect
        x={-84}
        y={-216}
        width={168}
        height={168}
        rx={12}
        fill="none"
        stroke={ink}
        strokeWidth={6}
      />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 222,
  Component: RainbowFan,
};
