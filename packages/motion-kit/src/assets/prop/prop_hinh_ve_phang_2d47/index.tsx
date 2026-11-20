import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const CX = 0;
const CY = -232;
const RADII = [20, 36, 52];

const arcPath = (r: number, a1: number, a2: number): string => {
  const d1 = (a1 * Math.PI) / 180;
  const d2 = (a2 * Math.PI) / 180;
  const x1 = CX + r * Math.cos(d1);
  const y1 = CY + r * Math.sin(d1);
  const x2 = CX + r * Math.cos(d2);
  const y2 = CY + r * Math.sin(d2);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
};

/** Cột ăng-ten nhà mạng phát sóng wifi: các vòng sóng tỏa ra và nhấp nháy theo nhịp, đèn đỏ trên đỉnh chớp. */
const AntennaTower: FC<PropProps> = ({ frame, seed }) => {
  const sway = 1.2 * wobble(frame, seed, 90);
  const cycle = (frame % 48) / 48;
  const blink = cycle < 0.5 ? easing.inOut(cycle * 2) : easing.inOut((1 - cycle) * 2);
  const waves = RADII.map((r, i) => {
    let p = (frame / 45 - i * 0.22) % 1;
    if (p < 0) p += 1;
    const pulse = p < 0.35 ? easing.out(p / 0.35) : 1 - easing.inOut((p - 0.35) / 0.65);
    return { r, i, op: 0.2 + 0.8 * pulse, w: 5 + 2 * pulse };
  });
  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-tower-metal" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#E3E9F0" />
          <stop offset="0.5" stopColor={PALETTE.metal} />
          <stop offset="1" stopColor={PALETTE.metalDark} />
        </linearGradient>
        <radialGradient id="mk-gen-tower-light" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFE3E3" />
          <stop offset="1" stopColor={PALETTE.alert} stopOpacity={0} />
        </radialGradient>
      </defs>
      <ContactShadow halfWidth={62} />
      {/* base slab */}
      <rect x={-56} y={-14} width={112} height={14} rx={6} fill={PALETTE.metalDark} stroke={ink} strokeWidth={5} />
      <rect x={-50} y={-12} width={50} height={4} rx={2} fill="#FFFFFF" opacity={0.3} />
      <g transform={`rotate(${sway.toFixed(2)} 0 -14)`}>
        {/* lattice legs */}
        <path d="M -40 -14 L -10 -200 L 10 -200 L 40 -14 Z" fill="url(#mk-gen-tower-metal)" opacity={0.35} />
        <line x1={-40} y1={-14} x2={-10} y2={-200} stroke={ink} strokeWidth={7} strokeLinecap="round" />
        <line x1={40} y1={-14} x2={10} y2={-200} stroke={ink} strokeWidth={7} strokeLinecap="round" />
        <line x1={-37} y1={-24} x2={-9} y2={-196} stroke={PALETTE.metal} strokeWidth={3} strokeLinecap="round" />
        <line x1={37} y1={-24} x2={9} y2={-196} stroke={PALETTE.metalDark} strokeWidth={3} strokeLinecap="round" />
        {/* cross bracing */}
        <path
          d="M -37 -30 L 31 -70 M 37 -30 L -31 -70 M -31 -70 L 25 -110 M 31 -70 L -25 -110 M -25 -110 L 19 -150 M 25 -110 L -19 -150 M -19 -150 L 12 -190 M 19 -150 L -12 -190"
          stroke={ink}
          strokeWidth={4}
          strokeLinecap="round"
          fill="none"
        />
        <path d="M -31 -70 L 31 -70 M -25 -110 L 25 -110 M -19 -150 L 19 -150" stroke={ink} strokeWidth={5} strokeLinecap="round" />
        {/* platform */}
        <rect x={-24} y={-208} width={48} height={12} rx={4} fill="url(#mk-gen-tower-metal)" stroke={ink} strokeWidth={5} />
        {/* side panels */}
        <rect x={-34} y={-190} width={12} height={30} rx={4} fill={PALETTE.shieldLight} stroke={ink} strokeWidth={4} />
        <rect x={22} y={-190} width={12} height={30} rx={4} fill={PALETTE.shield} stroke={ink} strokeWidth={4} />
        <rect x={-31} y={-186} width={3} height={20} rx={1.5} fill="#FFFFFF" opacity={0.6} />
        {/* mast */}
        <rect x={-4} y={-232} width={8} height={26} rx={3} fill={PALETTE.metal} stroke={ink} strokeWidth={4} />
        {/* rivets */}
        <circle cx={-14} cy={-202} r={2.5} fill={ink} />
        <circle cx={14} cy={-202} r={2.5} fill={ink} />
        {/* beacon */}
        <circle cx={CX} cy={CY} r={18} fill="url(#mk-gen-tower-light)" opacity={0.3 + 0.7 * blink} />
        <circle cx={CX} cy={CY} r={8} fill={PALETTE.alert} stroke={ink} strokeWidth={4} />
        <circle cx={CX} cy={CY} r={5} fill="#FF8A8A" opacity={blink} />
        <circle cx={CX - 2.5} cy={CY - 2.5} r={2} fill="#FFFFFF" opacity={0.85} />
        {/* wifi waves */}
        {waves.map(({ r, i, op, w }) => (
          <g key={i} opacity={op}>
            <path d={arcPath(r, -40, 40)} stroke={PALETTE.screen} strokeWidth={w + 4} strokeLinecap="round" fill="none" opacity={0.3} />
            <path d={arcPath(r, -40, 40)} stroke={PALETTE.screen} strokeWidth={w} strokeLinecap="round" fill="none" />
            <path d={arcPath(r, 140, 220)} stroke={PALETTE.screen} strokeWidth={w + 4} strokeLinecap="round" fill="none" opacity={0.3} />
            <path d={arcPath(r, 140, 220)} stroke={PALETTE.screen} strokeWidth={w} strokeLinecap="round" fill="none" />
          </g>
        ))}
        {/* sparkle */}
        <circle cx={0} cy={-268} r={3 + 2 * blink} fill={PALETTE.warn} opacity={0.4 + 0.6 * blink} />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 80,
  height: 290,
  Component: AntennaTower,
};
