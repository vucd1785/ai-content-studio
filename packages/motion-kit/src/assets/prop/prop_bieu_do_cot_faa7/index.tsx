import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { clamp, easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

const BARS = [
  { x: -66, h: 58, green: true },
  { x: -32, h: 92, green: false },
  { x: 2, h: 128, green: true },
  { x: 36, h: 166, green: false },
];
const BAR_W = 28;
const BASE_Y = -16;

/** Biểu đồ cột tăng trưởng: bốn cột xanh mọc cao dần, mũi tên đi lên nhấp nháy. */
const BarChartGrowth: FC<PropProps> = ({ frame, seed }) => {
  const blinkRaw = 0.5 + 0.5 * Math.sin(frame * 0.18);
  const blink = 0.35 + 0.65 * easing.inOut(blinkRaw);
  const arrowLift = -4 * easing.inOut(0.5 + 0.5 * Math.sin(frame * 0.09));
  const sparkle = 0.6 + 0.4 * wobble(frame, seed + 3, 24);
  const sparkleRot = frame * 2;

  return (
    <g>
      <ContactShadow halfWidth={84} />
      <defs>
        <linearGradient id="mk-gen-bar-green" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7CDB8E" />
          <stop offset="1" stopColor="#3FA85A" />
        </linearGradient>
        <linearGradient id="mk-gen-bar-blue" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7DBDF5" />
          <stop offset="1" stopColor="#3A82CF" />
        </linearGradient>
      </defs>

      {/* bệ đế */}
      <rect x={-82} y={-18} width={164} height={18} rx={8} fill={PALETTE.woodDark} stroke={ink} strokeWidth={5} />
      <rect x={-76} y={-15} width={110} height={4} rx={2} fill="#FFFFFF" opacity={0.3} />

      {/* đường lưới mờ */}
      <line x1={-74} y1={-80} x2={74} y2={-80} stroke={ink} strokeWidth={2} opacity={0.12} strokeLinecap="round" />
      <line x1={-74} y1={-140} x2={74} y2={-140} stroke={ink} strokeWidth={2} opacity={0.12} strokeLinecap="round" />

      {BARS.map((b, i) => {
        const grow = easing.outBack(1.5)(clamp((frame - i * 6) / 26, 0, 1));
        const pulse = 1 + 0.05 * Math.sin(frame * 0.12 - i * 0.9);
        const h = Math.max(4, b.h * grow * pulse);
        const top = BASE_Y - h;
        const fill = b.green ? "url(#mk-gen-bar-green)" : "url(#mk-gen-bar-blue)";
        const capColor = b.green ? "#A8EDB4" : "#B3DAFA";
        return (
          <g key={i}>
            <rect x={b.x} y={top} width={BAR_W} height={h} rx={6} fill={fill} stroke={ink} strokeWidth={5} />
            <rect x={b.x + 5} y={top + 6} width={6} height={Math.max(0, h - 14)} rx={3} fill="#FFFFFF" opacity={0.35} />
            <rect x={b.x + BAR_W - 9} y={top + 6} width={5} height={Math.max(0, h - 12)} rx={2.5} fill={ink} opacity={0.15} />
            <rect x={b.x + 4} y={top + 3} width={BAR_W - 8} height={4} rx={2} fill={capColor} opacity={0.9} />
          </g>
        );
      })}

      {/* mũi tên đi lên */}
      <g transform={`translate(0 ${arrowLift.toFixed(2)})`} opacity={blink}>
        <polyline
          points="-70,-96 -36,-130 -12,-114 30,-178 54,-212"
          fill="none"
          stroke={ink}
          strokeWidth={14}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points="-70,-96 -36,-130 -12,-114 30,-178 54,-212"
          fill="none"
          stroke={PALETTE.warn}
          strokeWidth={7}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polygon points="70,-236 36,-222 62,-198" fill={PALETTE.warn} stroke={ink} strokeWidth={5} strokeLinejoin="round" />
        <polygon points="64,-228 46,-221 58,-210" fill="#FFFFFF" opacity={0.4} />
      </g>

      {/* lấp lánh */}
      <g transform={`translate(-56 -224) rotate(${sparkleRot}) scale(${sparkle.toFixed(3)})`}>
        <path d="M0 -12 L3 -3 L12 0 L3 3 L0 12 L-3 3 L-12 0 L-3 -3 Z" fill="#FFF3B0" stroke={ink} strokeWidth={2.5} strokeLinejoin="round" />
      </g>
      <circle cx={-30} cy={-200} r={4} fill="#FFF3B0" opacity={1 - blink * 0.7} />
      <circle cx={74} cy={-180} r={3.5} fill="#FFF3B0" opacity={0.3 + 0.7 * blink} />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 86,
  height: 246,
  Component: BarChartGrowth,
};
