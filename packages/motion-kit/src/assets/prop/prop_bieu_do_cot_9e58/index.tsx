import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { clamp, easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

const BLUE = "#4A90E2";
const BLUE_LIGHT = "#9CCBF7";
const BLUE_DARK = "#2E64B0";
const GREEN = "#43C27A";
const GREEN_LIGHT = "#9BE8B9";
const GREEN_DARK = "#2A8A52";

const BASE_Y = -16;

type BarSpec = {
  x: number;
  w: number;
  h: number;
  delay: number;
  grad: string;
  light: string;
  dark: string;
};

const BARS: BarSpec[] = [
  { x: -58, w: 32, h: 62, delay: 0, grad: "mk-gen-bar-blue", light: BLUE_LIGHT, dark: BLUE_DARK },
  { x: -16, w: 32, h: 104, delay: 12, grad: "mk-gen-bar-green", light: GREEN_LIGHT, dark: GREEN_DARK },
  { x: 26, w: 34, h: 196, delay: 26, grad: "mk-gen-bar-tall", light: GREEN_LIGHT, dark: GREEN_DARK },
];

const growOf = (frame: number, delay: number, dur: number): number => {
  const p = clamp((frame - delay) / dur, 0, 1);
  return p <= 0 ? 0 : easing.outBack(1.6)(p);
};

/** Biểu đồ cột tăng trưởng: ba cột mọc lần lượt, cột cuối vọt cao, nhịp thở nhẹ khi đứng yên. */
const BarChartGrowth: FC<PropProps> = ({ frame, seed }) => {
  const sparkle = 0.5 + 0.5 * wobble(frame, seed + 3, 28);
  const twinkle = 0.5 + 0.5 * wobble(frame, seed + 11, 18);
  return (
    <g>
      <ContactShadow halfWidth={74} />
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
        <linearGradient id="mk-gen-bar-tall" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={BLUE} />
          <stop offset="0.6" stopColor={GREEN} />
          <stop offset="1" stopColor={GREEN_LIGHT} />
        </linearGradient>
      </defs>

      {/* đế */}
      <rect x={-72} y={-18} width={144} height={18} rx={8} fill={PALETTE.woodDark} stroke={ink} strokeWidth={5} />
      <rect x={-64} y={-15} width={70} height={5} rx={2.5} fill={PALETTE.paper} opacity={0.35} />

      {/* lưới mờ phía sau */}
      <line x1={-62} y1={-80} x2={66} y2={-80} stroke={PALETTE.outline} strokeWidth={2} opacity={0.18} strokeDasharray="6 8" />
      <line x1={-62} y1={-140} x2={66} y2={-140} stroke={PALETTE.outline} strokeWidth={2} opacity={0.18} strokeDasharray="6 8" />
      <line x1={-62} y1={-200} x2={66} y2={-200} stroke={PALETTE.outline} strokeWidth={2} opacity={0.18} strokeDasharray="6 8" />

      {BARS.map((b, i) => {
        const g = growOf(frame, b.delay, i === 2 ? 30 : 22);
        const breathe = 1 + 0.025 * wobble(frame, seed + i * 5, 46 + i * 6);
        const h = Math.max(0, b.h * g * breathe);
        if (h < 1) return null;
        const top = BASE_Y - h;
        return (
          <g key={i}>
            {i === 2 ? (
              <rect
                x={b.x - 6}
                y={top - 6}
                width={b.w + 12}
                height={h + 6}
                rx={12}
                fill={GREEN_LIGHT}
                opacity={0.25 + 0.2 * sparkle}
              />
            ) : null}
            <rect x={b.x} y={top} width={b.w} height={h} rx={8} fill={`url(#${b.grad})`} stroke={ink} strokeWidth={5} />
            <rect x={b.x + 5} y={top + 6} width={6} height={Math.max(0, h - 14)} rx={3} fill={PALETTE.paper} opacity={0.45} />
            <rect x={b.x + b.w - 10} y={top + 6} width={5} height={Math.max(0, h - 14)} rx={2.5} fill={b.dark} opacity={0.4} />
            <rect x={b.x + 4} y={top + 4} width={b.w - 8} height={6} rx={3} fill={b.light} opacity={0.7} />
          </g>
        );
      })}

      {/* trục */}
      <path d={`M -66 -232 L -66 ${BASE_Y} L 68 ${BASE_Y}`} fill="none" stroke={ink} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />

      {/* lấp lánh trên đỉnh cột cao */}
      {(() => {
        const g = growOf(frame, 26, 30);
        if (g < 0.9) return null;
        const topY = BASE_Y - 196 * g;
        const s = 0.7 + 0.4 * sparkle;
        const s2 = 0.5 + 0.4 * twinkle;
        return (
          <g>
            <g transform={`translate(43 ${(topY - 16).toFixed(2)}) scale(${s.toFixed(3)})`}>
              <path d="M 0 -12 Q 2 -2 12 0 Q 2 2 0 12 Q -2 2 -12 0 Q -2 -2 0 -12 Z" fill={PALETTE.warn} stroke={ink} strokeWidth={3} strokeLinejoin="round" />
            </g>
            <g transform={`translate(64 ${(topY + 6).toFixed(2)}) scale(${s2.toFixed(3)})`}>
              <path d="M 0 -8 Q 1.5 -1.5 8 0 Q 1.5 1.5 0 8 Q -1.5 1.5 -8 0 Q -1.5 -1.5 0 -8 Z" fill={PALETTE.paper} stroke={ink} strokeWidth={2.5} strokeLinejoin="round" />
            </g>
            <circle cx={22} cy={topY - 4} r={3.5} fill={PALETTE.warn} opacity={twinkle} />
          </g>
        );
      })()}
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 80,
  height: 250,
  Component: BarChartGrowth,
};
