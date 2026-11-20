import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, lerp, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";

const ink = PALETTE.ink;
const windLight = "#FFFFFF";
const windMid = "#BFE6FF";
const windDark = "#5FAEE3";

const GUST_PATH =
  "M -50 0 C -22 -14, 8 12, 38 0 C 58 -8, 60 -30, 42 -30 C 30 -30, 28 -16, 38 -14";
const GUST_HI = "M -42 -3 C -22 -12, 0 4, 22 0";

type Gust = { y: number; s: number; phase: number; period: number };

const GUSTS: Gust[] = [
  { y: -40, s: 0.95, phase: 0.0, period: 54 },
  { y: -88, s: 0.8, phase: 0.35, period: 48 },
  { y: -132, s: 1.0, phase: 0.62, period: 58 },
  { y: -168, s: 0.72, phase: 0.18, period: 50 },
];

const frac = (v: number) => v - Math.floor(v);

/** Luồng gió mạnh: các vệt cong trắng xanh cuộn xoáy trôi từ trái sang phải, lặp nhịp nhàng. */
const LuongGioManh: FC<PropProps> = ({ frame, seed }) => {
  const leafP = frac(frame / 70 + (seed % 7) * 0.1);
  const leafX = lerp(-72, 72, easing.inOut(leafP));
  const leafY = -110 + 26 * Math.sin(leafP * Math.PI * 2) + 4 * wobble(frame, seed + 3, 30);
  const leafRot = leafP * 540;
  const leafOp = Math.sin(leafP * Math.PI);
  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-wind-band" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={windMid} stopOpacity={0} />
          <stop offset="0.4" stopColor={windMid} stopOpacity={0.45} />
          <stop offset="1" stopColor={windDark} stopOpacity={0.15} />
        </linearGradient>
      </defs>

      {/* soft background air bands */}
      <ellipse
        cx={4 * wobble(frame, seed, 60)}
        cy={-100}
        rx={84}
        ry={78}
        fill="url(#mk-gen-wind-band)"
        opacity={0.5}
      />
      <ellipse cx={-10} cy={-60} rx={70} ry={14} fill={windDark} opacity={0.12} />
      <ellipse cx={14} cy={-150} rx={66} ry={12} fill={windLight} opacity={0.25} />

      {GUSTS.map((g, i) => {
        const p = frac(frame / g.period + g.phase + (seed % 5) * 0.07);
        const x = lerp(-28, 28, easing.inOut(p));
        const op = Math.sin(p * Math.PI);
        const stretch = 1 + 0.1 * Math.sin(p * Math.PI);
        const bob = 3 * wobble(frame, seed + i * 11, 40);
        return (
          <g
            key={i}
            opacity={0.25 + 0.75 * op}
            transform={`translate(${x.toFixed(2)} ${(g.y + bob).toFixed(2)}) scale(${(g.s * stretch).toFixed(3)} ${g.s.toFixed(3)})`}
          >
            <path d={GUST_PATH} fill="none" stroke={ink} strokeWidth={15} strokeLinecap="round" strokeLinejoin="round" />
            <path d={GUST_PATH} fill="none" stroke={windDark} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
            <path
              d={GUST_PATH}
              fill="none"
              stroke={windMid}
              strokeWidth={6}
              strokeLinecap="round"
              strokeLinejoin="round"
              transform="translate(-1 -1)"
            />
            <path d={GUST_HI} fill="none" stroke={windLight} strokeWidth={3} strokeLinecap="round" opacity={0.9} />
            <circle cx={-60} cy={4} r={3.5} fill={windMid} stroke={ink} strokeWidth={2} opacity={op} />
          </g>
        );
      })}

      {/* leaf caught in the wind */}
      <g
        opacity={0.3 + 0.7 * leafOp}
        transform={`translate(${leafX.toFixed(2)} ${leafY.toFixed(2)}) rotate(${leafRot.toFixed(1)})`}
      >
        <path d="M -10 0 Q 0 -9, 10 0 Q 0 9, -10 0 Z" fill={PALETTE.leaf} stroke={ink} strokeWidth={3} />
        <path d="M -8 0 L 8 0" stroke={ink} strokeWidth={1.5} />
        <path d="M -5 -2 Q 0 -5, 5 -3" fill="none" stroke={windLight} strokeWidth={1.5} opacity={0.6} />
      </g>

      {/* sparkles drifting */}
      {[0, 1, 2].map((k) => {
        const p = frac(frame / 40 + k / 3);
        const sx = lerp(-70, 70, p);
        const sy = -30 - k * 60 + 6 * Math.sin(p * 6.28);
        const tw = Math.sin(p * Math.PI);
        return (
          <g key={`s${k}`} transform={`translate(${sx.toFixed(2)} ${sy.toFixed(2)}) scale(${(0.5 + 0.6 * tw).toFixed(3)})`} opacity={tw}>
            <path d="M 0 -6 L 1.6 -1.6 L 6 0 L 1.6 1.6 L 0 6 L -1.6 1.6 L -6 0 L -1.6 -1.6 Z" fill={windLight} stroke={windDark} strokeWidth={1.2} />
          </g>
        );
      })}
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 210,
  Component: LuongGioManh,
};
