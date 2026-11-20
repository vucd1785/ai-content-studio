import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { clamp, easing, lerp, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const CY = -95;

type Trace = { ax: number; ay: number; bx: number; by: number; ex: number; ey: number };

const TRACES: Trace[] = [
  { ax: -20, ay: -10, bx: -30, by: -10, ex: -42, ey: -22 },
  { ax: -20, ay: 10, bx: -34, by: 10, ex: -34, ey: 40 },
  { ax: 20, ay: -10, bx: 32, by: -10, ex: 32, ey: -42 },
  { ax: 20, ay: 10, bx: 30, by: 10, ex: 42, ey: 22 },
  { ax: -8, ay: -20, bx: -8, by: -32, ex: -20, ey: -44 },
  { ax: 8, ay: -20, bx: 8, by: -30, ex: 20, ey: -42 },
  { ax: -8, ay: 20, bx: -8, by: 30, ex: -20, ey: 42 },
  { ax: 8, ay: 20, bx: 8, by: 34, ex: 18, ey: 44 },
];

const SIDE = [-36, -12, 12, 36];

/** Con chip mạch máy tính màu xanh: lõi phát sáng, đốm sáng chạy theo đường mạch từ tâm ra ngoài. */
const ChipCircuit: FC<PropProps> = ({ frame, seed }) => {
  const pulse = 0.5 + 0.5 * wobble(frame, seed, 30);
  const coreScale = 1 + 0.06 * easing.inOut(pulse);
  const sparkle = clamp(wobble(frame, seed + 3, 46), 0, 1);
  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-chip-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4a92e0" />
          <stop offset="1" stopColor="#173f7a" />
        </linearGradient>
        <radialGradient id="mk-gen-chip-core" cx="0.4" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#e6fbff" />
          <stop offset="1" stopColor="#5fd0f5" />
        </radialGradient>
      </defs>
      <ContactShadow halfWidth={66} />
      {SIDE.map((p) => (
        <g key={`pins-${p}`}>
          <rect x={p - 5} y={-44} width={10} height={36} rx={3} fill={PALETTE.metal} stroke={ink} strokeWidth={4} />
          <rect x={p - 8} y={-10} width={16} height={8} rx={3} fill={PALETTE.metalDark} stroke={ink} strokeWidth={3} />
          <rect x={p - 5} y={-166} width={10} height={20} rx={3} fill={PALETTE.metal} stroke={ink} strokeWidth={4} />
          <rect x={-72} y={CY + p - 5} width={20} height={10} rx={3} fill={PALETTE.metal} stroke={ink} strokeWidth={4} />
          <rect x={52} y={CY + p - 5} width={20} height={10} rx={3} fill={PALETTE.metal} stroke={ink} strokeWidth={4} />
        </g>
      ))}
      <rect x={-56} y={CY - 56} width={112} height={112} rx={14} fill="url(#mk-gen-chip-body)" stroke={ink} strokeWidth={7} />
      <rect x={-46} y={CY - 47} width={60} height={10} rx={5} fill="#ffffff" opacity={0.22} />
      <rect x={-46} y={CY + 30} width={92} height={18} rx={8} fill="#0b2550" opacity={0.25} />
      {TRACES.map((tr, i) => {
        const p = ((frame + i * 5) % 36) / 36;
        const s = easing.inOut(p);
        const first = s < 0.5;
        const k = first ? s * 2 : (s - 0.5) * 2;
        const dx = first ? lerp(tr.ax, tr.bx, k) : lerp(tr.bx, tr.ex, k);
        const dy = first ? lerp(tr.ay, tr.by, k) : lerp(tr.by, tr.ey, k);
        const padGlow = clamp((p - 0.75) / 0.25, 0, 1);
        const pts = `${tr.ax},${tr.ay + CY} ${tr.bx},${tr.by + CY} ${tr.ex},${tr.ey + CY}`;
        return (
          <g key={`tr-${i}`}>
            <polyline points={pts} fill="none" stroke="#0e2d5e" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={pts} fill="none" stroke="#7fe3ff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" opacity={0.55 + 0.35 * pulse} />
            <circle cx={tr.ex} cy={tr.ey + CY} r={9} fill="#c9f6ff" opacity={0.6 * padGlow} />
            <circle cx={tr.ex} cy={tr.ey + CY} r={4.5} fill={PALETTE.warn} stroke={ink} strokeWidth={2} />
            <circle cx={dx} cy={dy + CY} r={6} fill="#c9f6ff" opacity={0.45} />
            <circle cx={dx} cy={dy + CY} r={3} fill="#ffffff" />
          </g>
        );
      })}
      <g transform={`translate(0 ${CY}) scale(${coreScale.toFixed(3)})`}>
        <rect x={-30} y={-30} width={60} height={60} rx={10} fill="#7fe3ff" opacity={0.2 + 0.25 * pulse} />
        <rect x={-21} y={-21} width={42} height={42} rx={8} fill="url(#mk-gen-chip-core)" stroke={ink} strokeWidth={5} />
        <rect x={-15} y={-15} width={14} height={6} rx={3} fill="#ffffff" opacity={0.8} />
        <rect x={-10} y={-4} width={20} height={14} rx={3} fill="#3fb6e6" opacity={0.5 + 0.4 * pulse} />
      </g>
      <circle cx={-44} cy={CY - 44} r={4} fill={PALETTE.bitLight} stroke={ink} strokeWidth={2} />
      <g transform={`translate(-38 ${CY - 70}) scale(${(0.4 + 0.6 * sparkle).toFixed(3)})`} opacity={sparkle}>
        <path d="M0,-10 L3,-3 L10,0 L3,3 L0,10 L-3,3 L-10,0 L-3,-3 Z" fill="#ffffff" stroke={ink} strokeWidth={2} />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 80,
  height: 182,
  Component: ChipCircuit,
};
