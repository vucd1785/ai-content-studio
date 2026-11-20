import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { clamp, easing, lerp, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const LOOP = 72;

const Chopstick: FC<{ angle: number; px: number; py: number }> = ({ angle, px, py }) => (
  <g transform={`translate(${px} ${py}) rotate(${angle.toFixed(2)})`}>
    <polygon
      points="10,-6 -112,-3 -112,3 10,6"
      fill="url(#mk-gen-dua-wood)"
      stroke={ink}
      strokeWidth={5}
      strokeLinejoin="round"
    />
    <rect x={-6} y={-6} width={16} height={12} rx={3} fill={PALETTE.woodDark} stroke={ink} strokeWidth={3} />
    <line x1={-14} y1={-2.5} x2={-100} y2={-1.2} stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" opacity={0.45} />
    <line x1={-24} y1={-6} x2={-24} y2={6} stroke={PALETTE.woodDark} strokeWidth={2} opacity={0.6} />
  </g>
);

/** Đôi đũa gỗ chụp hụt cây bút bi đang rơi, bút xoay nhẹ và có vệt chuyển động phía trên. */
const DoiDuaGo: FC<PropProps> = ({ frame, seed }) => {
  const p = (((frame % LOOP) + LOOP) % LOOP) / LOOP;
  const fall = easing.in(p);
  const penY = lerp(-236, -46, fall);
  const penAngle = 18 + 90 * easing.inOut(p);
  const penOpacity = clamp(p / 0.08, 0, 1) * clamp((1 - p) / 0.12, 0, 1);

  // chopsticks: open, snap shut (miss) after the pen passes, then reopen
  const snapIn = clamp((p - 0.7) / 0.08, 0, 1);
  const snapOut = clamp((p - 0.88) / 0.12, 0, 1);
  const closed = easing.outBack(1.8)(snapIn) * (1 - easing.inOut(snapOut));
  const open = lerp(13, 1.5, closed);
  const sway = 2 * wobble(frame, seed, 50);
  const pivotX = 66;
  const pivotY = -160 + 3 * wobble(frame, seed + 3, 40);

  const puff = snapIn > 0 && snapOut < 1 ? Math.sin(snapIn * Math.PI) : 0;
  const speed = 0.3 + 0.7 * fall;
  const tipX = -38;

  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-dua-wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F2C98A" />
          <stop offset="0.5" stopColor={PALETTE.wood} />
          <stop offset="1" stopColor={PALETTE.woodDark} />
        </linearGradient>
        <linearGradient id="mk-gen-dua-pen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7FB2FF" />
          <stop offset="0.45" stopColor="#3B7BE8" />
          <stop offset="1" stopColor="#2453A8" />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={44} />

      {/* motion streaks above the pen */}
      <g opacity={penOpacity * speed}>
        <line x1={-36} y1={penY - 46} x2={-36} y2={penY - 96} stroke={PALETTE.smoke} strokeWidth={5} strokeLinecap="round" />
        <line x1={-22} y1={penY - 52} x2={-22} y2={penY - 118} stroke={PALETTE.smoke} strokeWidth={6} strokeLinecap="round" />
        <line x1={-8} y1={penY - 44} x2={-8} y2={penY - 86} stroke={PALETTE.smoke} strokeWidth={4} strokeLinecap="round" />
      </g>

      {/* falling ballpoint pen */}
      <g opacity={penOpacity} transform={`translate(-22 ${penY.toFixed(2)}) rotate(${penAngle.toFixed(2)})`}>
        <polygon points="-6,26 6,26 1.5,40 -1.5,40" fill={PALETTE.metal} stroke={ink} strokeWidth={4} strokeLinejoin="round" />
        <circle cx={0} cy={41} r={2} fill={ink} />
        <rect x={-7} y={-34} width={14} height={62} rx={6} fill="url(#mk-gen-dua-pen)" stroke={ink} strokeWidth={5} />
        <rect x={-7} y={16} width={14} height={10} fill={PALETTE.metalDark} opacity={0.5} />
        <rect x={-8} y={-40} width={16} height={18} rx={6} fill="#2453A8" stroke={ink} strokeWidth={4} />
        <rect x={6} y={-38} width={5} height={26} rx={2.5} fill={PALETTE.metal} stroke={ink} strokeWidth={3} />
        <rect x={-4} y={-28} width={3} height={46} rx={1.5} fill="#FFFFFF" opacity={0.55} />
      </g>

      {/* miss puff at the tips */}
      <g opacity={puff} transform={`translate(${tipX} ${pivotY})`}>
        <circle cx={-14} cy={-14} r={4 + 4 * puff} fill={PALETTE.paper} stroke={ink} strokeWidth={3} />
        <circle cx={-18} cy={10} r={3 + 3 * puff} fill={PALETTE.paper} stroke={ink} strokeWidth={3} />
        <line x1={-24} y1={0} x2={-34} y2={0} stroke={PALETTE.warn} strokeWidth={4} strokeLinecap="round" />
      </g>

      {/* chopsticks */}
      <Chopstick angle={open + sway} px={pivotX} py={pivotY + 4} />
      <Chopstick angle={-open + sway} px={pivotX} py={pivotY - 4} />
      <circle cx={pivotX - 4} cy={pivotY} r={4} fill={PALETTE.woodDark} stroke={ink} strokeWidth={3} />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 82,
  height: 290,
  Component: DoiDuaGo,
};
