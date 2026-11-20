import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";

const ink = PALETTE.ink;

/** Tàu vũ trụ thân trắng mũi đỏ lao về bên phải, lửa cam phụt ở đuôi, vệt sáng tốc độ phía sau. */
const SpaceshipDash: FC<PropProps> = ({ frame, seed }) => {
  const shakeY = 1.6 * wobble(frame, seed, 5);
  const shakeX = 1.2 * wobble(frame, seed + 3, 7);
  const surgeT = (frame % 40) / 40;
  const surge = 3 * Math.sin(easing.inOut(surgeT) * Math.PI * 2);
  const flick = 0.5 + 0.5 * wobble(frame, seed + 11, 4);
  const flameLen = 22 + 10 * flick;
  const innerLen = 12 + 6 * flick;
  const glow = 0.5 + 0.5 * wobble(frame, seed + 5, 18);
  const streaks = [-142, -112, -86, -60].map((y, i) => {
    const p = (frame * 0.05 + i * 0.29) % 1;
    const e = easing.out(p);
    const x2 = -30 - e * 40;
    return { y, x1: x2 - 16, x2, op: (1 - p) * 0.85 };
  });
  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-ship-body" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.6" stopColor="#EEF1F6" />
          <stop offset="1" stopColor="#C9D0DC" />
        </linearGradient>
        <linearGradient id="mk-gen-ship-nose" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#FF6B5E" />
          <stop offset="1" stopColor="#C8302A" />
        </linearGradient>
        <radialGradient id="mk-gen-ship-flame" cx="0.85" cy="0.5" r="0.8">
          <stop offset="0" stopColor="#FFE07A" />
          <stop offset="1" stopColor="#FF7A1A" />
        </radialGradient>
      </defs>
      {streaks.map((s, i) => (
        <line
          key={i}
          x1={s.x1}
          y1={s.y}
          x2={s.x2}
          y2={s.y}
          stroke={i % 2 === 0 ? "#FFF3B0" : "#BDEBFF"}
          strokeWidth={5}
          strokeLinecap="round"
          opacity={s.op}
        />
      ))}
      <g transform={`translate(${(shakeX + surge).toFixed(2)} ${shakeY.toFixed(2)})`}>
        {/* lửa đuôi */}
        <path
          d={`M -50 -116 Q ${-50 - flameLen * 0.6} -110 ${-50 - flameLen} -100 Q ${-50 - flameLen * 0.6} -90 -50 -84 Z`}
          fill="url(#mk-gen-ship-flame)"
          stroke={ink}
          strokeWidth={4}
          strokeLinejoin="round"
        />
        <path
          d={`M -50 -108 Q ${-50 - innerLen * 0.6} -104 ${-50 - innerLen} -100 Q ${-50 - innerLen * 0.6} -96 -50 -92 Z`}
          fill="#FFF6C2"
        />
        <circle cx={-52} cy={-100} r={16} fill="#FFB347" opacity={0.25 + 0.2 * flick} />
        {/* cánh */}
        <path d="M -36 -124 L -56 -152 Q -40 -150 -14 -127 Z" fill="url(#mk-gen-ship-nose)" stroke={ink} strokeWidth={5} strokeLinejoin="round" />
        <path d="M -36 -76 L -56 -48 Q -40 -50 -14 -73 Z" fill="url(#mk-gen-ship-nose)" stroke={ink} strokeWidth={5} strokeLinejoin="round" />
        {/* ống phụt */}
        <rect x={-56} y={-116} width={14} height={32} rx={4} fill={PALETTE.metalDark} stroke={ink} strokeWidth={5} />
        {/* thân */}
        <path
          d="M -46 -128 L 38 -128 Q 82 -116 86 -100 Q 82 -84 38 -72 L -46 -72 Q -52 -100 -46 -128 Z"
          fill="url(#mk-gen-ship-body)"
          stroke={ink}
          strokeWidth={6}
          strokeLinejoin="round"
        />
        {/* bóng dưới thân */}
        <path d="M -46 -84 L 60 -84 Q 50 -78 38 -75 L -46 -75 Z" fill="#8E9AB0" opacity={0.3} />
        {/* mũi đỏ */}
        <path
          d="M 40 -127 Q 82 -116 86 -100 Q 82 -84 40 -73 Q 48 -100 40 -127 Z"
          fill="url(#mk-gen-ship-nose)"
          stroke={ink}
          strokeWidth={5}
          strokeLinejoin="round"
        />
        <path d="M 48 -120 Q 66 -114 74 -106" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" fill="none" opacity={0.6} />
        {/* sọc đỏ đuôi */}
        <rect x={-38} y={-127} width={9} height={54} fill={PALETTE.alert} opacity={0.85} />
        {/* highlight thân */}
        <path d="M -36 -120 L 26 -120" stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" opacity={0.9} />
        {/* ô cửa tròn */}
        <circle cx={8} cy={-100} r={16} fill={PALETTE.metal} stroke={ink} strokeWidth={5} />
        <circle cx={8} cy={-100} r={10} fill={PALETTE.screen} />
        <circle cx={8} cy={-100} r={10} fill="#BDEBFF" opacity={0.35 * glow} />
        <circle cx={4} cy={-104} r={3.5} fill="#FFFFFF" opacity={0.9} />
        {/* đinh tán */}
        <circle cx={-20} cy={-112} r={2.5} fill={PALETTE.metalDark} />
        <circle cx={-20} cy={-88} r={2.5} fill={PALETTE.metalDark} />
        <circle cx={32} cy={-112} r={2.5} fill={PALETTE.metalDark} />
        <circle cx={32} cy={-88} r={2.5} fill={PALETTE.metalDark} />
        {/* đèn nhấp nháy */}
        <circle cx={-56} cy={-150} r={4} fill={PALETTE.warn} opacity={0.4 + 0.6 * glow} />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 160,
  Component: SpaceshipDash,
};
