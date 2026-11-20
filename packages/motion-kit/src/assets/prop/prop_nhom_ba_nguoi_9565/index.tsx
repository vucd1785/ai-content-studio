import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const glowBlue = "#4FB3FF";
const deepBlue = "#1E5FA8";

type CoderProps = { frame: number; seed: number; i: number; x: number };

const Coder: FC<CoderProps> = ({ frame, seed, i, x }) => {
  const nod = 2 * wobble(frame, seed + i * 13, 64);
  const glow = 0.6 + 0.4 * wobble(frame, seed + i * 5 + 3, 26);
  const tapA = Math.abs(Math.sin(frame * 0.55 + i * 1.3)) * 3.5;
  const tapB = Math.abs(Math.sin(frame * 0.55 + i * 1.3 + 1.6)) * 3.5;
  const phase = ((frame + i * 21) % 60) / 60;
  const riseY = -84 - easing.out(phase) * 30;
  const dotOp = Math.sin(phase * Math.PI);
  const breathe = 1 + 0.015 * wobble(frame, seed + i * 9, 50);
  return (
    <g transform={`translate(${x} 0)`}>
      {/* rising code sparkles */}
      <rect x={14} y={riseY} width={6} height={6} rx={2} fill={glowBlue} opacity={dotOp} />
      <circle cx={26} cy={riseY + 10} r={2.5} fill={PALETTE.bitLight} opacity={dotOp * 0.8} />
      <g transform={`scale(1 ${breathe.toFixed(4)})`}>
        {/* legs */}
        <path d="M0 -10 L24 -15 L30 -2" fill="none" stroke={ink} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
        {/* torso */}
        <line x1={-3} y1={-10} x2={-1} y2={-50} stroke={ink} strokeWidth={7} strokeLinecap="round" />
        {/* back arm */}
        <path d={`M-1 -44 L8 -30 L${22} ${-25 - tapB}`} fill="none" stroke={ink} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
        {/* laptop glow */}
        <ellipse cx={18} cy={-36} rx={24} ry={18} fill={glowBlue} opacity={0.22 * glow} />
        {/* laptop base */}
        <rect x={6} y={-24} width={32} height={7} rx={3} fill={PALETTE.metal} stroke={ink} strokeWidth={4} transform="rotate(-6 22 -20)" />
        {/* laptop screen */}
        <path d="M36 -23 L30 -50 L18 -48 L24 -21 Z" fill={`url(#mk-gen-screen-${i})`} stroke={ink} strokeWidth={4} strokeLinejoin="round" />
        <path d="M22 -45 L28 -46" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" opacity={0.6 * glow} />
        <path d="M23 -39 L29 -40" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" opacity={0.4 * glow} />
        {/* head */}
        <g transform={`rotate(${nod.toFixed(2)} 0 -52)`}>
          <circle cx={2} cy={-65} r={13} fill={PALETTE.paper} stroke={ink} strokeWidth={5} />
          <circle cx={-2} cy={-70} r={4} fill="#FFFFFF" opacity={0.7} />
          <path d="M8 -66 A13 13 0 0 1 2 -52" fill="none" stroke={glowBlue} strokeWidth={3} opacity={0.6 * glow} />
          <circle cx={9} cy={-66} r={2.2} fill={ink} />
        </g>
        {/* front arm typing */}
        <path d={`M-1 -44 L10 -31 L${20} ${-24 - tapA}`} fill="none" stroke={ink} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </g>
  );
};

/** Nhóm ba lập trình viên người que ngồi cạnh nhau, ôm laptop màn hình xanh sáng, gõ phím đều tay. */
const CoderTeam: FC<PropProps> = ({ frame, seed }) => {
  return (
    <g>
      <defs>
        {[0, 1, 2].map((i) => (
          <linearGradient key={i} id={`mk-gen-screen-${i}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#BFE6FF" />
            <stop offset="0.45" stopColor={glowBlue} />
            <stop offset="1" stopColor={deepBlue} />
          </linearGradient>
        ))}
      </defs>
      <ContactShadow halfWidth={86} />
      <Coder frame={frame} seed={seed} i={0} x={-62} />
      <Coder frame={frame} seed={seed} i={1} x={-10} />
      <Coder frame={frame} seed={seed} i={2} x={42} />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 88,
  height: 130,
  Component: CoderTeam,
};
