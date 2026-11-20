import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { clamp, easing, rnd, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const GREEN = "#3ddc84";
const GREEN_LIGHT = "#b4ffd2";
const GREEN_DARK = "#1c9a56";
const SPARK = "#ffe14d";

/** Cột năng lượng: vạch xanh dâng mãi lên, trào qua đỉnh, tia điện nhấp nháy. */
const EnergyColumn: FC<PropProps> = ({ frame, seed }) => {
  const clipId = `mk-gen-cot-clip-${seed}`;
  const gradId = `mk-gen-cot-grad-${seed}`;
  const glassId = `mk-gen-cot-glass-${seed}`;
  const pulse = 0.5 + 0.5 * wobble(frame, seed, 36);
  const surge = 0.5 + 0.5 * wobble(frame, seed + 3, 50);
  const bulge = 4 + 6 * easing.inOut(surge);

  const stripes = [];
  for (let i = 0; i < 10; i++) {
    const yy = -30 - ((i * 24 + frame * 1.8) % 240);
    const fade = clamp((-yy - 30) / 40, 0, 1);
    stripes.push(
      <rect
        key={`s${i}`}
        x={-30}
        y={yy}
        width={60}
        height={9}
        rx={3}
        fill={GREEN_LIGHT}
        opacity={0.75 * fade}
      />,
    );
  }

  const drips = [0, 1].map((k) => {
    const period = 64;
    const p = ((frame + k * 32 + seed * 7) % period) / period;
    const e = easing.in(p);
    const y = -266 + e * 190;
    const side = k === 0 ? -1 : 1;
    const x = side * 37;
    return (
      <g key={`d${k}`} opacity={1 - p * 0.8}>
        <path
          d={`M ${x} ${y - 14} Q ${x + 6} ${y} ${x} ${y + 6} Q ${x - 6} ${y} ${x} ${y - 14} Z`}
          fill={GREEN}
          stroke={ink}
          strokeWidth={3}
          strokeLinejoin="round"
        />
        <circle cx={x - 1.5} cy={y - 1} r={1.6} fill={GREEN_LIGHT} />
      </g>
    );
  });

  const flickIdx = Math.floor(frame / 4);
  const sparkOn = rnd(seed, flickIdx) > 0.4;
  const sparkSide = rnd(seed + 11, flickIdx) > 0.5 ? 1 : -1;
  const sy = -150 - rnd(seed + 5, flickIdx) * 100;
  const sx = sparkSide * 38;
  const sparkPts = `${sx},${sy} ${sx + sparkSide * 10},${sy - 10} ${sx + sparkSide * 6},${sy - 14} ${sx + sparkSide * 20},${sy - 26} ${sx + sparkSide * 14},${sy - 30} ${sx + sparkSide * 28},${sy - 42}`;
  const spark2On = rnd(seed + 21, flickIdx) > 0.6;
  const s2x = -sparkSide * 30;

  return (
    <g>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={GREEN_LIGHT} />
          <stop offset="0.45" stopColor={GREEN} />
          <stop offset="1" stopColor={GREEN_DARK} />
        </linearGradient>
        <linearGradient id={glassId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity={0.35} />
          <stop offset="1" stopColor="#ffffff" stopOpacity={0.05} />
        </linearGradient>
        <clipPath id={clipId}>
          <rect x={-30} y={-262} width={60} height={224} rx={10} />
        </clipPath>
      </defs>
      <ContactShadow halfWidth={62} />

      {/* glow behind */}
      <rect x={-48} y={-280} width={96} height={250} rx={40} fill={GREEN} opacity={0.12 + 0.12 * pulse} />

      {/* base */}
      <rect x={-56} y={-46} width={112} height={44} rx={12} fill={PALETTE.metal} stroke={ink} strokeWidth={6} />
      <rect x={-48} y={-40} width={50} height={8} rx={4} fill="#ffffff" opacity={0.35} />
      <rect x={-50} y={-16} width={100} height={10} rx={5} fill={PALETTE.metalDark} opacity={0.5} />
      <circle cx={-32} cy={-24} r={5} fill={PALETTE.ok} stroke={ink} strokeWidth={2.5} opacity={0.5 + 0.5 * pulse} />
      <circle cx={-16} cy={-24} r={5} fill={SPARK} stroke={ink} strokeWidth={2.5} />
      <circle cx={36} cy={-26} r={4} fill={PALETTE.metalDark} stroke={ink} strokeWidth={2} />

      {/* tube liquid */}
      <g clipPath={`url(#${clipId})`}>
        <rect x={-30} y={-262} width={60} height={224} fill={`url(#${gradId})`} />
        {stripes}
        <rect x={10} y={-262} width={20} height={224} fill={GREEN_DARK} opacity={0.3} />
        <circle cx={-8} cy={-60 - ((frame * 2.4) % 190)} r={4} fill="#ffffff" opacity={0.6} />
        <circle cx={10} cy={-60 - ((frame * 2 + 90) % 190)} r={3} fill="#ffffff" opacity={0.5} />
      </g>

      {/* glass */}
      <rect x={-30} y={-262} width={60} height={224} rx={10} fill={`url(#${glassId})`} stroke={ink} strokeWidth={6} />
      <rect x={-23} y={-250} width={6} height={180} rx={3} fill="#ffffff" opacity={0.55} />

      {/* metal bands */}
      <rect x={-36} y={-118} width={72} height={10} rx={4} fill={PALETTE.metal} stroke={ink} strokeWidth={4} />
      <rect x={-36} y={-196} width={72} height={10} rx={4} fill={PALETTE.metal} stroke={ink} strokeWidth={4} />

      {/* top cap */}
      <rect x={-40} y={-272} width={80} height={16} rx={6} fill={PALETTE.metalDark} stroke={ink} strokeWidth={5} />

      {/* overflow */}
      <path
        d={`M -38 -268 Q -30 ${-272 - bulge * 2.4} 0 ${-274 - bulge * 2} Q 30 ${-272 - bulge * 2.4} 38 -268 Q 0 -262 -38 -268 Z`}
        fill={GREEN}
        stroke={ink}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <ellipse cx={-10} cy={-272 - bulge} rx={10} ry={3} fill={GREEN_LIGHT} opacity={0.8} />
      {drips}

      {/* sparks */}
      {sparkOn ? (
        <g>
          <polyline points={sparkPts} fill="none" stroke={ink} strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={sparkPts} fill="none" stroke={SPARK} strokeWidth={3.5} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={sx + sparkSide * 28} cy={sy - 42} r={4} fill="#ffffff" />
        </g>
      ) : null}
      {spark2On ? (
        <g transform={`translate(${s2x} -288)`}>
          <path d="M 0 -8 L 2 -2 L 8 0 L 2 2 L 0 8 L -2 2 L -8 0 L -2 -2 Z" fill={SPARK} stroke={ink} strokeWidth={2} />
        </g>
      ) : null}
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 70,
  height: 300,
  Component: EnergyColumn,
};
