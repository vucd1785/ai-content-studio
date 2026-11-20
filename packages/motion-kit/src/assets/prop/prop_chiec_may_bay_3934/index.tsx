import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

const starPath = (cx: number, cy: number, r: number): string => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(2)},${(cy + Math.sin(a) * rr).toFixed(2)}`);
  }
  return `M${pts.join(" L")} Z`;
};

/** Máy bay chở khách trắng lộn nhào cắm vào thùng rác, có vệt chuyển động và sao bật ra. */
const PlaneInTrash: FC<PropProps> = ({ frame, seed }) => {
  const cycle = (frame % 48) / 48;
  const bounce = easing.out(cycle);
  const rot = 48 + 10 * wobble(frame, seed, 40);
  const bob = 4 * wobble(frame, seed + 3, 30);
  const lidRot = -32 - 8 * Math.abs(Math.sin(frame * 0.18));
  const squash = 1 + 0.03 * Math.sin(frame * 0.18);
  const streak = 0.45 + 0.35 * (0.5 + 0.5 * wobble(frame, seed + 9, 16));
  const starA = 1 - bounce;
  const stars = [
    { x: -58, y: -150, r: 9, d: 0 },
    { x: 62, y: -146, r: 8, d: 0.33 },
    { x: 48, y: -188, r: 6, d: 0.66 },
  ];
  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-bin-3934" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c9d3dc" />
          <stop offset="0.5" stopColor={PALETTE.metal} />
          <stop offset="1" stopColor={PALETTE.metalDark} />
        </linearGradient>
        <linearGradient id="mk-gen-plane-3934" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d6dde6" />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={62} />

      {/* motion streaks */}
      <g opacity={streak} stroke={ink} strokeWidth={4} strokeLinecap="round" fill="none">
        <path d="M -78 -250 Q -50 -240 -30 -215" />
        <path d="M -84 -222 Q -60 -214 -44 -194" />
        <path d="M -62 -262 Q -36 -256 -18 -232" />
      </g>

      {/* plane, nose into bin */}
      <g transform={`translate(8 ${(-170 + bob).toFixed(2)}) rotate(${rot.toFixed(2)})`}>
        <path d="M -42 -4 L -58 -30 L -46 -30 L -28 -6 Z" fill="#e8eef4" stroke={ink} strokeWidth={4} strokeLinejoin="round" />
        <path d="M -6 2 L -22 34 L -8 34 L 16 4 Z" fill="#dfe6ee" stroke={ink} strokeWidth={4} strokeLinejoin="round" />
        <rect x={-52} y={-11} width={104} height={22} rx={11} fill="url(#mk-gen-plane-3934)" stroke={ink} strokeWidth={5} />
        <rect x={-40} y={2} width={86} height={5} rx={2.5} fill={PALETTE.accent} />
        <rect x={-40} y={-8} width={70} height={4} rx={2} fill="#ffffff" opacity={0.8} />
        <circle cx={-24} cy={-3} r={2.6} fill={PALETTE.screen} />
        <circle cx={-12} cy={-3} r={2.6} fill={PALETTE.screen} />
        <circle cx={0} cy={-3} r={2.6} fill={PALETTE.screen} />
        <circle cx={12} cy={-3} r={2.6} fill={PALETTE.screen} />
        <path d="M 36 -6 Q 46 -6 49 0 L 36 0 Z" fill={PALETTE.screen} stroke={ink} strokeWidth={2} />
        <path d="M -8 -4 L -20 -26 L -8 -26 L 12 -6 Z" fill="#cfd8e2" stroke={ink} strokeWidth={4} strokeLinejoin="round" />
      </g>

      {/* bin body */}
      <g transform={`translate(0 0) scale(${(1 / squash).toFixed(3)} ${squash.toFixed(3)})`}>
        <path d="M -48 -118 L 48 -118 L 40 -4 Q 40 0 36 0 L -36 0 Q -40 0 -40 -4 Z" fill="url(#mk-gen-bin-3934)" stroke={ink} strokeWidth={6} strokeLinejoin="round" />
        <path d="M -24 -104 L -21 -16" stroke={PALETTE.metalDark} strokeWidth={5} strokeLinecap="round" />
        <path d="M 0 -104 L 0 -16" stroke={PALETTE.metalDark} strokeWidth={5} strokeLinecap="round" />
        <path d="M 24 -104 L 21 -16" stroke={PALETTE.metalDark} strokeWidth={5} strokeLinecap="round" />
        <path d="M -40 -110 L -34 -12" stroke="#ffffff" strokeWidth={5} strokeLinecap="round" opacity={0.5} />
        <path d="M 30 -110 L 26 -10 L 36 -10 L 42 -110 Z" fill={ink} opacity={0.15} />
        <rect x={-54} y={-126} width={108} height={14} rx={6} fill={PALETTE.metal} stroke={ink} strokeWidth={5} />
        {/* plane tail sticking edge overlap cover */}
        <path d="M -20 -126 L 34 -126" stroke={ink} strokeWidth={3} opacity={0.3} />
      </g>

      {/* lid, popped open */}
      <g transform={`translate(-54 -128) rotate(${lidRot.toFixed(2)})`}>
        <rect x={0} y={-12} width={104} height={12} rx={6} fill={PALETTE.metal} stroke={ink} strokeWidth={5} />
        <rect x={40} y={-22} width={24} height={10} rx={5} fill={PALETTE.metalDark} stroke={ink} strokeWidth={4} />
        <rect x={6} y={-9} width={60} height={3} rx={1.5} fill="#ffffff" opacity={0.6} />
      </g>

      {/* stars popping */}
      {stars.map((s, i) => {
        const p = (cycle + s.d) % 1;
        const k = easing.outBack(1.6)(Math.min(1, p * 2.5));
        const fade = 1 - p;
        const dx = s.x * 0.12 * p;
        return (
          <path
            key={i}
            d={starPath(s.x + dx, s.y - 14 * p, s.r * (0.4 + 0.6 * k))}
            fill={PALETTE.warn}
            stroke={ink}
            strokeWidth={3}
            strokeLinejoin="round"
            opacity={Math.max(0, fade) * 0.9 + 0.1 * starA}
          />
        );
      })}
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 290,
  Component: PlaneInTrash,
};
