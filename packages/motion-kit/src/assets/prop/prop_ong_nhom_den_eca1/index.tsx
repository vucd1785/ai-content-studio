import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble, easing, clamp } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const body = "#2b2f3a";
const bodyLight = "#4b5266";
const bodyDark = "#1a1d25";

const Barrel: FC<{ dx: number; cy: number; shade: boolean; glint: number }> = ({
  dx,
  cy,
  shade,
  glint,
}) => {
  const fill = shade ? bodyDark : body;
  return (
    <g>
      <rect x={-64 + dx} y={cy - 11} width={20} height={22} rx={5} fill={fill} stroke={ink} strokeWidth={5} />
      <rect x={-48 + dx} y={cy - 15} width={76} height={30} rx={9} fill={fill} stroke={ink} strokeWidth={5} />
      <rect x={-40 + dx} y={cy - 11} width={58} height={6} rx={3} fill={bodyLight} opacity={shade ? 0.35 : 0.7} />
      <line x1={-30 + dx} y1={cy + 2} x2={-30 + dx} y2={cy + 11} stroke={ink} strokeWidth={2.5} opacity={0.6} />
      <line x1={-20 + dx} y1={cy + 2} x2={-20 + dx} y2={cy + 11} stroke={ink} strokeWidth={2.5} opacity={0.6} />
      <line x1={-10 + dx} y1={cy + 2} x2={-10 + dx} y2={cy + 11} stroke={ink} strokeWidth={2.5} opacity={0.6} />
      <rect x={22 + dx} y={cy - 19} width={30} height={38} rx={9} fill={fill} stroke={ink} strokeWidth={5} />
      <rect x={27 + dx} y={cy - 15} width={18} height={6} rx={3} fill={bodyLight} opacity={shade ? 0.35 : 0.75} />
      <ellipse cx={53 + dx} cy={cy} rx={7} ry={16} fill="url(#mk-gen-ongnhom-lens)" stroke={ink} strokeWidth={4} />
      <ellipse cx={51 + dx} cy={cy - 6} rx={2.2} ry={4.5} fill={PALETTE.paper} opacity={0.5 + 0.5 * glint} />
    </g>
  );
};

/** Ống nhòm đen trên chân máy nhỏ: nghiêng lên xuống ngắm trời, hai mắt kính lóe sáng. */
const OngNhomDen: FC<PropProps> = ({ frame, seed }) => {
  const w = wobble(frame, seed, 96);
  const tilt = -9 + 7 * (easing.inOut((w + 1) / 2) * 2 - 1);
  const lag = wobble(frame - 6, seed, 96);
  const glintA = clamp(0.5 + 0.5 * wobble(frame, seed + 3, 40), 0, 1);
  const glintB = clamp(0.5 + 0.5 * wobble(frame - 10, seed + 3, 40), 0, 1);
  const sparkle = easing.out(clamp(glintA, 0, 1));
  const strapSwing = 4 * lag;
  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-ongnhom-lens" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d6f0ff" />
          <stop offset="0.5" stopColor={PALETTE.screen} />
          <stop offset="1" stopColor="#2a4a7a" />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={66} />
      <line x1={0} y1={-98} x2={-54} y2={-6} stroke={ink} strokeWidth={7} strokeLinecap="round" />
      <line x1={0} y1={-98} x2={54} y2={-6} stroke={ink} strokeWidth={7} strokeLinecap="round" />
      <line x1={0} y1={-98} x2={-54} y2={-6} stroke={PALETTE.metal} strokeWidth={3} strokeLinecap="round" />
      <line x1={0} y1={-98} x2={54} y2={-6} stroke={PALETTE.metalDark} strokeWidth={3} strokeLinecap="round" />
      <line x1={0} y1={-98} x2={6} y2={-4} stroke={ink} strokeWidth={6} strokeLinecap="round" opacity={0.85} />
      <circle cx={-54} cy={-6} r={5} fill={ink} />
      <circle cx={54} cy={-6} r={5} fill={ink} />
      <rect x={-14} y={-112} width={28} height={18} rx={5} fill={PALETTE.metalDark} stroke={ink} strokeWidth={5} />
      <rect x={-9} y={-109} width={10} height={4} rx={2} fill={PALETTE.metal} opacity={0.8} />
      <g transform={`translate(0 -112) rotate(${tilt.toFixed(2)})`}>
        <path
          d={`M -40 -14 Q ${(-44 + strapSwing).toFixed(2)} 20 -20 26`}
          fill="none"
          stroke={PALETTE.woodDark}
          strokeWidth={4}
          strokeLinecap="round"
        />
        <Barrel dx={8} cy={-46} shade={true} glint={glintB} />
        <rect x={-14} y={-46} width={18} height={26} rx={5} fill={PALETTE.metalDark} stroke={ink} strokeWidth={4} />
        <circle cx={-5} cy={-33} r={6} fill={PALETTE.metal} stroke={ink} strokeWidth={3} />
        <Barrel dx={0} cy={-22} shade={false} glint={glintA} />
        <g transform={`translate(62 -34) scale(${(0.6 + 0.6 * sparkle).toFixed(3)})`} opacity={0.4 + 0.6 * sparkle}>
          <path d="M 0 -10 L 2.5 -2.5 L 10 0 L 2.5 2.5 L 0 10 L -2.5 2.5 L -10 0 L -2.5 -2.5 Z" fill={PALETTE.warn} />
          <circle cx={0} cy={0} r={2.5} fill={PALETTE.paper} />
        </g>
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 80,
  height: 210,
  Component: OngNhomDen,
};
