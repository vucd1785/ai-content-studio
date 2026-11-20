import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const DOME = "M -76 -26 A 76 100 0 0 1 76 -26 Z";

/** Mái vòm nhà kính trên đất đỏ sao Hỏa: cây xanh bên trong đung đưa, viền sáng phập phồng. */
const MarsGreenhouseDome: FC<PropProps> = ({ frame, seed }) => {
  const id = `mk-gen-dome-${seed}`;
  const cycle = (frame % 60) / 60;
  const breath = easing.inOut(cycle < 0.5 ? cycle * 2 : 2 - cycle * 2);
  const glowOpacity = 0.25 + 0.45 * breath;
  const glowWidth = 10 + 6 * breath;
  const sparkleT = (frame % 90) / 90;
  const sparkleA = Math.sin(Math.PI * sparkleT);
  const sparkleX = -46 + 30 * easing.inOut(sparkleT);
  const sparkleY = -92 - 14 * easing.inOut(sparkleT);

  const plants = [
    { x: -46, h: 30, c: PALETTE.leaf, s: 0 },
    { x: -16, h: 40, c: "#3fae5a", s: 3 },
    { x: 16, h: 36, c: PALETTE.leaf, s: 6 },
    { x: 46, h: 28, c: "#3fae5a", s: 9 },
  ];

  return (
    <g>
      <defs>
        <radialGradient id={`${id}-glass`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0%" stopColor="#e8fbff" stopOpacity={0.55} />
          <stop offset="60%" stopColor="#9fdcf0" stopOpacity={0.28} />
          <stop offset="100%" stopColor="#4a8fb0" stopOpacity={0.4} />
        </radialGradient>
        <linearGradient id={`${id}-soil`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#e2733c" />
          <stop offset="55%" stopColor="#c4471a" />
          <stop offset="100%" stopColor="#8e2d0c" />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={88} />

      {/* Gò đất đỏ */}
      <path
        d="M -88 0 Q -86 -28 -58 -30 L 58 -30 Q 86 -28 88 0 Z"
        fill={`url(#${id}-soil)`}
        stroke={ink}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <ellipse cx={-62} cy={-10} rx={8} ry={5} fill="#7a260a" stroke={ink} strokeWidth={3} />
      <ellipse cx={66} cy={-8} rx={6} ry={4} fill="#7a260a" stroke={ink} strokeWidth={3} />
      <circle cx={-76} cy={-6} r={3} fill="#f09a63" />

      {/* Kính phía sau (bóng mờ bên trong) */}
      <path d={DOME} fill="#2d5f78" opacity={0.18} />

      {/* Luống đất trồng cây */}
      <rect x={-62} y={-40} width={124} height={14} rx={6} fill={PALETTE.woodDark} stroke={ink} strokeWidth={4} />
      <rect x={-58} y={-38} width={116} height={4} rx={2} fill={PALETTE.wood} opacity={0.7} />

      {/* Hàng cây xanh */}
      {plants.map((p, i) => {
        const sway = 5 * wobble(frame, seed + p.s, 48 + i * 6);
        return (
          <g key={i} transform={`translate(${p.x} -38) rotate(${sway.toFixed(2)})`}>
            <line x1={0} y1={0} x2={0} y2={-p.h} stroke={PALETTE.woodDark} strokeWidth={4} strokeLinecap="round" />
            <ellipse cx={-7} cy={-p.h * 0.55} rx={8} ry={5} fill={p.c} stroke={ink} strokeWidth={3} transform={`rotate(-30 -7 ${-p.h * 0.55})`} />
            <ellipse cx={7} cy={-p.h * 0.7} rx={8} ry={5} fill={p.c} stroke={ink} strokeWidth={3} transform={`rotate(30 7 ${-p.h * 0.7})`} />
            <circle cx={0} cy={-p.h} r={9} fill={p.c} stroke={ink} strokeWidth={3} />
            <circle cx={-3} cy={-p.h - 3} r={3} fill="#b8f0a0" opacity={0.8} />
          </g>
        );
      })}

      {/* Mặt kính trong suốt */}
      <path d={DOME} fill={`url(#${id}-glass)`} />

      {/* Khung vòm */}
      <path d="M -38 -26 A 38 100 0 0 1 38 -26" fill="none" stroke={PALETTE.metal} strokeWidth={4} opacity={0.85} />
      <line x1={0} y1={-26} x2={0} y2={-126} stroke={PALETTE.metal} strokeWidth={4} opacity={0.85} />
      <path d="M -66 -76 Q 0 -68 66 -76" fill="none" stroke={PALETTE.metal} strokeWidth={4} opacity={0.85} />

      {/* Viền sáng phập phồng */}
      <path d={DOME} fill="none" stroke="#9ff3ff" strokeWidth={glowWidth} opacity={glowOpacity} strokeLinejoin="round" />
      <path d={DOME} fill="none" stroke={ink} strokeWidth={6} strokeLinejoin="round" />

      {/* Đế vòm kim loại */}
      <rect x={-80} y={-32} width={160} height={10} rx={5} fill={PALETTE.metalDark} stroke={ink} strokeWidth={5} />
      <circle cx={-56} cy={-27} r={2.5} fill={PALETTE.metal} />
      <circle cx={0} cy={-27} r={2.5} fill={PALETTE.metal} />
      <circle cx={56} cy={-27} r={2.5} fill={PALETTE.metal} />

      {/* Đèn tín hiệu trên đỉnh */}
      <circle cx={0} cy={-126} r={10} fill={PALETTE.ok} opacity={0.3 * breath} />
      <circle cx={0} cy={-126} r={5} fill={PALETTE.ok} stroke={ink} strokeWidth={3} />

      {/* Bóng tối bên phải và vệt sáng bên trái */}
      <path d="M 40 -112 A 76 100 0 0 1 76 -26 L 62 -26 A 66 88 0 0 0 36 -106 Z" fill="#1e4a60" opacity={0.25} />
      <path d="M -60 -50 Q -60 -98 -24 -116" fill="none" stroke="#ffffff" strokeWidth={7} strokeLinecap="round" opacity={0.6} />
      <path d="M -48 -46 Q -50 -70 -40 -84" fill="none" stroke="#ffffff" strokeWidth={4} strokeLinecap="round" opacity={0.4} />

      {/* Tia lấp lánh */}
      <g transform={`translate(${sparkleX.toFixed(2)} ${sparkleY.toFixed(2)}) scale(${(0.4 + 0.6 * sparkleA).toFixed(3)})`} opacity={sparkleA}>
        <path d="M 0 -8 L 2 -2 L 8 0 L 2 2 L 0 8 L -2 2 L -8 0 L -2 -2 Z" fill="#ffffff" />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 140,
  Component: MarsGreenhouseDome,
};
