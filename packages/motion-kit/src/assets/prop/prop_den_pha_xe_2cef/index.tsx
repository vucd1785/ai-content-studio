import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const RAYS = 12;

/** Một chùm tia sáng tỏa ra từ đèn pha, mỗi tia dài ngắn và nhấp nháy lệch pha. */
const Burst: FC<{ cx: number; cy: number; frame: number; seed: number; dir: number }> = ({
  cx,
  cy,
  frame,
  seed,
  dir,
}) => {
  const items = [];
  for (let i = 0; i < RAYS; i++) {
    const ang = ((i * 360) / RAYS + dir * 8 + 6 * wobble(frame, seed + i, 90)) * (Math.PI / 180);
    const raw = 0.5 + 0.5 * Math.sin(frame * 0.18 + i * 1.7 + seed);
    const p = easing.inOut(raw);
    const long = i % 2 === 0 ? 1 : 0.65;
    const r0 = 13;
    const r1 = r0 + (14 + 16 * p) * long;
    const x0 = cx + Math.cos(ang) * r0;
    const y0 = cy + Math.sin(ang) * r0;
    const x1 = cx + Math.cos(ang) * r1;
    const y1 = cy + Math.sin(ang) * r1;
    const op = 0.35 + 0.65 * p;
    items.push(
      <g key={i} opacity={op}>
        <line
          x1={x0.toFixed(2)}
          y1={y0.toFixed(2)}
          x2={x1.toFixed(2)}
          y2={y1.toFixed(2)}
          stroke="#fff3b0"
          strokeWidth={9}
          strokeLinecap="round"
          opacity={0.3}
        />
        <line
          x1={x0.toFixed(2)}
          y1={y0.toFixed(2)}
          x2={x1.toFixed(2)}
          y2={y1.toFixed(2)}
          stroke="#fffbe6"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <circle cx={x1.toFixed(2)} cy={y1.toFixed(2)} r={2.5 * p + 1} fill="#ffffff" />
      </g>,
    );
  }
  return <g>{items}</g>;
};

/** Mũi xe ô tô ban đêm, hai đèn pha tỏa tia sáng nhòe như pháo hoa, nhấp nháy lan ra. */
const CarHeadlights: FC<PropProps> = ({ frame, seed }) => {
  const pulse = 0.5 + 0.5 * Math.sin(frame * 0.12 + seed);
  const glowR = 22 + 6 * easing.inOut(pulse);
  const bob = 1.2 * wobble(frame, seed + 3, 60);
  const lx = -46;
  const rx = 46;
  const ly = -78;
  return (
    <g>
      <ContactShadow halfWidth={82} />
      <defs>
        <linearGradient id="mk-gen-carhl-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6f9be8" />
          <stop offset="0.55" stopColor="#3d6fd1" />
          <stop offset="1" stopColor="#28508f" />
        </linearGradient>
        <radialGradient id="mk-gen-carhl-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffffff" stopOpacity={0.95} />
          <stop offset="0.4" stopColor="#fff3b0" stopOpacity={0.7} />
          <stop offset="1" stopColor="#ffd84d" stopOpacity={0} />
        </radialGradient>
      </defs>
      {/* bánh xe */}
      <rect x={-72} y={-34} width={30} height={34} rx={9} fill="#2a2a35" stroke={ink} strokeWidth={5} />
      <rect x={42} y={-34} width={30} height={34} rx={9} fill="#2a2a35" stroke={ink} strokeWidth={5} />
      <g transform={`translate(0 ${bob.toFixed(2)})`}>
        {/* cabin */}
        <path
          d="M -54 -112 L -40 -164 Q -36 -172 -26 -172 L 26 -172 Q 36 -172 40 -164 L 54 -112 Z"
          fill="url(#mk-gen-carhl-body)"
          stroke={ink}
          strokeWidth={6}
          strokeLinejoin="round"
        />
        {/* kính chắn gió */}
        <path
          d="M -42 -116 L -32 -158 L 32 -158 L 42 -116 Z"
          fill="#1f2d4d"
          stroke={ink}
          strokeWidth={4}
          strokeLinejoin="round"
        />
        <path d="M -28 -152 L -20 -152 L -30 -122 L -37 -122 Z" fill="#8fb4ff" opacity={0.45} />
        <path d="M -14 -152 L -9 -152 L -18 -126 L -22 -126 Z" fill="#8fb4ff" opacity={0.3} />
        {/* thân xe */}
        <rect
          x={-80}
          y={-118}
          width={160}
          height={88}
          rx={22}
          fill="url(#mk-gen-carhl-body)"
          stroke={ink}
          strokeWidth={6}
        />
        {/* vệt sáng trên nắp capo và bóng dưới */}
        <rect x={-66} y={-112} width={70} height={8} rx={4} fill="#ffffff" opacity={0.3} />
        <rect x={-74} y={-50} width={148} height={14} rx={7} fill="#1a2f5c" opacity={0.35} />
        {/* lưới tản nhiệt */}
        <rect x={-24} y={-90} width={48} height={24} rx={7} fill="#24324f" stroke={ink} strokeWidth={4} />
        <line x1={-16} y1={-78} x2={16} y2={-78} stroke={PALETTE.metal} strokeWidth={3} strokeLinecap="round" />
        <line x1={-16} y1={-71} x2={16} y2={-71} stroke={PALETTE.metal} strokeWidth={3} strokeLinecap="round" />
        <line x1={-16} y1={-85} x2={16} y2={-85} stroke={PALETTE.metal} strokeWidth={3} strokeLinecap="round" />
        {/* cản trước */}
        <rect x={-70} y={-46} width={140} height={14} rx={7} fill={PALETTE.metal} stroke={ink} strokeWidth={5} />
        <rect x={-62} y={-44} width={60} height={4} rx={2} fill="#ffffff" opacity={0.5} />
        {/* biển số trống */}
        <rect x={-18} y={-58} width={36} height={12} rx={3} fill={PALETTE.paper} stroke={ink} strokeWidth={3} />
        {/* quầng sáng đèn */}
        <circle cx={lx} cy={ly} r={glowR} fill="url(#mk-gen-carhl-glow)" />
        <circle cx={rx} cy={ly} r={glowR} fill="url(#mk-gen-carhl-glow)" />
        {/* đèn pha */}
        <ellipse cx={lx} cy={ly} rx={15} ry={12} fill="#fff3b0" stroke={ink} strokeWidth={5} />
        <ellipse cx={rx} cy={ly} rx={15} ry={12} fill="#fff3b0" stroke={ink} strokeWidth={5} />
        <circle cx={lx} cy={ly} r={6 + 2 * pulse} fill="#ffffff" />
        <circle cx={rx} cy={ly} r={6 + 2 * pulse} fill="#ffffff" />
        <circle cx={lx - 5} cy={ly - 4} r={2.5} fill="#ffffff" opacity={0.9} />
        <circle cx={rx - 5} cy={ly - 4} r={2.5} fill="#ffffff" opacity={0.9} />
        {/* tia sáng nhòe như pháo hoa */}
        <Burst cx={lx} cy={ly} frame={frame} seed={seed} dir={-1} />
        <Burst cx={rx} cy={ly} frame={frame} seed={seed + 11} dir={1} />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 180,
  Component: CarHeadlights,
};
