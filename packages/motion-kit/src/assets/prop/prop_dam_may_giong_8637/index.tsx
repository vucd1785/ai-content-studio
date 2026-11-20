import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { clamp, easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";

const ink = PALETTE.ink;
const CLOUD_BASE = "#5d6475";
const CLOUD_LIGHT = "#8b93a8";
const CLOUD_DARK = "#3b4150";
const BOLT = "#ffd84a";
const BOLT_CORE = "#fff6c2";

type Puff = { cx: number; cy: number; r: number };

const PUFFS: Puff[] = [
  { cx: -50, cy: -198, r: 32 },
  { cx: -16, cy: -228, r: 42 },
  { cx: 28, cy: -220, r: 36 },
  { cx: 54, cy: -190, r: 26 },
];

const flashAt = (p: number, start: number, len: number): number => {
  const k = (p - start) / len;
  if (k < 0 || k > 1) return 0;
  return 1 - easing.out(k);
};

/** Đám mây giông xám đen lơ lửng, tia chớp vàng zigzag nhấp nháy bên trong. */
const DamMayGiong: FC<PropProps> = ({ frame, seed }) => {
  const bob = 3 * wobble(frame, seed, 90);
  const sway = 1.2 * wobble(frame, seed + 3, 140);
  const p = frame % 72;
  const flash = clamp(Math.max(flashAt(p, 0, 9), 0.8 * flashAt(p, 12, 10)), 0, 1);
  const breathe = 1 + 0.015 * Math.sin((frame / 60) * Math.PI * 2) + 0.02 * flash;
  const boltOpacity = clamp(flash * 1.4, 0, 1);

  const body = (strokeProps: { stroke?: string; strokeWidth?: number; fill: string }) => (
    <g>
      {PUFFS.map((pf, i) => (
        <circle key={i} cx={pf.cx} cy={pf.cy} r={pf.r} {...strokeProps} />
      ))}
      <rect x={-76} y={-206} width={152} height={44} rx={22} {...strokeProps} />
    </g>
  );

  return (
    <g
      transform={`translate(0 ${bob.toFixed(2)}) rotate(${sway.toFixed(2)} 0 -200) translate(0 -200) scale(${breathe.toFixed(3)}) translate(0 200)`}
    >
      <defs>
        <linearGradient id="mk-gen-storm-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={CLOUD_LIGHT} />
          <stop offset="55%" stopColor={CLOUD_BASE} />
          <stop offset="100%" stopColor={CLOUD_DARK} />
        </linearGradient>
        <radialGradient id="mk-gen-storm-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={BOLT_CORE} stopOpacity={0.9} />
          <stop offset="60%" stopColor={BOLT} stopOpacity={0.35} />
          <stop offset="100%" stopColor={BOLT} stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* outline pass */}
      {body({ fill: ink, stroke: ink, strokeWidth: 12 })}
      {/* fill pass */}
      {body({ fill: "url(#mk-gen-storm-body)" })}

      {/* underside shade */}
      <rect x={-70} y={-180} width={140} height={14} rx={7} fill={CLOUD_DARK} opacity={0.6} />
      {/* top-left highlights */}
      <circle cx={-28} cy={-244} r={18} fill="#ffffff" opacity={0.18} />
      <circle cx={-58} cy={-208} r={12} fill="#ffffff" opacity={0.15} />
      <ellipse cx={18} cy={-238} rx={12} ry={7} fill="#ffffff" opacity={0.12} />
      {/* right-side shade */}
      <circle cx={50} cy={-186} r={16} fill={CLOUD_DARK} opacity={0.35} />

      {/* inner glow */}
      <ellipse cx={2} cy={-196} rx={78} ry={56} fill="url(#mk-gen-storm-glow)" opacity={flash} />

      {/* lightning bolt */}
      <g opacity={boltOpacity}>
        <polygon
          points="-10,-214 18,-214 5,-190 22,-190 -12,-140 -1,-178 -17,-178"
          fill={BOLT}
          stroke={ink}
          strokeWidth={5}
          strokeLinejoin="round"
        />
        <polygon points="-4,-208 9,-208 0,-188 -2,-182 -9,-182" fill={BOLT_CORE} opacity={0.8} />
      </g>

      {/* sparkles around flash */}
      <g opacity={flash}>
        <circle cx={-36} cy={-176} r={4} fill={PALETTE.warn} />
        <circle cx={38} cy={-200} r={3.5} fill={BOLT_CORE} />
        <circle cx={-22} cy={-150} r={3} fill={BOLT} />
        <circle cx={30} cy={-158} r={2.5} fill={BOLT_CORE} />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 290,
  Component: DamMayGiong,
};
