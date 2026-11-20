import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const GREEN = "#7FD68A";
const GREEN_LIGHT = "#BDF2C2";
const GREEN_DARK = "#4FA860";
const SPONGE = "#FFE7B0";
const SPONGE_DARK = "#F2CF86";
const CREAM = "#FFFBEF";
const BERRY = "#FF6B7A";

const RX = 62;
const RY = 20;
const TOP = -90;
const BOT = -16;
const H = BOT - TOP;

const pt = (deg: number, y: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: RX * Math.cos(a), y: y + RY * Math.sin(a) };
};

const f = (n: number) => n.toFixed(2);

const Sparkle: FC<{ x: number; y: number; s: number; o: number }> = ({ x, y, s, o }) => (
  <g transform={`translate(${f(x)} ${f(y)}) scale(${f(s)})`} opacity={o}>
    <path
      d="M 0 -12 Q 2 -2 12 0 Q 2 2 0 12 Q -2 2 -12 0 Q -2 -2 0 -12 Z"
      fill="#FFF6B8"
      stroke={ink}
      strokeWidth={2.5}
      strokeLinejoin="round"
    />
  </g>
);

/** Bánh kem tròn xanh lá chia 8 miếng, một miếng tách ra nhô lên nhẹ, đốm sáng lấp lánh. */
const GreenCake: FC<PropProps> = ({ frame, seed }) => {
  const cycle = (frame % 60) / 60;
  const up = cycle < 0.5 ? easing.inOut(cycle * 2) : 1 - easing.inOut((cycle - 0.5) * 2);
  const lift = 14 + 10 * up;
  const dx = 4 + 3 * up;
  const tilt = -2 * up;
  const s1 = 0.5 + 0.5 * wobble(frame, seed, 26);
  const s2 = 0.5 + 0.5 * wobble(frame, seed + 3, 34);
  const s3 = 0.5 + 0.5 * wobble(frame, seed + 9, 22);

  const C = { x: 0, y: TOP };
  const Cb = { x: 0, y: BOT };
  const P1 = pt(25, TOP);
  const P2 = pt(70, TOP);
  const P1b = pt(25, BOT);
  const P2b = pt(70, BOT);

  const cuts = [115, 160, 205, 250, 295, 340].map((d) => pt(d, TOP));
  const mid = TOP + H / 2;
  const berries = [140, 185, 230, 275, 320].map((d) => {
    const p = { x: RX * 0.6 * Math.cos((d * Math.PI) / 180), y: TOP + RY * 0.6 * Math.sin((d * Math.PI) / 180) };
    return p;
  });
  const sliceBerry = {
    x: RX * 0.62 * Math.cos((47.5 * Math.PI) / 180),
    y: TOP + RY * 0.62 * Math.sin((47.5 * Math.PI) / 180),
  };

  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-cake-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={GREEN_LIGHT} />
          <stop offset="0.45" stopColor={GREEN} />
          <stop offset="1" stopColor={GREEN_DARK} />
        </linearGradient>
        <radialGradient id="mk-gen-cake-top" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor={GREEN_LIGHT} />
          <stop offset="1" stopColor={GREEN} />
        </radialGradient>
      </defs>
      <ContactShadow halfWidth={78} />
      {/* đĩa */}
      <ellipse cx={0} cy={-12} rx={74} ry={16} fill={PALETTE.metal} stroke={ink} strokeWidth={5} />
      <ellipse cx={-14} cy={-16} rx={44} ry={7} fill="#FFFFFF" opacity={0.35} />
      {/* thân bánh */}
      <path
        d={`M ${-RX} ${TOP} L ${-RX} ${BOT} A ${RX} ${RY} 0 0 0 ${RX} ${BOT} L ${RX} ${TOP} Z`}
        fill="url(#mk-gen-cake-body)"
        stroke={ink}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <path
        d={`M ${-RX + 3} ${mid} A ${RX} ${RY} 0 0 0 ${RX - 3} ${mid}`}
        fill="none"
        stroke={CREAM}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <path
        d={`M ${RX - 10} ${TOP + 8} L ${RX - 10} ${BOT + 4}`}
        stroke={GREEN_DARK}
        strokeWidth={8}
        opacity={0.35}
        strokeLinecap="round"
      />
      {/* mặt trên */}
      <ellipse cx={0} cy={TOP} rx={RX} ry={RY} fill="url(#mk-gen-cake-top)" stroke={ink} strokeWidth={6} />
      {/* kem chảy */}
      {[-50, -30, -10].map((x, i) => (
        <path
          key={i}
          d={`M ${x - 7} ${TOP + 14 + (i === 0 ? -6 : 0)} q 7 ${16 + i * 3} 14 0`}
          fill={CREAM}
          stroke={ink}
          strokeWidth={3}
        />
      ))}
      {/* đường cắt */}
      {cuts.map((p, i) => (
        <line key={i} x1={0} y1={TOP} x2={f(p.x)} y2={f(p.y)} stroke={GREEN_DARK} strokeWidth={3} strokeLinecap="round" />
      ))}
      {/* lỗ hổng chỗ miếng bánh */}
      <path
        d={`M 0 ${TOP} L ${f(P1.x)} ${f(P1.y)} L ${f(P1b.x)} ${f(P1b.y)} L 0 ${BOT} Z`}
        fill={SPONGE_DARK}
        stroke={ink}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <path
        d={`M 0 ${TOP} L ${f(P2.x)} ${f(P2.y)} L ${f(P2b.x)} ${f(P2b.y)} L 0 ${BOT} Z`}
        fill={SPONGE}
        stroke={ink}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <line x1={0} y1={mid} x2={f(P2.x)} y2={f(P2.y + H / 2)} stroke={PALETTE.leaf} strokeWidth={5} />
      {/* dâu và kem trên mặt */}
      {berries.map((b, i) => (
        <g key={i}>
          <ellipse cx={f(b.x)} cy={f(b.y + 2)} rx={8} ry={4} fill={CREAM} stroke={ink} strokeWidth={2.5} />
          <circle cx={f(b.x)} cy={f(b.y - 3)} r={5} fill={BERRY} stroke={ink} strokeWidth={2.5} />
          <circle cx={f(b.x - 1.6)} cy={f(b.y - 4.6)} r={1.5} fill="#FFFFFF" opacity={0.8} />
        </g>
      ))}
      <ellipse cx={-26} cy={TOP - 6} rx={18} ry={4} fill="#FFFFFF" opacity={0.4} />
      {/* miếng bánh tách ra */}
      <g transform={`translate(${f(dx)} ${f(-lift)}) rotate(${f(tilt)} 30 ${TOP})`}>
        <path
          d={`M 0 ${TOP} L ${f(P2.x)} ${f(P2.y)} L ${f(P2b.x)} ${f(P2b.y)} L 0 ${BOT} Z`}
          fill={SPONGE}
          stroke={ink}
          strokeWidth={5}
          strokeLinejoin="round"
        />
        <line x1={0} y1={mid} x2={f(P2.x)} y2={f(P2.y + H / 2)} stroke={PALETTE.leaf} strokeWidth={6} />
        <path
          d={`M ${f(P1.x)} ${f(P1.y)} L ${f(P1b.x)} ${f(P1b.y)} A ${RX} ${RY} 0 0 1 ${f(P2b.x)} ${f(P2b.y)} L ${f(P2.x)} ${f(P2.y)} A ${RX} ${RY} 0 0 0 ${f(P1.x)} ${f(P1.y)} Z`}
          fill={GREEN}
          stroke={ink}
          strokeWidth={5}
          strokeLinejoin="round"
        />
        <path
          d={`M ${f(P1.x - 6)} ${f(P1.y + 8)} L ${f(P1b.x - 6)} ${f(P1b.y - 2)}`}
          stroke={GREEN_DARK}
          strokeWidth={6}
          opacity={0.4}
          strokeLinecap="round"
        />
        <path
          d={`M 0 ${TOP} L ${f(P1.x)} ${f(P1.y)} A ${RX} ${RY} 0 0 1 ${f(P2.x)} ${f(P2.y)} Z`}
          fill={GREEN_LIGHT}
          stroke={ink}
          strokeWidth={5}
          strokeLinejoin="round"
        />
        <ellipse cx={f(sliceBerry.x)} cy={f(sliceBerry.y + 2)} rx={8} ry={4} fill={CREAM} stroke={ink} strokeWidth={2.5} />
        <circle cx={f(sliceBerry.x)} cy={f(sliceBerry.y - 4)} r={6} fill={BERRY} stroke={ink} strokeWidth={2.5} />
        <circle cx={f(sliceBerry.x - 2)} cy={f(sliceBerry.y - 6)} r={1.8} fill="#FFFFFF" opacity={0.85} />
      </g>
      {/* lấp lánh */}
      <Sparkle x={58} y={-128 - 4 * up} s={0.6 + 0.5 * s1} o={0.4 + 0.6 * s1} />
      <Sparkle x={-56} y={-122} s={0.5 + 0.4 * s2} o={0.4 + 0.6 * s2} />
      <Sparkle x={8} y={-142} s={0.4 + 0.4 * s3} o={0.3 + 0.7 * s3} />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 80,
  height: 160,
  Component: GreenCake,
};
