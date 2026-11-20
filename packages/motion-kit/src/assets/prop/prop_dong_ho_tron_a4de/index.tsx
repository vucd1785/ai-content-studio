import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const CY = -112;
const R = 66;

const arc = (r: number, deg: number): string => {
  const a = (deg * Math.PI) / 180;
  return `M 0 ${-r} A ${r} ${r} 0 0 0 ${(-r * Math.sin(a)).toFixed(2)} ${(-r * Math.cos(a)).toFixed(2)}`;
};

/** Đồng hồ tròn màu cam có Trái Đất nhỏ trên mặt, kim quay rất nhanh kèm vệt chuyển động. */
const DongHoTron: FC<PropProps> = ({ frame, seed }) => {
  const minute = (frame * 34) % 360;
  const hour = (frame * 7) % 360;
  const shake = Math.sin(frame * 1.9) * 2.2;
  const bounceT = (frame % 24) / 24;
  const hop = Math.sin(bounceT * Math.PI);
  const lift = -4 * easing.out(hop);
  const sx = 1 + 0.03 * (1 - hop);
  const sy = 1 - 0.03 * (1 - hop);
  const glow = 0.5 + 0.5 * wobble(frame, seed, 18);
  const spin = (frame * 2) % 360;
  return (
    <g>
      <defs>
        <radialGradient id="mk-gen-clock-body" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0%" stopColor="#FFC27A" />
          <stop offset="55%" stopColor="#F58A2A" />
          <stop offset="100%" stopColor="#C85E14" />
        </radialGradient>
        <radialGradient id="mk-gen-clock-earth" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0%" stopColor="#7FD0FF" />
          <stop offset="100%" stopColor="#2C7FC9" />
        </radialGradient>
      </defs>
      <ContactShadow halfWidth={70} />
      {/* chân */}
      <line x1={-30} y1={-56} x2={-42} y2={-10} stroke={ink} strokeWidth={8} strokeLinecap="round" />
      <line x1={30} y1={-56} x2={42} y2={-10} stroke={ink} strokeWidth={8} strokeLinecap="round" />
      <ellipse cx={-44} cy={-8} rx={14} ry={7} fill="#C85E14" stroke={ink} strokeWidth={5} />
      <ellipse cx={44} cy={-8} rx={14} ry={7} fill="#C85E14" stroke={ink} strokeWidth={5} />
      <g transform={`translate(0 ${(CY + lift).toFixed(2)}) rotate(${shake.toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)})`}>
        {/* chuông */}
        <line x1={0} y1={-R} x2={0} y2={-R - 26} stroke={ink} strokeWidth={6} strokeLinecap="round" />
        <circle cx={0} cy={-R - 28} r={6} fill={PALETTE.metal} stroke={ink} strokeWidth={4} />
        <g transform="rotate(-32)">
          <path d={`M -22 ${-R + 6} A 22 22 0 0 1 22 ${-R + 6} Z`} fill="#F58A2A" stroke={ink} strokeWidth={6} strokeLinejoin="round" />
          <ellipse cx={-8} cy={-R - 6} rx={6} ry={3} fill="#FFE0B0" opacity={0.8} />
        </g>
        <g transform="rotate(32)">
          <path d={`M -22 ${-R + 6} A 22 22 0 0 1 22 ${-R + 6} Z`} fill="#F58A2A" stroke={ink} strokeWidth={6} strokeLinejoin="round" />
          <ellipse cx={-8} cy={-R - 6} rx={6} ry={3} fill="#FFE0B0" opacity={0.8} />
        </g>
        {/* thân */}
        <circle cx={0} cy={0} r={R} fill="url(#mk-gen-clock-body)" stroke={ink} strokeWidth={7} />
        <path d={`M ${-R + 10} 18 A ${R - 8} ${R - 8} 0 0 0 ${R - 10} 18`} fill="none" stroke="#B0500F" strokeWidth={6} opacity={0.35} strokeLinecap="round" />
        {/* mặt */}
        <circle cx={0} cy={0} r={R - 14} fill={PALETTE.paper} stroke={ink} strokeWidth={5} />
        <path d={`M -40 -22 A 46 46 0 0 1 -14 -46`} fill="none" stroke="#FFFFFF" strokeWidth={6} strokeLinecap="round" opacity={0.9} />
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
          <line
            key={i}
            x1={0}
            y1={-(R - 20)}
            x2={0}
            y2={-(R - (i % 3 === 0 ? 30 : 25))}
            stroke={ink}
            strokeWidth={i % 3 === 0 ? 5 : 3}
            strokeLinecap="round"
            transform={`rotate(${i * 30})`}
          />
        ))}
        {/* Trái Đất */}
        <g transform={`rotate(${spin.toFixed(1)})`}>
          <circle cx={0} cy={0} r={22} fill="url(#mk-gen-clock-earth)" stroke={ink} strokeWidth={4} />
          <path d="M -14 -10 Q -6 -18 2 -12 Q 6 -4 -2 0 Q -10 4 -14 -2 Z" fill={PALETTE.leaf} />
          <path d="M 6 6 Q 14 2 16 10 Q 10 18 4 14 Z" fill={PALETTE.leaf} />
        </g>
        <circle cx={-8} cy={-9} r={5} fill="#FFFFFF" opacity={0.6} />
        {/* vệt kim phút */}
        <g transform={`rotate(${minute.toFixed(1)})`}>
          <path d={arc(40, 90)} fill="none" stroke={PALETTE.accent} strokeWidth={10} strokeLinecap="round" opacity={0.18} />
          <path d={arc(40, 55)} fill="none" stroke={PALETTE.accent} strokeWidth={8} strokeLinecap="round" opacity={0.35} />
          <path d={arc(30, 70)} fill="none" stroke={PALETTE.accent} strokeWidth={5} strokeLinecap="round" opacity={0.3} />
          <line x1={0} y1={6} x2={0} y2={-44} stroke={ink} strokeWidth={6} strokeLinecap="round" />
        </g>
        {/* kim giờ */}
        <g transform={`rotate(${hour.toFixed(1)})`}>
          <path d={arc(26, 60)} fill="none" stroke={PALETTE.alert} strokeWidth={6} strokeLinecap="round" opacity={0.25} />
          <line x1={0} y1={4} x2={0} y2={-28} stroke={PALETTE.alert} strokeWidth={7} strokeLinecap="round" />
        </g>
        <circle cx={0} cy={0} r={6} fill={PALETTE.warn} stroke={ink} strokeWidth={3} />
        <ellipse cx={-34} cy={-36} rx={10} ry={6} fill="#FFFFFF" opacity={0.45} transform="rotate(-40 -34 -36)" />
      </g>
      {/* vạch tốc độ */}
      <g opacity={0.4 + 0.5 * glow} stroke={PALETTE.accent} strokeWidth={4} strokeLinecap="round">
        <path d="M -76 -150 Q -82 -112 -76 -74" fill="none" />
        <path d="M 76 -150 Q 82 -112 76 -74" fill="none" />
      </g>
      <path d="M 66 -176 l 3 7 l 7 3 l -7 3 l -3 7 l -3 -7 l -7 -3 l 7 -3 Z" fill={PALETTE.warn} opacity={glow} />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 80,
  height: 220,
  Component: DongHoTron,
};
