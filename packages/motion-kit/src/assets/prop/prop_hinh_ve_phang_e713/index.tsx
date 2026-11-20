import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

const BRAIN =
  "M -58 10 C -66 -10 -56 -34 -38 -38 C -34 -54 -12 -58 0 -48 C 12 -60 36 -54 40 -38 C 58 -36 66 -12 58 6 C 64 22 50 42 32 40 C 22 52 -2 50 -8 42 C -24 50 -46 44 -46 30 C -60 28 -64 18 -58 10 Z";

const star = (r: number) =>
  `M 0 ${-r} Q ${r * 0.18} ${-r * 0.18} ${r} 0 Q ${r * 0.18} ${r * 0.18} 0 ${r} Q ${-r * 0.18} ${r * 0.18} ${-r} 0 Q ${-r * 0.18} ${-r * 0.18} 0 ${-r} Z`;

const SPARKLES = [
  { x: -70, y: -168, r: 10, off: 0 },
  { x: -46, y: -206, r: 8, off: 11 },
  { x: 22, y: -214, r: 11, off: 23 },
  { x: 70, y: -186, r: 9, off: 34 },
  { x: -76, y: -120, r: 7, off: 17 },
];

/** Bộ não hồng dễ thương cầm chổi quét bụi xám ra ngoài, xung quanh lấp lánh khi sạch. */
const BrainSweeping: FC<PropProps> = ({ frame, seed }) => {
  const period = 36;
  const phase = (frame % period) / period;
  const sweep = Math.sin(phase * Math.PI * 2);
  const broomAngle = 9 * sweep;
  const bob = Math.abs(Math.sin(phase * Math.PI * 2)) * 3;
  const squash = 1 - 0.03 * Math.abs(sweep);
  const lean = 3 * sweep + 1.5 * wobble(frame, seed, 80);
  const blink = frame % 90 < 4 ? 0.15 : 1;

  const dust = [0, 1, 2, 3].map((i) => {
    const p = ((frame + i * 9) % period) / period;
    const e = easing.out(p);
    return {
      x: 50 + 34 * e,
      y: -8 - 14 * Math.sin(p * Math.PI) - i * 2,
      r: 4 + (i % 2) * 1.5,
      o: 0.9 * (1 - p),
    };
  });

  return (
    <g>
      <defs>
        <radialGradient id="mk-gen-brain-fill" cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#ffd0de" />
          <stop offset="0.6" stopColor="#f99bb8" />
          <stop offset="1" stopColor="#e2708f" />
        </radialGradient>
      </defs>
      <ContactShadow halfWidth={70} />

      {/* dust flying out */}
      {dust.map((d, i) => (
        <g key={`d${i}`} opacity={d.o}>
          <circle cx={d.x} cy={d.y} r={d.r} fill={PALETTE.smoke} stroke={ink} strokeWidth={2} />
          <circle cx={d.x - 1.5} cy={d.y - 1.5} r={d.r * 0.35} fill="#ffffff" opacity={0.5} />
        </g>
      ))}

      {/* legs */}
      <path d="M -18 -82 L -20 -10" stroke={ink} strokeWidth={7} strokeLinecap="round" fill="none" />
      <path d="M 16 -82 L 18 -10" stroke={ink} strokeWidth={7} strokeLinecap="round" fill="none" />
      <ellipse cx={-24} cy={-8} rx={12} ry={7} fill="#e2708f" stroke={ink} strokeWidth={4} />
      <ellipse cx={22} cy={-8} rx={12} ry={7} fill="#e2708f" stroke={ink} strokeWidth={4} />

      {/* body */}
      <g transform={`translate(0 ${(-122 + bob).toFixed(2)}) rotate(${lean.toFixed(2)}) scale(${(2 - squash).toFixed(3)} ${squash.toFixed(3)})`}>
        {/* left arm */}
        <path d="M -52 14 Q -70 24 -64 40" stroke={ink} strokeWidth={6} strokeLinecap="round" fill="none" />
        <circle cx={-64} cy={42} r={6} fill="#f99bb8" stroke={ink} strokeWidth={3} />

        <path d={BRAIN} fill="url(#mk-gen-brain-fill)" stroke={ink} strokeWidth={6} strokeLinejoin="round" />
        {/* shade layer bottom-right */}
        <path d="M 58 6 C 64 22 50 42 32 40 C 22 52 -2 50 -8 42 C 10 40 40 30 58 6 Z" fill="#c9557a" opacity={0.35} />
        {/* gyri */}
        <path d="M 0 -48 C -5 -32 6 -24 0 -10" stroke="#c9557a" strokeWidth={4} strokeLinecap="round" fill="none" />
        <path d="M -38 -38 C -30 -28 -40 -18 -30 -10" stroke="#c9557a" strokeWidth={4} strokeLinecap="round" fill="none" />
        <path d="M 40 -38 C 30 -30 42 -20 32 -12" stroke="#c9557a" strokeWidth={4} strokeLinecap="round" fill="none" />
        <path d="M -52 14 C -44 10 -40 18 -32 14" stroke="#c9557a" strokeWidth={4} strokeLinecap="round" fill="none" />
        <path d="M 50 18 C 42 14 38 22 30 18" stroke="#c9557a" strokeWidth={4} strokeLinecap="round" fill="none" />
        {/* highlight top-left */}
        <ellipse cx={-28} cy={-36} rx={16} ry={8} fill="#ffffff" opacity={0.55} transform="rotate(-25 -28 -36)" />
        <circle cx={-46} cy={-20} r={4} fill="#ffffff" opacity={0.6} />

        {/* face */}
        <ellipse cx={-14} cy={6} rx={5} ry={7 * blink} fill={ink} />
        <ellipse cx={14} cy={6} rx={5} ry={7 * blink} fill={ink} />
        <circle cx={-12} cy={3} r={1.8} fill="#ffffff" opacity={blink} />
        <circle cx={16} cy={3} r={1.8} fill="#ffffff" opacity={blink} />
        <ellipse cx={-28} cy={18} rx={7} ry={4} fill={PALETTE.alert} opacity={0.4} />
        <ellipse cx={28} cy={18} rx={7} ry={4} fill={PALETTE.alert} opacity={0.4} />
        <path d="M -8 20 Q 0 28 8 20" stroke={ink} strokeWidth={4} strokeLinecap="round" fill="none" />
      </g>

      {/* broom, pivot at the hand */}
      <g transform={`translate(44 ${(-100 + bob).toFixed(2)}) rotate(${broomAngle.toFixed(2)})`}>
        <path d="M 0 0 L 14 76" stroke={PALETTE.woodDark} strokeWidth={9} strokeLinecap="round" />
        <path d="M 0 0 L 14 76" stroke={PALETTE.wood} strokeWidth={4} strokeLinecap="round" />
        <rect x={6} y={70} width={18} height={10} rx={3} fill={PALETTE.accent} stroke={ink} strokeWidth={3} transform="rotate(-10 15 75)" />
        <path d="M 6 80 L 26 76 L 34 98 L 2 100 Z" fill={PALETTE.warn} stroke={ink} strokeWidth={4} strokeLinejoin="round" />
        <path d="M 10 84 L 8 98 M 17 82 L 17 98 M 24 80 L 27 97" stroke={PALETTE.woodDark} strokeWidth={2} strokeLinecap="round" />
        <path d="M 8 82 L 6 96" stroke="#ffffff" strokeWidth={2} opacity={0.5} strokeLinecap="round" />
        {/* right hand */}
        <circle cx={0} cy={0} r={7} fill="#f99bb8" stroke={ink} strokeWidth={3} />
      </g>
      <path
        d={`M 54 ${(-112 + bob).toFixed(2)} Q 52 ${(-104 + bob).toFixed(2)} 46 ${(-100 + bob).toFixed(2)}`}
        stroke={ink}
        strokeWidth={6}
        strokeLinecap="round"
        fill="none"
      />

      {/* sparkles */}
      {SPARKLES.map((s, i) => {
        const p = ((frame + s.off) % 45) / 45;
        const pulse = Math.sin(p * Math.PI);
        const sc = 0.4 + 0.6 * easing.inOut(pulse);
        return (
          <g key={`s${i}`} transform={`translate(${s.x} ${s.y}) scale(${sc.toFixed(3)}) rotate(${(p * 40).toFixed(1)})`} opacity={0.3 + 0.7 * pulse}>
            <path d={star(s.r)} fill="#fff6b0" stroke={PALETTE.warn} strokeWidth={2} />
            <circle cx={0} cy={0} r={s.r * 0.25} fill="#ffffff" />
          </g>
        );
      })}
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 228,
  Component: BrainSweeping,
};
