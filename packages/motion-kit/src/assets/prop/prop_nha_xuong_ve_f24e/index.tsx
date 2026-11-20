import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

const gearPoints = (rOut: number, rIn: number, n: number): string => {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a0 = (i / (n * 2)) * Math.PI * 2;
    const a1 = ((i + 1) / (n * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? rOut : rIn;
    pts.push(`${(Math.cos(a0) * r).toFixed(2)},${(Math.sin(a0) * r).toFixed(2)}`);
    pts.push(`${(Math.cos(a1 - 0.08) * r).toFixed(2)},${(Math.sin(a1 - 0.08) * r).toFixed(2)}`);
  }
  return pts.join(" ");
};

const GEAR = gearPoints(28, 21, 10);

/** Nhà xưởng mái răng cưa: bánh răng quay chậm, cánh tay máy lắp thân tên lửa trắng. */
const RocketFactory: FC<PropProps> = ({ frame, seed }) => {
  const gearRot = (frame * 0.8) % 360;
  const cycle = (frame % 90) / 90;
  const reach = cycle < 0.5 ? easing.inOut(cycle * 2) : easing.inOut(2 - cycle * 2);
  const a1 = 18 + 8 * reach;
  const a2 = -14 * reach + 3 * wobble(frame, seed, 30);
  const spark = Math.max(0, Math.sin(frame * 0.7)) * reach;
  const lamp = 0.5 + 0.5 * wobble(frame, seed + 3, 24);
  const noseDrop = -4 * (0.5 + 0.5 * wobble(frame, seed + 5, 80));
  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-fac-wall" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e8eef4" />
          <stop offset="1" stopColor={PALETTE.metal} />
        </linearGradient>
        <linearGradient id="mk-gen-fac-rocket" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.6" stopColor={PALETTE.paper} />
          <stop offset="1" stopColor="#c9d2dc" />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={88} />
      {/* sawtooth roof */}
      <path
        d="M-84 -180 L-84 -226 L-28 -180 L-28 -226 L28 -180 L28 -226 L84 -180 Z"
        fill={PALETTE.metalDark}
        stroke={ink}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <path d="M-80 -222 L-80 -186 L-72 -186 L-72 -215 Z" fill={PALETTE.screen} opacity={0.85} />
      <path d="M-24 -222 L-24 -186 L-16 -186 L-16 -215 Z" fill={PALETTE.screen} opacity={0.85} />
      <path d="M32 -222 L32 -186 L40 -186 L40 -215 Z" fill={PALETTE.screen} opacity={0.85} />
      {/* main wall */}
      <rect x={-84} y={-182} width={168} height={182} fill="url(#mk-gen-fac-wall)" stroke={ink} strokeWidth={6} />
      <rect x={60} y={-178} width={20} height={176} fill={PALETTE.metalDark} opacity={0.25} />
      <rect x={-80} y={-178} width={10} height={176} fill="#ffffff" opacity={0.4} />
      {/* bay interior */}
      <rect x={-14} y={-156} width={88} height={156} rx={4} fill={PALETTE.wallInk} stroke={ink} strokeWidth={5} />
      <rect x={-14} y={-156} width={88} height={14} fill={PALETTE.warn} stroke={ink} strokeWidth={4} />
      <path d="M-6 -156 L2 -142 M12 -156 L20 -142 M30 -156 L38 -142 M48 -156 L56 -142 M66 -156 L72 -146" stroke={ink} strokeWidth={4} />
      {/* rocket */}
      <path d="M34 -16 L22 -2 L34 -4 Z" fill={PALETTE.alert} stroke={ink} strokeWidth={4} strokeLinejoin="round" />
      <path d="M60 -16 L72 -2 L60 -4 Z" fill={PALETTE.alert} stroke={ink} strokeWidth={4} strokeLinejoin="round" />
      <rect x={33} y={-112} width={28} height={110} rx={4} fill="url(#mk-gen-fac-rocket)" stroke={ink} strokeWidth={5} />
      <rect x={33} y={-40} width={28} height={8} fill={PALETTE.ink} opacity={0.85} />
      <circle cx={47} cy={-84} r={7} fill={PALETTE.screen} stroke={ink} strokeWidth={3} />
      <circle cx={45} cy={-86} r={2.5} fill="#ffffff" />
      <g transform={`translate(0 ${noseDrop.toFixed(2)})`}>
        <path d="M33 -116 Q47 -150 61 -116 Z" fill="url(#mk-gen-fac-rocket)" stroke={ink} strokeWidth={5} strokeLinejoin="round" />
        <path d="M40 -122 Q44 -134 47 -138" stroke="#ffffff" strokeWidth={3} strokeLinecap="round" fill="none" />
      </g>
      {/* robot arm */}
      <rect x={-8} y={-12} width={24} height={12} rx={3} fill={PALETTE.metalDark} stroke={ink} strokeWidth={4} />
      <g transform={`translate(4 -12) rotate(${a1.toFixed(2)})`}>
        <rect x={-5} y={-54} width={10} height={56} rx={5} fill={PALETTE.warn} stroke={ink} strokeWidth={4} />
        <circle cx={0} cy={0} r={6} fill={PALETTE.metal} stroke={ink} strokeWidth={3} />
        <g transform={`translate(0 -52) rotate(${(70 - a1 + a2).toFixed(2)})`}>
          <rect x={-4} y={-4} width={26} height={9} rx={4} fill={PALETTE.warn} stroke={ink} strokeWidth={4} />
          <circle cx={0} cy={0} r={6} fill={PALETTE.metal} stroke={ink} strokeWidth={3} />
          <path d="M22 -6 L30 -8 M22 6 L30 8" stroke={ink} strokeWidth={4} strokeLinecap="round" />
          <circle cx={31} cy={0} r={6 + 6 * spark} fill={PALETTE.warn} opacity={0.6 * spark} />
          <circle cx={31} cy={0} r={2.5} fill="#ffffff" opacity={spark} />
        </g>
      </g>
      {/* gear */}
      <g transform={`translate(-50 -132) rotate(${gearRot.toFixed(2)})`}>
        <polygon points={GEAR} fill={PALETTE.accent} stroke={ink} strokeWidth={5} strokeLinejoin="round" />
        <circle cx={0} cy={0} r={13} fill="none" stroke={ink} strokeWidth={3} opacity={0.5} />
        <circle cx={0} cy={0} r={6} fill={PALETTE.metal} stroke={ink} strokeWidth={4} />
        <circle cx={-10} cy={-10} r={3} fill="#ffffff" opacity={0.6} />
      </g>
      {/* door */}
      <rect x={-72} y={-74} width={44} height={74} rx={3} fill={PALETTE.metal} stroke={ink} strokeWidth={5} />
      <path d="M-72 -56 L-28 -56 M-72 -38 L-28 -38 M-72 -20 L-28 -20" stroke={ink} strokeWidth={3} opacity={0.6} />
      {/* rivets */}
      <circle cx={-76} cy={-170} r={2.5} fill={ink} />
      <circle cx={76} cy={-170} r={2.5} fill={ink} />
      {/* warning lamp */}
      <circle cx={30} cy={-168} r={11} fill={PALETTE.alert} opacity={0.3 * lamp} />
      <circle cx={30} cy={-168} r={5} fill={PALETTE.alert} stroke={ink} strokeWidth={3} opacity={0.5 + 0.5 * lamp} />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 232,
  Component: RocketFactory,
};
