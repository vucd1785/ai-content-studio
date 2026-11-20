import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../../prop/prop_server/index.js";

const ink = PALETTE.ink;

const BANDS = ["#e5484d", "#f38b2c", "#f5d04a", "#4cb860", "#3d7fd9", "#8a4fc9"];

/** Lăng kính tam giác trên bàn nhỏ: tia nắng trắng đi vào, tách thành dải cầu vồng nhấp nháy. */
const PrismTable: FC<PropProps> = ({ frame, seed }) => {
  const beamPulse = 0.75 + 0.25 * wobble(frame, seed, 30);
  const sx = 16;
  const sy = -124;
  const ex = 86;
  const top = -152;
  const step = 9;
  const shine = 0.35 + 0.25 * wobble(frame, seed + 3, 45);
  return (
    <g>
      <ContactShadow halfWidth={70} />
      {/* bàn nhỏ */}
      <line x1={-48} y1={-86} x2={-52} y2={-2} stroke={ink} strokeWidth={7} strokeLinecap="round" />
      <line x1={48} y1={-86} x2={52} y2={-2} stroke={ink} strokeWidth={7} strokeLinecap="round" />
      <line
        x1={-48}
        y1={-86}
        x2={-52}
        y2={-2}
        stroke={PALETTE.metalDark}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <line
        x1={48}
        y1={-86}
        x2={52}
        y2={-2}
        stroke={PALETTE.metalDark}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <line x1={-48} y1={-50} x2={48} y2={-50} stroke={ink} strokeWidth={5} strokeLinecap="round" />
      <rect
        x={-62}
        y={-98}
        width={124}
        height={14}
        rx={6}
        fill="#c98a52"
        stroke={ink}
        strokeWidth={6}
      />

      {/* dải cầu vồng */}
      {BANDS.map((c, i) => {
        const y1 = top + i * step;
        const y2 = y1 + step;
        const o = 0.7 + 0.3 * wobble(frame, seed + 11 + i * 5, 18 + i * 3);
        return (
          <polygon key={c} points={`${sx},${sy} ${ex},${y1} ${ex},${y2}`} fill={c} opacity={o} />
        );
      })}
      <polygon
        points={`${sx},${sy} ${ex},${top} ${ex},${top + step * 6}`}
        fill="none"
        stroke={ink}
        strokeWidth={3}
        strokeLinejoin="round"
        opacity={0.5}
      />

      {/* tia nắng trắng */}
      <line
        x1={-88}
        y1={-166}
        x2={-18}
        y2={-124}
        stroke="#fff6c8"
        strokeWidth={14}
        strokeLinecap="round"
        opacity={0.35 * beamPulse}
      />
      <line
        x1={-88}
        y1={-166}
        x2={-18}
        y2={-124}
        stroke="#ffffff"
        strokeWidth={6}
        strokeLinecap="round"
        opacity={beamPulse}
      />

      {/* lăng kính */}
      <polygon points="-34,-98 34,-98 0,-160" fill="#cfeefa" opacity={0.6} />
      <line
        x1={-18}
        y1={-124}
        x2={sx}
        y2={sy}
        stroke="#ffffff"
        strokeWidth={4}
        opacity={0.8 * beamPulse}
      />
      <polygon points="-8,-140 -2,-150 -22,-108 -26,-108" fill="#ffffff" opacity={shine} />
      <polygon
        points="-34,-98 34,-98 0,-160"
        fill="none"
        stroke={ink}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <circle cx={-18} cy={-124} r={4} fill="#ffffff" opacity={beamPulse} />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 172,
  Component: PrismTable,
};
