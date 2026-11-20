import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const green = "#4CAF6A";
const greenLight = "#8EDB9A";
const greenDark = "#2E7D4A";
const gold = "#F5C542";
const goldLight = "#FFE58A";
const goldDark = "#C98E1A";

const bounce = (frame: number, offset: number) => {
  const period = 54;
  const p = (((frame + offset) % period) + period) % period / period;
  const hop = p < 0.45 ? Math.sin(Math.PI * easing.inOut(p / 0.45)) : 0;
  const q = p >= 0.45 ? (p - 0.45) / 0.55 : 0;
  const squash = p >= 0.45 ? Math.exp(-q * 6) * Math.cos(q * 14) : 0;
  return { hop, squash };
};

const Sparkle: FC<{ x: number; y: number; s: number }> = ({ x, y, s }) => (
  <g transform={`translate(${x} ${y}) scale(${s.toFixed(3)})`}>
    <path
      d="M0 -12 Q2 -2 12 0 Q2 2 0 12 Q-2 2 -12 0 Q-2 -2 0 -12 Z"
      fill="#FFFFFF"
      stroke={goldDark}
      strokeWidth={2}
    />
  </g>
);

const Coin: FC<{ cx: number; cy: number }> = ({ cx, cy }) => (
  <g>
    <path
      d={`M${cx - 22} ${cy} L${cx - 22} ${cy + 8} A22 7 0 0 0 ${cx + 22} ${cy + 8} L${cx + 22} ${cy} Z`}
      fill={goldDark}
      stroke={ink}
      strokeWidth={4}
      strokeLinejoin="round"
    />
    <ellipse cx={cx} cy={cy} rx={22} ry={7} fill={gold} stroke={ink} strokeWidth={4} />
    <ellipse cx={cx - 4} cy={cy - 1} rx={11} ry={3} fill={goldLight} opacity={0.8} />
  </g>
);

/** Chồng tiền giấy xanh lá với xu vàng: nảy nhẹ, xu trên đỉnh nảy trễ nhịp, sao lấp lánh. */
const ChongTienGiay: FC<PropProps> = ({ frame, seed }) => {
  const main = bounce(frame, 0);
  const lag = bounce(frame, -6);
  const sy = 1 - 0.06 * main.squash + 0.03 * main.hop;
  const sx = 1 + 0.05 * main.squash - 0.02 * main.hop;
  const lift = main.hop * 7;
  const coinLift = lag.hop * 14;
  const coinTilt = -12 + 10 * lag.squash;
  const sp1 = 0.5 + 0.5 * wobble(frame, seed, 26);
  const sp2 = 0.5 + 0.5 * wobble(frame, seed + 5, 34);
  const sp3 = 0.5 + 0.5 * wobble(frame, seed + 11, 22);
  const shine = 0.25 + 0.2 * wobble(frame, seed + 3, 40);

  const layers = [0, 1, 2, 3, 4, 5];
  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-bill-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={greenLight} />
          <stop offset="1" stopColor={green} />
        </linearGradient>
        <radialGradient id="mk-gen-coin-face" cx="0.35" cy="0.35" r="0.7">
          <stop offset="0" stopColor={goldLight} />
          <stop offset="1" stopColor={gold} />
        </radialGradient>
      </defs>
      <ContactShadow halfWidth={76} />

      <g transform={`translate(0 ${(-lift).toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)})`}>
        {layers.map((i) => (
          <g key={i}>
            <rect
              x={-64 + (i % 2) * 3}
              y={-14 * (i + 1)}
              width={104}
              height={14}
              rx={4}
              fill={i % 2 === 0 ? green : greenDark}
              stroke={ink}
              strokeWidth={4}
            />
            <line
              x1={-56 + (i % 2) * 3}
              y1={-14 * i - 5}
              x2={30 + (i % 2) * 3}
              y2={-14 * i - 5}
              stroke={greenLight}
              strokeWidth={2}
              opacity={0.6}
            />
          </g>
        ))}
        <rect x={20} y={-84} width={20} height={84} fill={ink} opacity={0.15} />
        <rect
          x={-66}
          y={-112}
          width={108}
          height={30}
          rx={6}
          fill="url(#mk-gen-bill-top)"
          stroke={ink}
          strokeWidth={6}
        />
        <rect
          x={-58}
          y={-106}
          width={92}
          height={18}
          rx={4}
          fill="none"
          stroke={greenDark}
          strokeWidth={2.5}
        />
        <ellipse cx={-12} cy={-97} rx={10} ry={7} fill={greenLight} stroke={greenDark} strokeWidth={2.5} />
        <circle cx={-48} cy={-97} r={3} fill={greenDark} />
        <circle cx={24} cy={-97} r={3} fill={greenDark} />
        <rect x={-60} y={-109} width={40} height={5} rx={2.5} fill="#FFFFFF" opacity={shine} />
        <rect
          x={-22}
          y={-114}
          width={18}
          height={116}
          rx={3}
          fill={PALETTE.paper}
          stroke={ink}
          strokeWidth={4}
        />
        <rect x={-19} y={-110} width={4} height={108} fill="#FFFFFF" opacity={0.6} />

        <g transform={`translate(10 ${(-118 - coinLift).toFixed(2)}) rotate(${coinTilt.toFixed(2)})`}>
          <ellipse cx={0} cy={3} rx={16} ry={6} fill={goldDark} stroke={ink} strokeWidth={4} />
          <ellipse cx={0} cy={0} rx={16} ry={6} fill="url(#mk-gen-coin-face)" stroke={ink} strokeWidth={4} />
          <ellipse cx={-4} cy={-1} rx={6} ry={2} fill="#FFFFFF" opacity={0.7} />
        </g>
      </g>

      <Coin cx={52} cy={-8} />
      <Coin cx={53} cy={-17} />
      <Coin cx={51} cy={-26} />
      <Coin cx={52} cy={-35} />

      <g transform={`translate(-62 -16) rotate(${(-8 + 4 * main.squash).toFixed(2)})`}>
        <circle cx={0} cy={0} r={15} fill="url(#mk-gen-coin-face)" stroke={ink} strokeWidth={5} />
        <circle cx={0} cy={0} r={8} fill="none" stroke={goldDark} strokeWidth={3} />
        <path d="M-9 -6 A11 11 0 0 1 -2 -11" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.8} />
      </g>

      <g opacity={sp1}>
        <Sparkle x={-54} y={-132} s={0.6 + 0.5 * sp1} />
      </g>
      <g opacity={sp2}>
        <Sparkle x={62} y={-62} s={0.5 + 0.5 * sp2} />
      </g>
      <g opacity={sp3}>
        <Sparkle x={40} y={-150} s={0.4 + 0.4 * sp3} />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 80,
  height: 170,
  Component: ChongTienGiay,
};
