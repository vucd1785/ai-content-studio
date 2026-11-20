import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const ELECTRIC = "#4FC3FF";
const ELECTRIC_LIGHT = "#D9F4FF";

const legX = (y: number): number => 50 - (36 * -y) / 260;

const LEVELS = [0, -60, -120, -180, -240];

const WIRES = [
  { d: "M -80 -212 Q 0 -180 80 -212", phase: 0 },
  { d: "M -80 -152 Q 0 -120 80 -152", phase: 9 },
];

const INSULATORS = [
  { x: -56, top: -230, bottom: -208 },
  { x: 56, top: -230, bottom: -208 },
  { x: -68, top: -170, bottom: -150 },
  { x: 68, top: -170, bottom: -150 },
];

/** Cột điện cao thế: dòng điện xanh chạy dọc dây, nhấp nháy theo nhịp, tia lửa lóe ở đầu sứ. */
const PowerTower: FC<PropProps> = ({ frame, seed }) => {
  const beat = (frame % 30) / 30;
  const pulse = 1 - easing.out(beat);
  const glow = 0.55 + 0.45 * pulse;
  const hum = 0.5 + 0.5 * wobble(frame, seed, 40);
  const flow = -frame * 5;
  const sparkOn = (frame + seed) % 45 < 6 ? 1 : 0;
  const sparkScale = 0.8 + 0.4 * pulse;
  const sway = 0.6 * wobble(frame, seed + 3, 90);

  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-cotdien-steel" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#C9D3DD" />
          <stop offset="0.5" stopColor={PALETTE.metal} />
          <stop offset="1" stopColor={PALETTE.metalDark} />
        </linearGradient>
        <radialGradient id="mk-gen-cotdien-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={ELECTRIC_LIGHT} stopOpacity={1} />
          <stop offset="1" stopColor={ELECTRIC} stopOpacity={0} />
        </radialGradient>
      </defs>
      <ContactShadow halfWidth={70} />

      {/* footings */}
      <rect x={-62} y={-12} width={24} height={12} rx={3} fill="#9AA3AD" stroke={ink} strokeWidth={4} />
      <rect x={38} y={-12} width={24} height={12} rx={3} fill="#9AA3AD" stroke={ink} strokeWidth={4} />

      <g transform={`rotate(${sway.toFixed(2)} 0 0)`}>
        {/* lattice bracing */}
        {LEVELS.map((y, i) => {
          const y2 = i < LEVELS.length - 1 ? y - 60 : -260;
          const a = legX(y);
          const b = legX(y2);
          return (
            <g key={`br-${i}`}>
              <line x1={-a} y1={y} x2={b} y2={y2} stroke={PALETTE.metalDark} strokeWidth={4} strokeLinecap="round" />
              <line x1={a} y1={y} x2={-b} y2={y2} stroke={PALETTE.metalDark} strokeWidth={4} strokeLinecap="round" />
              <line x1={-a} y1={y} x2={a} y2={y} stroke={ink} strokeWidth={4} strokeLinecap="round" />
            </g>
          );
        })}

        {/* main legs */}
        <path
          d="M -50 0 L -14 -260 L 0 -292 L 14 -260 L 50 0 L 40 0 L 8 -252 L -8 -252 L -40 0 Z"
          fill="url(#mk-gen-cotdien-steel)"
          stroke={ink}
          strokeWidth={5}
          strokeLinejoin="round"
        />
        {/* highlight on left leg */}
        <line x1={-45} y1={-8} x2={-14} y2={-250} stroke="#FFFFFF" strokeWidth={3} opacity={0.5} strokeLinecap="round" />
        {/* shade on right leg */}
        <line x1={44} y1={-8} x2={13} y2={-250} stroke={PALETTE.metalDark} strokeWidth={4} opacity={0.45} strokeLinecap="round" />

        {/* cross arms */}
        <path d="M -62 -236 L 62 -236 L 50 -226 L -50 -226 Z" fill={PALETTE.metal} stroke={ink} strokeWidth={5} strokeLinejoin="round" />
        <path d="M -74 -176 L 74 -176 L 60 -166 L -60 -166 Z" fill={PALETTE.metal} stroke={ink} strokeWidth={5} strokeLinejoin="round" />
        <rect x={-58} y={-235} width={50} height={3} fill="#FFFFFF" opacity={0.45} />
        <rect x={-70} y={-175} width={60} height={3} fill="#FFFFFF" opacity={0.45} />

        {/* rivets */}
        <circle cx={-30} cy={-231} r={2.5} fill={ink} />
        <circle cx={30} cy={-231} r={2.5} fill={ink} />
        <circle cx={-40} cy={-171} r={2.5} fill={ink} />
        <circle cx={40} cy={-171} r={2.5} fill={ink} />

        {/* finial light */}
        <circle cx={0} cy={-294} r={7} fill={PALETTE.alert} stroke={ink} strokeWidth={3} />
        <circle cx={0} cy={-294} r={11} fill={PALETTE.alert} opacity={0.25 * hum} />

        {/* warning plate */}
        <rect x={-12} y={-110} width={24} height={22} rx={4} fill={PALETTE.warn} stroke={ink} strokeWidth={3} />
        <path d="M 2 -106 L -5 -98 L 0 -98 L -3 -91 L 5 -100 L 0 -100 Z" fill={ink} />

        {/* insulators */}
        {INSULATORS.map((ins, i) => (
          <g key={`ins-${i}`}>
            <line x1={ins.x} y1={ins.top} x2={ins.x} y2={ins.bottom} stroke={ink} strokeWidth={3} />
            <ellipse cx={ins.x} cy={ins.top + 6} rx={6} ry={3} fill="#E8EEF2" stroke={ink} strokeWidth={2.5} />
            <ellipse cx={ins.x} cy={ins.top + 12} rx={6} ry={3} fill="#E8EEF2" stroke={ink} strokeWidth={2.5} />
            <ellipse cx={ins.x} cy={ins.top + 18} rx={6} ry={3} fill="#E8EEF2" stroke={ink} strokeWidth={2.5} />
          </g>
        ))}
      </g>

      {/* wires with electric flow */}
      {WIRES.map((w, i) => (
        <g key={`w-${i}`}>
          <path d={w.d} fill="none" stroke={ink} strokeWidth={4} strokeLinecap="round" />
          <path
            d={w.d}
            fill="none"
            stroke={ELECTRIC}
            strokeWidth={10}
            strokeLinecap="round"
            opacity={0.25 * glow}
          />
          <path
            d={w.d}
            fill="none"
            stroke={ELECTRIC}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray="16 34"
            strokeDashoffset={(flow + w.phase * 3).toFixed(1)}
            opacity={glow}
          />
          <path
            d={w.d}
            fill="none"
            stroke={ELECTRIC_LIGHT}
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray="6 44"
            strokeDashoffset={(flow + w.phase * 3 - 5).toFixed(1)}
            opacity={glow}
          />
        </g>
      ))}

      {/* glow at insulator tips */}
      {INSULATORS.map((ins, i) => (
        <circle
          key={`g-${i}`}
          cx={ins.x}
          cy={ins.bottom}
          r={9 * (0.7 + 0.5 * pulse)}
          fill="url(#mk-gen-cotdien-glow)"
          opacity={0.9 * glow}
        />
      ))}

      {/* spark zap */}
      <g
        transform={`translate(56 -208) scale(${sparkScale.toFixed(2)})`}
        opacity={sparkOn}
      >
        <path
          d="M 0 0 L 8 -10 L 4 -10 L 12 -22 L 2 -9 L 6 -9 Z"
          fill={ELECTRIC_LIGHT}
          stroke={ELECTRIC}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </g>
      <g
        transform={`translate(-68 -150) scale(${sparkScale.toFixed(2)})`}
        opacity={(frame + seed + 22) % 45 < 6 ? 1 : 0}
      >
        <path
          d="M 0 0 L -8 -10 L -4 -10 L -10 -20 L -1 -9 L -5 -9 Z"
          fill={ELECTRIC_LIGHT}
          stroke={ELECTRIC}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 82,
  height: 306,
  Component: PowerTower,
};
