import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

/** Bàn tay que xòe ra giữ thăng bằng cây bút chì vàng dựng đứng trên lòng bàn tay. */
const BalancingPencilHand: FC<PropProps> = ({ frame, seed }) => {
  const p = frame * 0.085;
  const tilt = 12 * Math.sin(p) + 3 * Math.sin(p * 2 + 1) + 1.5 * wobble(frame, seed, 50);
  const handX = 15 * Math.sin(p - 0.7);
  const palmY = -132;
  const squash = 1 + 0.04 * Math.sin(p * 2);
  const sparkle = 0.5 + 0.5 * Math.sin(frame * 0.2 + seed);
  const lineAlpha = Math.min(1, Math.abs(Math.cos(p)) * 0.9);
  const side = Math.cos(p) > 0 ? 1 : -1;
  const gid = `mk-gen-pencil-${seed}`;
  return (
    <g>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFE58A" />
          <stop offset="0.45" stopColor="#F7C948" />
          <stop offset="1" stopColor="#D99A1E" />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={50} />
      {/* tay áo */}
      <rect x={-22} y={-52} width={44} height={52} rx={12} fill={PALETTE.accent} stroke={ink} strokeWidth={6} />
      <rect x={-14} y={-46} width={10} height={38} rx={5} fill="#FFFFFF" opacity={0.3} />
      <rect x={8} y={-46} width={8} height={40} rx={4} fill={ink} opacity={0.15} />
      {/* cánh tay que */}
      <path
        d={`M 0 -52 Q ${(handX * 0.2 - 6).toFixed(2)} -90 ${handX.toFixed(2)} ${palmY + 12}`}
        fill="none"
        stroke={ink}
        strokeWidth={9}
        strokeLinecap="round"
      />
      <g transform={`translate(${handX.toFixed(2)} ${palmY}) scale(${(1 / squash).toFixed(3)} ${squash.toFixed(3)})`}>
        {/* ngón tay xòe */}
        <line x1={-14} y1={-2} x2={-30} y2={-14} stroke={ink} strokeWidth={7} strokeLinecap="round" />
        <line x1={-9} y1={-8} x2={-15} y2={-26} stroke={ink} strokeWidth={7} strokeLinecap="round" />
        <line x1={9} y1={-8} x2={15} y2={-26} stroke={ink} strokeWidth={7} strokeLinecap="round" />
        <line x1={14} y1={-3} x2={28} y2={-18} stroke={ink} strokeWidth={7} strokeLinecap="round" />
        {/* lòng bàn tay */}
        <ellipse cx={0} cy={0} rx={18} ry={11} fill={PALETTE.tiSkin} stroke={ink} strokeWidth={6} />
        <ellipse cx={-6} cy={-3} rx={7} ry={3} fill="#FFFFFF" opacity={0.45} />
        <ellipse cx={7} cy={4} rx={8} ry={4} fill={ink} opacity={0.12} />
      </g>
      {/* bút chì */}
      <g transform={`translate(${handX.toFixed(2)} ${palmY - 9}) rotate(${tilt.toFixed(2)})`}>
        <rect x={-10} y={-18} width={20} height={18} rx={6} fill="#F49AB0" stroke={ink} strokeWidth={5} />
        <rect x={-6} y={-15} width={4} height={11} rx={2} fill="#FFFFFF" opacity={0.5} />
        <rect x={-11} y={-30} width={22} height={13} fill={PALETTE.metal} stroke={ink} strokeWidth={5} />
        <line x1={-9} y1={-24} x2={9} y2={-24} stroke={PALETTE.metalDark} strokeWidth={3} />
        <rect x={-11} y={-124} width={22} height={94} fill={`url(#${gid})`} stroke={ink} strokeWidth={5} />
        <rect x={-7} y={-120} width={4} height={86} rx={2} fill="#FFFFFF" opacity={0.45} />
        <rect x={4} y={-120} width={5} height={86} rx={2} fill="#B5770F" opacity={0.35} />
        <path d="M -11 -124 L 0 -150 L 11 -124 Z" fill="#F3D3A0" stroke={ink} strokeWidth={5} strokeLinejoin="round" />
        <path d="M -4 -140 L 0 -150 L 4 -140 Z" fill={ink} />
        <path d="M 3 -128 L 7 -128 L 2 -138 Z" fill={PALETTE.woodDark} opacity={0.35} />
      </g>
      {/* vạch chuyển động */}
      <g opacity={lineAlpha.toFixed(2)} stroke={ink} strokeWidth={4} strokeLinecap="round" fill="none">
        <path d={`M ${(-side * 38).toFixed(1)} -262 q ${(-side * 8).toFixed(1)} 12 0 24`} />
        <path d={`M ${(-side * 50).toFixed(1)} -250 q ${(-side * 7).toFixed(1)} 10 0 20`} />
      </g>
      {/* lấp lánh */}
      <g transform={`translate(52 -214) scale(${(0.6 + 0.4 * sparkle).toFixed(3)})`} opacity={(0.4 + 0.6 * sparkle).toFixed(2)}>
        <path d="M 0 -10 L 3 -3 L 10 0 L 3 3 L 0 10 L -3 3 L -10 0 L -3 -3 Z" fill={PALETTE.warn} stroke={ink} strokeWidth={2} />
      </g>
      <circle cx={-56} cy={-190} r={4} fill={PALETTE.screen} opacity={(1 - sparkle * 0.7).toFixed(2)} />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 75,
  height: 300,
  Component: BalancingPencilHand,
};
