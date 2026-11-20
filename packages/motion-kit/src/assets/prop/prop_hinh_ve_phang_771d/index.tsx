import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, lerp, rnd, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";

const ink = PALETTE.ink;
const CY = -110;

const burst = (n: number, rIn: number, rOut: number, rot: number, seed: number): string => {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n;
    const jitter = 0.85 + 0.3 * rnd(seed, i);
    const r = (i % 2 === 0 ? rOut : rIn) * jitter;
    pts.push(`${(Math.cos(a) * r).toFixed(2)},${(CY + Math.sin(a) * r).toFixed(2)}`);
  }
  return pts.join(" ");
};

/** Tàu vũ trụ trắng nổ tung: quầng lửa cam vàng phập phồng, mảnh vỡ bay tỏa ra, hai nửa thân tàu trôi dạt. */
const ShipExplosion: FC<PropProps> = ({ frame, seed }) => {
  const pulse = 0.5 + 0.5 * wobble(frame, seed, 24);
  const s = lerp(0.94, 1.06, easing.inOut(pulse));
  const spin = frame * 0.004;
  const noseBob = wobble(frame, seed + 3, 50);
  const tailBob = wobble(frame, seed + 9, 56);

  const debris = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const p = ((frame + i * 9) % 60) / 60;
    const ang = (i * Math.PI * 2) / 7 + rnd(seed, i + 40) * 0.5;
    const d = lerp(34, 76, easing.out(p));
    const x = Math.cos(ang) * d;
    const y = CY + Math.sin(ang) * d * 0.95;
    const rot = p * 260 + i * 40;
    const col = i % 3 === 0 ? PALETTE.metalDark : i % 3 === 1 ? PALETTE.metal : "#F4F7FB";
    return (
      <g key={`d${i}`} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${rot.toFixed(1)})`} opacity={(1 - p * 0.9).toFixed(2)}>
        <polygon points="-6,-4 5,-6 7,3 -3,6" fill={col} stroke={ink} strokeWidth={3} strokeLinejoin="round" />
      </g>
    );
  });

  const sparks = [0, 1, 2, 3, 4].map((i) => {
    const tw = 0.5 + 0.5 * Math.sin(frame * 0.25 + i * 1.7);
    const ang = i * 1.3 + 0.4;
    const d = 60 + 18 * rnd(seed, i + 70);
    const x = Math.cos(ang) * d;
    const y = CY + Math.sin(ang) * d;
    const r = 3 + 4 * tw;
    return (
      <path
        key={`s${i}`}
        d={`M ${x.toFixed(1)} ${(y - r).toFixed(1)} L ${(x + r * 0.3).toFixed(1)} ${(y - r * 0.3).toFixed(1)} L ${(x + r).toFixed(1)} ${y.toFixed(1)} L ${(x + r * 0.3).toFixed(1)} ${(y + r * 0.3).toFixed(1)} L ${x.toFixed(1)} ${(y + r).toFixed(1)} L ${(x - r * 0.3).toFixed(1)} ${(y + r * 0.3).toFixed(1)} L ${(x - r).toFixed(1)} ${y.toFixed(1)} L ${(x - r * 0.3).toFixed(1)} ${(y - r * 0.3).toFixed(1)} Z`}
        fill="#FFF3B0"
        opacity={(0.4 + 0.6 * tw).toFixed(2)}
      />
    );
  });

  return (
    <g>
      <defs>
        <radialGradient id="mk-gen-blast-core" cx="0.42" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#FFFBE0" />
          <stop offset="0.5" stopColor="#FFD84A" />
          <stop offset="1" stopColor="#FFB020" />
        </radialGradient>
      </defs>

      {/* quầng sáng ngoài */}
      <circle cx={0} cy={CY} r={70} fill="#FF8A2A" opacity={(0.18 + 0.15 * pulse).toFixed(2)} />

      <g transform={`translate(0 ${CY}) scale(${s.toFixed(3)}) translate(0 ${-CY})`}>
        <polygon points={burst(11, 40, 62, spin, seed)} fill="#FF7A1F" stroke={ink} strokeWidth={6} strokeLinejoin="round" />
        <polygon points={burst(9, 30, 46, -spin * 1.5 + 0.3, seed + 5)} fill="url(#mk-gen-blast-core)" />
        <circle cx={-4} cy={CY - 4} r={18 + 4 * pulse} fill="#FFFBE0" opacity={0.85} />
        <ellipse cx={-14} cy={CY - 22} rx={12} ry={6} fill="#FFFFFF" opacity={0.5} transform={`rotate(-30 -14 ${CY - 22})`} />
        <ellipse cx={20} cy={CY + 20} rx={16} ry={8} fill="#D9480F" opacity={0.3} />
      </g>

      {debris}

      {/* nửa đuôi tàu */}
      <g transform={`translate(${(-54 + 3 * tailBob).toFixed(2)} ${(CY + 26 + 3 * tailBob).toFixed(2)}) rotate(${(-25 + 8 * tailBob).toFixed(1)})`}>
        <path d="M -6 -11 L -16 -25 L 2 -11 Z" fill={PALETTE.accent} stroke={ink} strokeWidth={4} strokeLinejoin="round" />
        <rect x={-24} y={-7} width={8} height={14} rx={2} fill={PALETTE.metalDark} stroke={ink} strokeWidth={4} />
        <path d="M 14 -11 L -10 -11 L -18 -4 L -18 4 L -10 11 L 14 11 L 8 5 L 16 0 L 8 -6 Z" fill="#F4F7FB" stroke={ink} strokeWidth={5} strokeLinejoin="round" />
        <path d="M -10 5 L 10 5 L 14 11 L -10 11 Z" fill={PALETTE.metal} opacity={0.6} />
        <rect x={-12} y={-8} width={14} height={3} rx={1.5} fill="#FFFFFF" opacity={0.9} />
        <circle cx={-4} cy={1} r={2.5} fill={PALETTE.metalDark} />
      </g>

      {/* nửa mũi tàu */}
      <g transform={`translate(${(52 + 3 * noseBob).toFixed(2)} ${(CY - 26 - 3 * noseBob).toFixed(2)}) rotate(${(22 + 10 * noseBob).toFixed(1)})`}>
        <path d="M -14 -12 L 8 -12 Q 25 0 8 12 L -14 12 L -8 6 L -16 0 L -8 -6 Z" fill="#F4F7FB" stroke={ink} strokeWidth={5} strokeLinejoin="round" />
        <path d="M -12 6 L 8 6 Q 16 6 18 4 Q 14 12 8 12 L -14 12 Z" fill={PALETTE.metal} opacity={0.6} />
        <circle cx={3} cy={-1} r={5.5} fill={PALETTE.screen} stroke={ink} strokeWidth={3} />
        <circle cx={1.5} cy={-2.5} r={1.8} fill="#FFFFFF" />
        <path d="M 12 -8 Q 20 -4 20 0" stroke={PALETTE.alert} strokeWidth={3} fill="none" strokeLinecap="round" />
      </g>

      {sparks}
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 200,
  Component: ShipExplosion,
};
