import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble, easing } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const BLADE_BASE = "#3E8EDE";
const BLADE_LIGHT = "#8CC8FF";
const BLADE_DARK = "#24609E";
const WIND = "#7FD3FF";

const BLADES: number[] = [0, 72, 144, 216, 288];
const SCREWS: { sx: number; sy: number }[] = [
  { sx: -48, sy: -156 },
  { sx: 48, sy: -156 },
  { sx: -48, sy: -64 },
  { sx: 48, sy: -64 },
];
const STREAKS: { bx: number; off: number; amp: number }[] = [
  { bx: -36, off: 0, amp: 7 },
  { bx: 0, off: 0.33, amp: 9 },
  { bx: 36, off: 0.66, amp: 7 },
];

/** Quạt làm mát máy tính hình vuông: cánh xanh quay nhanh, vệt gió xanh thổi lên trên. */
const CoolingFan: FC<PropProps> = ({ frame, seed }) => {
  const spin = (frame * 21) % 360;
  const shakeX = 0.8 * wobble(frame, seed, 5);
  const shakeY = 0.6 * wobble(frame, seed + 3, 7);
  const led = 0.5 + 0.5 * Math.sin(frame * 0.25);
  const cx = 0;
  const cy = -110;
  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-fan-case" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#C9D3DE" />
          <stop offset="1" stopColor={PALETTE.metalDark} />
        </linearGradient>
        <radialGradient id="mk-gen-fan-hole" cx="0.4" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#2B3A4F" />
          <stop offset="1" stopColor="#141C28" />
        </radialGradient>
      </defs>
      <ContactShadow halfWidth={66} />
      {/* chân đế */}
      <rect x={-44} y={-50} width={14} height={44} rx={5} fill={PALETTE.metalDark} stroke={ink} strokeWidth={5} />
      <rect x={30} y={-50} width={14} height={44} rx={5} fill={PALETTE.metalDark} stroke={ink} strokeWidth={5} />
      <rect x={-60} y={-12} width={120} height={12} rx={6} fill={PALETTE.metal} stroke={ink} strokeWidth={5} />
      <g transform={`translate(${shakeX.toFixed(2)} ${shakeY.toFixed(2)})`}>
        {/* vỏ quạt vuông */}
        <rect x={-64} y={-174} width={128} height={128} rx={18} fill="url(#mk-gen-fan-case)" stroke={ink} strokeWidth={7} />
        <rect x={-56} y={-166} width={60} height={10} rx={5} fill="#FFFFFF" opacity={0.35} />
        <rect x={-6} y={-60} width={62} height={8} rx={4} fill={ink} opacity={0.15} />
        {/* lỗ quạt */}
        <circle cx={cx} cy={cy} r={54} fill="url(#mk-gen-fan-hole)" stroke={ink} strokeWidth={6} />
        {/* vệt mờ chuyển động */}
        <circle cx={cx} cy={cy} r={46} fill={BLADE_LIGHT} opacity={0.18} />
        {/* cánh quạt */}
        <g transform={`translate(${cx} ${cy}) rotate(${spin.toFixed(2)})`}>
          {BLADES.map((ang) => (
            <g key={ang} transform={`rotate(${ang})`}>
              <path
                d="M 0 -8 C 16 -24, 40 -30, 46 -12 C 40 -2, 22 2, 8 2 Z"
                fill={BLADE_BASE}
                stroke={ink}
                strokeWidth={4}
                strokeLinejoin="round"
              />
              <path d="M 8 -14 C 20 -24, 34 -26, 40 -18" fill="none" stroke={BLADE_LIGHT} strokeWidth={4} strokeLinecap="round" />
              <path d="M 14 0 C 24 0, 34 -4, 42 -10" fill="none" stroke={BLADE_DARK} strokeWidth={3} strokeLinecap="round" opacity={0.7} />
            </g>
          ))}
        </g>
        {/* trục giữa */}
        <circle cx={cx} cy={cy} r={16} fill={PALETTE.metal} stroke={ink} strokeWidth={5} />
        <circle cx={cx - 5} cy={cy - 5} r={5} fill="#FFFFFF" opacity={0.7} />
        <circle cx={cx + 4} cy={cy + 4} r={8} fill={ink} opacity={0.12} />
        {/* ốc vít */}
        {SCREWS.map((s) => (
          <g key={`${s.sx}_${s.sy}`}>
            <circle cx={s.sx} cy={s.sy} r={6} fill={PALETTE.metal} stroke={ink} strokeWidth={3} />
            <line x1={s.sx - 3} y1={s.sy} x2={s.sx + 3} y2={s.sy} stroke={ink} strokeWidth={2} strokeLinecap="round" />
          </g>
        ))}
        {/* đèn báo */}
        <circle cx={52} cy={-110} r={7} fill={PALETTE.ok} opacity={0.3 * led} />
        <circle cx={52} cy={-110} r={3.5} fill={PALETTE.ok} opacity={0.5 + 0.5 * led} />
      </g>
      {/* vệt gió */}
      {STREAKS.map((w) => {
        const p = (frame * 0.035 + w.off) % 1;
        const rise = easing.out(p);
        const y0 = -180 - rise * 30;
        const op = Math.sin(p * Math.PI);
        const sway = w.amp * Math.sin(frame * 0.12 + w.off * 6);
        const bx = w.bx;
        return (
          <path
            key={`wind_${bx}`}
            d={`M ${bx} ${y0.toFixed(2)} C ${(bx + sway).toFixed(2)} ${(y0 - 10).toFixed(2)}, ${(bx - sway).toFixed(2)} ${(y0 - 18).toFixed(2)}, ${(bx + sway * 0.5).toFixed(2)} ${(y0 - 28).toFixed(2)}`}
            fill="none"
            stroke={WIND}
            strokeWidth={6}
            strokeLinecap="round"
            opacity={op}
          />
        );
      })}
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 80,
  height: 240,
  Component: CoolingFan,
};
