import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const LEATHER = "#3d4466";
const LEATHER_LIGHT = "#6a74a6";
const LEATHER_DARK = "#252a42";
const BEAM = "#fff1b8";

const swingAt = (frame: number, offset: number): number => {
  const period = 120;
  const p = (((frame - offset) % period) + period) % period / period;
  const tri = p < 0.5 ? p * 2 : 2 - p * 2;
  return easing.inOut(tri) * 2 - 1;
};

/** Ghế giám đốc lưng cao đang trống dưới đèn rọi, xoay nhẹ qua lại. */
const EmptyCeoChair: FC<PropProps> = ({ frame, seed }) => {
  const sw = swingAt(frame, 0);
  const lag = swingAt(frame, 8);
  const turn = 1 - 0.1 * Math.abs(sw);
  const shift = 5 * sw;
  const armShift = 6 * lag;
  const pulse = 0.5 + 0.5 * wobble(frame, seed, 50);
  const beamOp = 0.32 + 0.12 * pulse;
  const dust = [0, 1, 2, 3].map((i) => {
    const ph = ((frame * 0.6 + i * 45) % 180) / 180;
    return {
      x: -40 + i * 26 + 6 * wobble(frame, seed + i * 3, 70),
      y: -270 + ph * 220,
      o: Math.sin(ph * Math.PI) * 0.8,
    };
  });
  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-ceo-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={BEAM} stopOpacity={0.95} />
          <stop offset="1" stopColor={BEAM} stopOpacity={0.15} />
        </linearGradient>
        <linearGradient id="mk-gen-ceo-leather" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={LEATHER_LIGHT} />
          <stop offset="0.45" stopColor={LEATHER} />
          <stop offset="1" stopColor={LEATHER_DARK} />
        </linearGradient>
      </defs>
      {/* spotlight beam */}
      <polygon points="-16,-282 16,-282 76,-14 -76,-14" fill="url(#mk-gen-ceo-beam)" opacity={beamOp} />
      <ellipse cx={0} cy={-8} rx={76} ry={12} fill={BEAM} opacity={0.35 + 0.2 * pulse} />
      {/* lamp */}
      <rect x={-4} y={-300} width={8} height={10} fill={PALETTE.metalDark} stroke={ink} strokeWidth={3} />
      <path d="M -22 -280 Q -22 -294 0 -294 Q 22 -294 22 -280 Z" fill={PALETTE.metal} stroke={ink} strokeWidth={5} strokeLinejoin="round" />
      <ellipse cx={0} cy={-280} rx={16} ry={4} fill={BEAM} opacity={0.7 + 0.3 * pulse} />
      <path d="M -14 -287 Q -8 -292 0 -292" stroke={PALETTE.paper} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.7} />
      <ContactShadow halfWidth={66} />
      {/* star base */}
      <path d="M 0 -24 L -60 -12 M 0 -24 L 60 -12 M 0 -24 L -26 -8 M 0 -24 L 26 -8" stroke={ink} strokeWidth={11} strokeLinecap="round" />
      <path d="M 0 -24 L -60 -12 M 0 -24 L 60 -12 M 0 -24 L -26 -8 M 0 -24 L 26 -8" stroke={PALETTE.metalDark} strokeWidth={5} strokeLinecap="round" />
      {[-60, -26, 26, 60].map((x) => (
        <circle key={x} cx={x} cy={-7} r={6} fill={ink} />
      ))}
      {/* gas pole */}
      <rect x={-7} y={-92} width={14} height={70} rx={4} fill={PALETTE.metal} stroke={ink} strokeWidth={5} />
      <rect x={-4} y={-88} width={3} height={60} fill={PALETTE.paper} opacity={0.6} />
      {/* swivel group */}
      <g transform={`translate(${shift.toFixed(2)} 0) scale(${turn.toFixed(3)} 1)`}>
        {/* high back */}
        <path
          d="M -46 -116 L -50 -228 Q -50 -262 0 -264 Q 50 -262 50 -228 L 46 -116 Z"
          fill="url(#mk-gen-ceo-leather)"
          stroke={ink}
          strokeWidth={6}
          strokeLinejoin="round"
        />
        {/* headrest seam */}
        <path d="M -42 -218 Q 0 -226 42 -218" stroke={LEATHER_DARK} strokeWidth={4} fill="none" strokeLinecap="round" />
        {/* tufting buttons */}
        {[-20, 0, 20].map((x) =>
          [-196, -164, -136].map((y) => (
            <circle key={`${x}${y}`} cx={x + (y === -164 ? 10 : 0)} cy={y} r={3} fill={LEATHER_DARK} />
          )),
        )}
        {/* highlight + shade layers */}
        <path d="M -38 -230 Q -38 -252 -10 -254" stroke={PALETTE.paper} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.55} />
        <path d="M -40 -200 L -38 -130" stroke={PALETTE.paper} strokeWidth={4} strokeLinecap="round" opacity={0.3} />
        <path d="M 30 -240 Q 44 -232 44 -210 L 40 -122 L 28 -122 Z" fill={LEATHER_DARK} opacity={0.4} />
        {/* seat */}
        <rect x={-54} y={-114} width={108} height={28} rx={14} fill="url(#mk-gen-ceo-leather)" stroke={ink} strokeWidth={6} />
        <path d="M -42 -106 L 20 -106" stroke={PALETTE.paper} strokeWidth={4} strokeLinecap="round" opacity={0.45} />
        <rect x={-50} y={-96} width={100} height={8} rx={4} fill={LEATHER_DARK} opacity={0.45} />
      </g>
      {/* armrests with follow-through */}
      <g transform={`translate(${armShift.toFixed(2)} 0) scale(${turn.toFixed(3)} 1)`}>
        <path d="M -60 -118 L -60 -98" stroke={ink} strokeWidth={9} strokeLinecap="round" />
        <path d="M 60 -118 L 60 -98" stroke={ink} strokeWidth={9} strokeLinecap="round" />
        <rect x={-72} y={-130} width={30} height={14} rx={7} fill={LEATHER} stroke={ink} strokeWidth={5} />
        <rect x={42} y={-130} width={30} height={14} rx={7} fill={LEATHER_DARK} stroke={ink} strokeWidth={5} />
        <path d="M -66 -125 L -50 -125" stroke={PALETTE.paper} strokeWidth={3} strokeLinecap="round" opacity={0.5} />
      </g>
      {/* floating dust in beam */}
      {dust.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={2.5} fill={PALETTE.paper} opacity={d.o} />
      ))}
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 80,
  height: 300,
  Component: EmptyCeoChair,
};
