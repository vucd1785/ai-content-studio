import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

const BLUE = "#4A90E2";
const BLUE_LIGHT = "#9CCBFF";
const BLUE_DARK = "#2E66B0";
const GREEN = "#5CC25A";
const GREEN_LIGHT = "#A8E890";
const GREEN_DARK = "#36883A";

/** Biểu đồ cột phẳng: ba cột xanh cao dần, cột cuối vọt cao, mũi tên đi lên và ngôi sao lấp lánh. */
const BarChartGrowth: FC<PropProps> = ({ frame, seed }) => {
  const cycle = (frame % 60) / 60;
  const pulse = easing.inOut(cycle < 0.5 ? cycle * 2 : 2 - cycle * 2);
  const b1 = 62 + 3 * wobble(frame, seed, 50);
  const b2 = 110 + 4 * wobble(frame, seed + 3, 56);
  const b3 = 172 + 8 * pulse;
  const arrowBob = -4 * pulse;
  const sparkle = 0.5 + 0.5 * wobble(frame, seed + 11, 24);
  const sScale = 0.75 + 0.35 * sparkle;

  const bars = [
    { x: -62, w: 32, h: b1, g: "mk-gen-bar-blue", dark: BLUE_DARK, light: BLUE_LIGHT },
    { x: -18, w: 32, h: b2, g: "mk-gen-bar-green", dark: GREEN_DARK, light: GREEN_LIGHT },
    { x: 26, w: 36, h: b3, g: "mk-gen-bar-blue", dark: BLUE_DARK, light: BLUE_LIGHT },
  ];
  const baseY = -14;
  const tip3 = baseY - b3;

  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-bar-blue" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={BLUE_LIGHT} />
          <stop offset="0.45" stopColor={BLUE} />
          <stop offset="1" stopColor={BLUE_DARK} />
        </linearGradient>
        <linearGradient id="mk-gen-bar-green" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={GREEN_LIGHT} />
          <stop offset="0.45" stopColor={GREEN} />
          <stop offset="1" stopColor={GREEN_DARK} />
        </linearGradient>
        <radialGradient id="mk-gen-bar-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFF6B0" stopOpacity={0.9} />
          <stop offset="1" stopColor="#FFF6B0" stopOpacity={0} />
        </radialGradient>
      </defs>
      <ContactShadow halfWidth={80} />
      {/* bảng nền mờ */}
      <rect x={-78} y={-206} width={150} height={196} rx={14} fill={PALETTE.paper} opacity={0.35} />
      {/* các đường lưới */}
      {[-60, -100, -140, -180].map((gy) => (
        <line
          key={gy}
          x1={-70}
          y1={gy}
          x2={70}
          y2={gy}
          stroke={PALETTE.metal}
          strokeWidth={3}
          strokeDasharray="6 8"
          strokeLinecap="round"
          opacity={0.6}
        />
      ))}
      {/* đế */}
      <rect x={-82} y={-16} width={164} height={14} rx={7} fill={PALETTE.woodDark} stroke={ink} strokeWidth={5} />
      <rect x={-74} y={-13} width={60} height={4} rx={2} fill="#FFFFFF" opacity={0.35} />
      {/* trục đứng */}
      <line x1={-74} y1={-14} x2={-74} y2={-210} stroke={ink} strokeWidth={6} strokeLinecap="round" />
      {/* cột */}
      {bars.map((b, i) => {
        const top = baseY - b.h;
        return (
          <g key={i}>
            <rect x={b.x} y={top} width={b.w} height={b.h} rx={6} fill={`url(#${b.g})`} stroke={ink} strokeWidth={5} />
            <rect x={b.x + b.w - 10} y={top + 6} width={6} height={b.h - 10} rx={3} fill={b.dark} opacity={0.45} />
            <rect x={b.x + 5} y={top + 8} width={6} height={Math.max(4, b.h * 0.55)} rx={3} fill="#FFFFFF" opacity={0.45} />
            <rect x={b.x + 4} y={top + 3} width={b.w - 8} height={5} rx={2.5} fill={b.light} opacity={0.8} />
          </g>
        );
      })}
      {/* đường xu hướng đi lên */}
      <g transform={`translate(0 ${arrowBob.toFixed(2)})`}>
        <path
          d={`M -46 ${baseY - b1 - 14} L -2 ${baseY - b2 - 12} L 36 ${tip3 - 18}`}
          fill="none"
          stroke={PALETTE.accent}
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={`M 30 ${tip3 - 10} L 48 ${tip3 - 30} L 26 ${tip3 - 28} Z`}
          fill={PALETTE.accent}
          stroke={ink}
          strokeWidth={4}
          strokeLinejoin="round"
        />
        <circle cx={-46} cy={baseY - b1 - 14} r={5} fill={PALETTE.paper} stroke={ink} strokeWidth={3} />
        <circle cx={-2} cy={baseY - b2 - 12} r={5} fill={PALETTE.paper} stroke={ink} strokeWidth={3} />
      </g>
      {/* ngôi sao lấp lánh */}
      <circle cx={62} cy={tip3 - 22} r={18} fill="url(#mk-gen-bar-glow)" opacity={sparkle} />
      <g transform={`translate(62 ${(tip3 - 22).toFixed(2)}) scale(${sScale.toFixed(3)})`}>
        <path
          d="M 0 -12 Q 2 -2 12 0 Q 2 2 0 12 Q -2 2 -12 0 Q -2 -2 0 -12 Z"
          fill={PALETTE.warn}
          stroke={ink}
          strokeWidth={3}
          strokeLinejoin="round"
        />
      </g>
      <circle cx={-60} cy={-190} r={3} fill={PALETTE.warn} opacity={1 - sparkle * 0.7} />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 86,
  height: 230,
  Component: BarChartGrowth,
};
