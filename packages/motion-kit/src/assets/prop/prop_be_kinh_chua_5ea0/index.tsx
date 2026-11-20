import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, rnd, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

/** Bể kính chứa chất lỏng làm mát, ngâm tủ máy chủ đèn xanh nhấp nháy, bọt khí nổi lên. */
const ImmersionTank: FC<PropProps> = ({ frame, seed }) => {
  const surfaceY = -200;
  const pts: string[] = [];
  for (let x = -64; x <= 64; x += 8) {
    const y = surfaceY + 3 * Math.sin(frame * 0.08 + x * 0.07) + 1.5 * wobble(frame, seed + 3, 90);
    pts.push(`${x} ${y.toFixed(2)}`);
  }
  const liquidPath = `M -64 -24 L ${pts.join(" L ")} L 64 -24 Z`;
  const surfaceLine = `M ${pts.join(" L ")}`;

  const glow = 0.5 + 0.5 * wobble(frame, seed + 11, 40);

  const bubbles = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
    const period = 70 + Math.floor(rnd(seed, i) * 50);
    const offset = Math.floor(rnd(seed + 5, i) * period);
    const p = ((frame + offset) % period) / period;
    const rise = easing.in(p) * 0.35 + p * 0.65;
    const baseX = -56 + rnd(seed + 9, i) * 112;
    const x = baseX + 4 * Math.sin(frame * 0.15 + i * 1.3);
    const y = -30 + (surfaceY + 8 - -30) * rise;
    const r = 2.5 + rnd(seed + 13, i) * 3.5 + p * 1.5;
    const op = p > 0.9 ? (1 - p) * 10 : Math.min(1, p * 8);
    return { x, y, r, op, i };
  });

  const rows = [0, 1, 2, 3, 4, 5];

  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-tank-liquid" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8FE8F2" stopOpacity={0.85} />
          <stop offset="1" stopColor="#2FA7C4" stopOpacity={0.9} />
        </linearGradient>
        <linearGradient id="mk-gen-tank-rack" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={PALETTE.metal} />
          <stop offset="1" stopColor={PALETTE.metalDark} />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={80} />

      {/* đế bể */}
      <rect x={-78} y={-24} width={156} height={22} rx={6} fill={PALETTE.metalDark} stroke={ink} strokeWidth={6} />
      <rect x={-70} y={-20} width={60} height={5} rx={2.5} fill="#ffffff" opacity={0.25} />
      <circle cx={-62} cy={-12} r={3} fill={ink} />
      <circle cx={62} cy={-12} r={3} fill={ink} />

      {/* lòng bể phía sau */}
      <rect x={-68} y={-232} width={136} height={210} rx={8} fill="#DFF6FA" opacity={0.55} />

      {/* tủ máy chủ */}
      <rect x={-34} y={-186} width={68} height={160} rx={6} fill="url(#mk-gen-tank-rack)" stroke={ink} strokeWidth={5} />
      <rect x={-28} y={-180} width={6} height={148} rx={3} fill="#ffffff" opacity={0.3} />
      {rows.map((r) => {
        const y = -176 + r * 24;
        const blinkA = Math.sin(frame * 0.35 + r * 1.9 + seed) > -0.2 ? 1 : 0.25;
        const blinkB = Math.sin(frame * 0.22 + r * 2.7 + seed * 0.5) > 0.1 ? 1 : 0.25;
        return (
          <g key={r}>
            <rect x={-26} y={y} width={52} height={18} rx={3} fill={PALETTE.metalDark} stroke={ink} strokeWidth={2.5} />
            <line x1={-20} y1={y + 9} x2={4} y2={y + 9} stroke={ink} strokeWidth={2} strokeLinecap="round" opacity={0.6} />
            <circle cx={12} cy={y + 9} r={6} fill={PALETTE.ok} opacity={0.35 * blinkA * glow} />
            <circle cx={12} cy={y + 9} r={3} fill={PALETTE.ok} opacity={blinkA} />
            <circle cx={20} cy={y + 9} r={3} fill="#B6FFB0" opacity={blinkB} />
          </g>
        );
      })}

      {/* chất lỏng */}
      <path d={liquidPath} fill="url(#mk-gen-tank-liquid)" opacity={0.55} />
      <path d={`M 20 -24 L 64 -24 L 64 ${surfaceY} L 40 ${surfaceY} Z`} fill="#1B7A99" opacity={0.18} />
      <path d={surfaceLine} fill="none" stroke="#E9FCFF" strokeWidth={3} strokeLinecap="round" opacity={0.9} />

      {/* ánh xanh lan trong nước */}
      <ellipse cx={0} cy={-110} rx={50} ry={80} fill={PALETTE.ok} opacity={0.08 + 0.07 * glow} />

      {/* bọt khí */}
      {bubbles.map((b) => (
        <g key={b.i} opacity={b.op}>
          <circle cx={b.x} cy={b.y} r={b.r} fill="#E9FCFF" fillOpacity={0.35} stroke="#ffffff" strokeWidth={1.8} />
          <circle cx={b.x - b.r * 0.35} cy={b.y - b.r * 0.35} r={Math.max(0.8, b.r * 0.3)} fill="#ffffff" />
        </g>
      ))}

      {/* thành kính */}
      <rect x={-68} y={-232} width={136} height={210} rx={8} fill="none" stroke={ink} strokeWidth={6} />
      <rect x={-60} y={-222} width={8} height={170} rx={4} fill="#ffffff" opacity={0.45} />
      <rect x={-46} y={-222} width={4} height={110} rx={2} fill="#ffffff" opacity={0.3} />
      <rect x={52} y={-222} width={8} height={190} rx={4} fill="#0E4E66" opacity={0.15} />

      {/* nắp viền trên */}
      <rect x={-76} y={-242} width={152} height={14} rx={6} fill={PALETTE.metal} stroke={ink} strokeWidth={5} />
      <rect x={-68} y={-239} width={70} height={4} rx={2} fill="#ffffff" opacity={0.45} />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 82,
  height: 246,
  Component: ImmersionTank,
};
