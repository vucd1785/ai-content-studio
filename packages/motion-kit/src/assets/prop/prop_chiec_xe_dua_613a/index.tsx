import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../../prop/prop_server/index.js";

const ink = PALETTE.ink;
const YELLOW = "#FFD23F";
const YELLOW_LIGHT = "#FFF3A8";
const YELLOW_DARK = "#E0A01E";
const GLASS = "#7FD3F5";
const RED = "#F2545B";

const Wheel: FC<{ cx: number; spin: number }> = ({ cx, spin }) => (
  <g transform={`translate(${cx} -22)`}>
    <circle cx={0} cy={0} r={20} fill="#3A3F4B" stroke={ink} strokeWidth={6} />
    <circle cx={0} cy={0} r={10} fill="#C9CED6" stroke={ink} strokeWidth={3} />
    <g transform={`rotate(${spin.toFixed(2)})`}>
      <line x1={-9} y1={0} x2={9} y2={0} stroke={ink} strokeWidth={3} strokeLinecap="round" />
      <line x1={0} y1={-9} x2={0} y2={9} stroke={ink} strokeWidth={3} strokeLinecap="round" />
    </g>
    <circle cx={-6} cy={-7} r={3} fill="#FFFFFF" opacity={0.5} />
  </g>
);

/** Xe đua nhỏ màu vàng tượng trưng cho ánh sáng: rung nhẹ, bánh quay, vệt gió lướt phía sau. */
const ChiecXeDua: FC<PropProps> = ({ frame, seed }) => {
  const shake = Math.sin(frame * 1.9) * 1.4 + Math.sin(frame * 0.7) * 0.6;
  const tilt = Math.sin(frame * 0.35) * 0.8;
  const spin = frame * 24;
  const glow = 0.55 + 0.45 * (0.5 + 0.5 * wobble(frame, seed, 14));
  const dash = (frame * 9) % 40;
  const streakFade = (i: number) => 0.45 + 0.35 * Math.sin(frame * 0.5 + i * 1.6);

  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-xedua-body" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor={YELLOW_LIGHT} />
          <stop offset="45%" stopColor={YELLOW} />
          <stop offset="100%" stopColor={YELLOW_DARK} />
        </linearGradient>
        <radialGradient id="mk-gen-xedua-light" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.95} />
          <stop offset="100%" stopColor={YELLOW_LIGHT} stopOpacity={0} />
        </radialGradient>
      </defs>
      <ContactShadow halfWidth={80} />

      {/* wind streaks */}
      {[-44, -60, -76].map((y, i) => (
        <line
          key={y}
          x1={-88}
          y1={y}
          x2={-66 + i * 2}
          y2={y}
          stroke={YELLOW_LIGHT}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray="14 6"
          strokeDashoffset={dash + i * 7}
          opacity={streakFade(i)}
        />
      ))}

      <g transform={`translate(0 ${shake.toFixed(2)}) rotate(${tilt.toFixed(2)} 0 -30)`}>
        {/* spoiler */}
        <rect x={-58} y={-78} width={8} height={16} fill={PALETTE.metalDark} stroke={ink} strokeWidth={4} />
        <rect x={-68} y={-90} width={28} height={12} rx={4} fill={RED} stroke={ink} strokeWidth={5} />

        {/* body */}
        <path
          d="M -62 -30 L -62 -60 Q -60 -66 -50 -66 L -26 -66 Q -14 -88 12 -86 Q 28 -84 36 -68 L 70 -58 Q 84 -54 84 -40 L 82 -30 Z"
          fill="url(#mk-gen-xedua-body)"
          stroke={ink}
          strokeWidth={6}
          strokeLinejoin="round"
        />
        {/* lower shade */}
        <path d="M -59 -42 L 80 -42 L 79 -33 L -59 -33 Z" fill={YELLOW_DARK} opacity={0.55} />
        {/* top highlight */}
        <path
          d="M -54 -60 L -28 -60 Q -20 -74 -8 -78"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={4}
          strokeLinecap="round"
          opacity={0.7}
        />
        {/* racing stripe */}
        <path d="M -50 -52 L 70 -48" stroke={RED} strokeWidth={6} strokeLinecap="round" />
        {/* cockpit window */}
        <path
          d="M -16 -68 Q -8 -82 10 -80 Q 22 -78 28 -68 Z"
          fill={GLASS}
          stroke={ink}
          strokeWidth={4}
          strokeLinejoin="round"
        />
        <path d="M -6 -72 Q 0 -78 8 -77" fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={0.8} />
        {/* exhaust */}
        <rect x={-70} y={-40} width={10} height={7} rx={3} fill={PALETTE.metalDark} stroke={ink} strokeWidth={3} />
        {/* headlight glow + lamp */}
        <circle cx={80} cy={-48} r={12} fill="url(#mk-gen-xedua-light)" opacity={glow} />
        <ellipse cx={77} cy={-48} rx={5} ry={4} fill="#FFFFFF" stroke={ink} strokeWidth={3} />
        {/* sparkle */}
        <g transform={`translate(44 -64) scale(${(0.7 + 0.3 * glow).toFixed(3)})`} opacity={glow}>
          <path d="M 0 -6 L 1.5 -1.5 L 6 0 L 1.5 1.5 L 0 6 L -1.5 1.5 L -6 0 L -1.5 -1.5 Z" fill="#FFFFFF" />
        </g>

        <Wheel cx={-38} spin={spin} />
        <Wheel cx={50} spin={spin} />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 96,
  Component: ChiecXeDua,
};
