import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";

const ink = PALETTE.ink;
const CY = -100;
const RAYS = 12;

/** Mặt trời tròn vàng cam: tia nắng trắng xoay chậm, quầng sáng phập phồng, mặt cười chớp mắt. */
const SunRound: FC<PropProps> = ({ frame, seed }) => {
  const pulseRaw = 0.5 + 0.5 * Math.sin((frame / 48) * Math.PI * 2);
  const pulse = easing.inOut(pulseRaw);
  const spin = (frame * 0.35 + seed * 13) % 360;
  const breathe = 1 + 0.025 * Math.sin((frame / 48) * Math.PI * 2 + 0.6);
  const sway = 2 * wobble(frame, seed + 3, 90);
  const cycle = (frame + seed * 7) % 96;
  const blink = cycle < 5 ? 0.15 : 1;
  const gid = `mk-gen-sun-body-${seed}`;
  const hid = `mk-gen-sun-halo-${seed}`;

  const rays = [];
  for (let i = 0; i < RAYS; i++) {
    const long = i % 2 === 0;
    const phase = Math.sin((frame / 30) * Math.PI * 2 + i * 0.9);
    const r1 = 56;
    const len = (long ? 24 : 15) + (long ? 2.5 : 2) * phase;
    const w = long ? 13 : 10;
    rays.push(
      <rect
        key={i}
        x={-w / 2}
        y={-(r1 + len)}
        width={w}
        height={len}
        rx={w / 2}
        fill={PALETTE.paper}
        stroke={ink}
        strokeWidth={4}
        transform={`rotate(${(i * 360) / RAYS})`}
      />,
    );
  }

  return (
    <g>
      <defs>
        <radialGradient id={gid} cx="38%" cy="34%" r="70%">
          <stop offset="0%" stopColor="#FFE27A" />
          <stop offset="55%" stopColor="#FFB627" />
          <stop offset="100%" stopColor="#F28C28" />
        </radialGradient>
        <radialGradient id={hid} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFE9A0" stopOpacity={0.9} />
          <stop offset="100%" stopColor="#FFD54A" stopOpacity={0} />
        </radialGradient>
      </defs>
      <g transform={`translate(${sway.toFixed(2)} ${CY})`}>
        {/* quầng sáng phập phồng */}
        <circle cx={0} cy={0} r={72 + 12 * pulse} fill={`url(#${hid})`} opacity={0.55 + 0.35 * pulse} />
        <circle cx={0} cy={0} r={60 + 5 * pulse} fill="#FFD54A" opacity={0.22 + 0.15 * pulse} />
        {/* tia nắng xoay chậm */}
        <g transform={`rotate(${spin.toFixed(2)})`}>{rays}</g>
        {/* thân mặt trời */}
        <g transform={`scale(${breathe.toFixed(4)} ${(2 - breathe).toFixed(4)})`}>
          <circle cx={0} cy={0} r={48} fill={`url(#${gid})`} stroke={ink} strokeWidth={6} />
          {/* bóng tối phía phải dưới */}
          <path
            d="M 40 -20 A 44 44 0 0 1 -20 40 A 50 50 0 0 0 40 -20 Z"
            fill="#E0731F"
            opacity={0.35}
          />
          {/* vệt sáng phía trái trên */}
          <path
            d="M -34 -12 A 36 36 0 0 1 -10 -36"
            fill="none"
            stroke={PALETTE.paper}
            strokeWidth={7}
            strokeLinecap="round"
            opacity={0.75}
          />
          <circle cx={-6} cy={-38} r={3.5} fill={PALETTE.paper} opacity={0.8} />
          {/* mắt */}
          <ellipse cx={-15} cy={-6} rx={5} ry={7 * blink} fill={ink} />
          <ellipse cx={15} cy={-6} rx={5} ry={7 * blink} fill={ink} />
          <circle cx={-13} cy={-9} r={1.8} fill={PALETTE.paper} opacity={blink > 0.5 ? 1 : 0} />
          <circle cx={17} cy={-9} r={1.8} fill={PALETTE.paper} opacity={blink > 0.5 ? 1 : 0} />
          {/* má hồng */}
          <ellipse cx={-26} cy={8} rx={7} ry={4.5} fill="#FF7A6B" opacity={0.55} />
          <ellipse cx={26} cy={8} rx={7} ry={4.5} fill="#FF7A6B" opacity={0.55} />
          {/* miệng cười */}
          <path
            d="M -12 10 Q 0 22 12 10"
            fill="none"
            stroke={ink}
            strokeWidth={4.5}
            strokeLinecap="round"
          />
        </g>
        {/* lấp lánh */}
        <g opacity={0.4 + 0.6 * pulse} transform={`translate(-62 -58) scale(${(0.7 + 0.4 * pulse).toFixed(3)})`}>
          <path d="M 0 -8 L 2 -2 L 8 0 L 2 2 L 0 8 L -2 2 L -8 0 L -2 -2 Z" fill={PALETTE.paper} />
        </g>
        <g opacity={1 - 0.6 * pulse} transform={`translate(64 54) scale(${(1.1 - 0.4 * pulse).toFixed(3)})`}>
          <path d="M 0 -7 L 2 -2 L 7 0 L 2 2 L 0 7 L -2 2 L -7 0 L -2 -2 Z" fill="#FFE27A" />
        </g>
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 196,
  Component: SunRound,
};
