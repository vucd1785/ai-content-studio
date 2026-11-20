import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, lerp, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const blue = "#2F7DE1";
const blueLight = "#8CC4FF";
const blueDark = "#1B4F9E";
const skinShade = "#D9A27A";

const Sparkle: FC<{ x: number; y: number; s: number; o: number }> = ({ x, y, s, o }) => (
  <path
    d={`M ${x} ${y - s} Q ${x} ${y} ${x + s} ${y} Q ${x} ${y} ${x} ${y + s} Q ${x} ${y} ${x - s} ${y} Q ${x} ${y} ${x} ${y - s} Z`}
    fill={PALETTE.warn}
    stroke={ink}
    strokeWidth={2}
    opacity={o}
  />
);

/** Hai bàn tay chuyền gậy tiếp sức xanh dương, gậy trượt qua lại có vệt sáng. */
const RelayBatonPass: FC<PropProps> = ({ frame, seed }) => {
  const u = 0.5 + 0.5 * Math.sin((frame * Math.PI * 2) / 64);
  const s = easing.inOut(u);
  const speed = Math.abs(Math.cos((frame * Math.PI * 2) / 64));
  const dir = Math.cos((frame * Math.PI * 2) / 64) >= 0 ? 1 : -1;
  const bx = lerp(-14, 14, s);
  const by = -122 + 3 * Math.sin((frame * Math.PI * 2) / 32);
  const tilt = -10 + 4 * wobble(frame, seed, 48);
  const lBob = 3 * wobble(frame, seed + 3, 40);
  const rBob = 3 * wobble(frame, seed + 9, 44);
  const glow = 0.5 + 0.5 * wobble(frame, seed + 5, 22);
  const sp1 = 0.4 + 0.6 * Math.max(0, Math.sin(frame * 0.18));
  const sp2 = 0.4 + 0.6 * Math.max(0, Math.sin(frame * 0.18 + 2));
  const sp3 = 0.4 + 0.6 * Math.max(0, Math.sin(frame * 0.18 + 4));
  const tail = -dir;
  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-relay-baton" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={blueLight} />
          <stop offset="0.45" stopColor={blue} />
          <stop offset="1" stopColor={blueDark} />
        </linearGradient>
        <radialGradient id="mk-gen-relay-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={blueLight} stopOpacity={0.9} />
          <stop offset="1" stopColor={blueLight} stopOpacity={0} />
        </radialGradient>
      </defs>
      <ContactShadow halfWidth={62} />

      {/* glow behind baton */}
      <ellipse cx={bx} cy={by} rx={70} ry={34} fill="url(#mk-gen-relay-glow)" opacity={0.35 + 0.35 * glow} />

      {/* left sleeve + palm (behind baton) */}
      <g transform={`translate(0 ${lBob.toFixed(2)})`}>
        <rect x={-88} y={-126} width={40} height={28} rx={12} fill={PALETTE.accent} stroke={ink} strokeWidth={5} />
        <rect x={-84} y={-122} width={30} height={7} rx={3} fill="#FFFFFF" opacity={0.3} />
        <ellipse cx={-38} cy={-113} rx={17} ry={14} fill={PALETTE.tiSkin} stroke={ink} strokeWidth={5} />
        <ellipse cx={-33} cy={-107} rx={9} ry={6} fill={skinShade} opacity={0.5} />
      </g>

      {/* right sleeve + palm (behind baton) */}
      <g transform={`translate(0 ${rBob.toFixed(2)})`}>
        <rect x={48} y={-142} width={40} height={28} rx={12} fill={PALETTE.leaf} stroke={ink} strokeWidth={5} />
        <rect x={52} y={-138} width={30} height={7} rx={3} fill="#FFFFFF" opacity={0.3} />
        <ellipse cx={40} cy={-129} rx={17} ry={14} fill={PALETTE.tiSkin} stroke={ink} strokeWidth={5} />
        <ellipse cx={45} cy={-123} rx={9} ry={6} fill={skinShade} opacity={0.5} />
      </g>

      {/* motion streaks */}
      <g opacity={0.25 + 0.65 * speed} transform={`translate(${bx.toFixed(2)} ${by.toFixed(2)})`}>
        <line x1={tail * 46} y1={-10} x2={tail * 74} y2={-8} stroke={blueLight} strokeWidth={5} strokeLinecap="round" />
        <line x1={tail * 50} y1={2} x2={tail * 84} y2={4} stroke={PALETTE.paper} strokeWidth={4} strokeLinecap="round" />
        <line x1={tail * 46} y1={13} x2={tail * 70} y2={15} stroke={blueLight} strokeWidth={5} strokeLinecap="round" />
      </g>

      {/* baton */}
      <g transform={`translate(${bx.toFixed(2)} ${by.toFixed(2)}) rotate(${tilt.toFixed(2)})`}>
        <rect x={-45} y={-11} width={90} height={22} rx={11} fill="url(#mk-gen-relay-baton)" stroke={ink} strokeWidth={6} />
        <rect x={-36} y={-11} width={8} height={22} fill={blueDark} opacity={0.8} />
        <rect x={28} y={-11} width={8} height={22} fill={blueDark} opacity={0.8} />
        <rect x={-26} y={-7} width={52} height={5} rx={2.5} fill="#FFFFFF" opacity={0.55} />
        <rect x={-40} y={4} width={80} height={4} rx={2} fill={blueDark} opacity={0.35} />
        <ellipse cx={-45} cy={0} rx={4} ry={9} fill={blueDark} stroke={ink} strokeWidth={3} />
      </g>

      {/* fingers over baton */}
      <g transform={`translate(0 ${lBob.toFixed(2)})`}>
        <ellipse cx={-28} cy={-119} rx={9} ry={7} fill={PALETTE.tiSkin} stroke={ink} strokeWidth={4} />
        <ellipse cx={-32} cy={-106} rx={9} ry={6} fill={PALETTE.tiSkin} stroke={ink} strokeWidth={4} />
      </g>
      <g transform={`translate(0 ${rBob.toFixed(2)})`}>
        <ellipse cx={30} cy={-138} rx={9} ry={6} fill={PALETTE.tiSkin} stroke={ink} strokeWidth={4} />
        <ellipse cx={28} cy={-125} rx={9} ry={6} fill={PALETTE.tiSkin} stroke={ink} strokeWidth={4} />
      </g>

      {/* sparkles */}
      <Sparkle x={-6} y={-176} s={10 * sp1} o={sp1} />
      <Sparkle x={58} y={-172} s={8 * sp2} o={sp2} />
      <Sparkle x={-60} y={-160} s={7 * sp3} o={sp3} />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 190,
  Component: RelayBatonPass,
};
