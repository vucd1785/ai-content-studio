import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, rnd, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

type PotProps = { x: number; y: number; s: number; steam: number };

const Pot: FC<PotProps> = ({ x, y, s, steam }) => (
  <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${s})`}>
    <path
      d="M-6 -20 Q-9 -28 -4 -34 M4 -20 Q8 -28 3 -36"
      fill="none"
      stroke={PALETTE.smoke}
      strokeWidth={3}
      strokeLinecap="round"
      opacity={0.35 + 0.45 * steam}
    />
    <rect x={-17} y={-12} width={5} height={4} rx={2} fill={PALETTE.metalDark} stroke={ink} strokeWidth={2.5} />
    <rect x={12} y={-12} width={5} height={4} rx={2} fill={PALETTE.metalDark} stroke={ink} strokeWidth={2.5} />
    <path
      d="M-13 -16 L13 -16 L11 -2 Q0 2 -11 -2 Z"
      fill="url(#mk-gen-pot-body)"
      stroke={ink}
      strokeWidth={3.5}
      strokeLinejoin="round"
    />
    <ellipse cx={0} cy={-16} rx={13} ry={3.5} fill={PALETTE.warn} stroke={ink} strokeWidth={3} />
    <rect x={-9} y={-12} width={3} height={8} rx={1.5} fill="#ffffff" opacity={0.45} />
  </g>
);

type ChefProps = { x: number; y: number; s: number; a: number; blink: boolean };

const LittleChef: FC<ChefProps> = ({ x, y, s, a, blink }) => {
  const hx = 3 + 5 * Math.cos(a);
  const hy = -26 + 2 * Math.sin(a);
  const bob = 1.2 * Math.sin(a * 2);
  return (
    <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${s})`}>
      <g transform={`translate(0 ${bob.toFixed(2)})`}>
        <rect x={-9} y={-44} width={18} height={26} rx={7} fill={PALETTE.paper} stroke={ink} strokeWidth={4} />
        <rect x={-6} y={-41} width={4} height={18} rx={2} fill="#ffffff" opacity={0.6} />
        <circle cx={0} cy={-53} r={9} fill={PALETTE.tiSkin} stroke={ink} strokeWidth={4} />
        <circle cx={-3} cy={-55} r={3} fill="#ffffff" opacity={0.35} />
        {blink ? (
          <line x1={1} y1={-53} x2={6} y2={-53} stroke={ink} strokeWidth={2} strokeLinecap="round" />
        ) : (
          <g>
            <circle cx={2} cy={-53} r={1.6} fill={ink} />
            <circle cx={6} cy={-53} r={1.6} fill={ink} />
          </g>
        )}
        <rect x={-8} y={-64} width={16} height={6} rx={2} fill={PALETTE.paper} stroke={ink} strokeWidth={3} />
        <circle cx={-5} cy={-68} r={5} fill={PALETTE.paper} stroke={ink} strokeWidth={3} />
        <circle cx={5} cy={-68} r={5} fill={PALETTE.paper} stroke={ink} strokeWidth={3} />
        <circle cx={0} cy={-71} r={6} fill={PALETTE.paper} stroke={ink} strokeWidth={3} />
        <line
          x1={6}
          y1={-38}
          x2={hx.toFixed(2)}
          y2={hy.toFixed(2)}
          stroke={ink}
          strokeWidth={3.5}
          strokeLinecap="round"
        />
        <line
          x1={hx.toFixed(2)}
          y1={hy.toFixed(2)}
          x2={(hx * 0.5).toFixed(2)}
          y2={-12}
          stroke={PALETTE.wood}
          strokeWidth={3}
          strokeLinecap="round"
        />
      </g>
    </g>
  );
};

const RACK_COLS = [0, 1, 2];
const RACK_ROWS = [0, 1, 2, 3];
const CHEF_COLS = [0, 1, 2];

/** So sánh một đầu bếp tất bật với trăm nồi (bên trái) và hàng đầu bếp nhỏ cùng khuấy nồi (bên phải). */
const ChefsParallel: FC<PropProps> = ({ frame, seed }) => {
  const stir = frame * 0.22;
  const blink = frame % 90 < 4;
  const run = wobble(frame, seed, 46);
  const chefX = -72 + 5 * run;
  const flail = Math.sin(frame * 0.45);
  const hop = Math.abs(Math.sin(frame * 0.3)) * 4;
  const dropT = (frame % 30) / 30;
  const dropY = -112 + 18 * easing.in(dropT);
  const glow = 0.5 + 0.5 * wobble(frame, seed + 3, 40);
  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-pot-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d9e1ea" />
          <stop offset="0.5" stopColor={PALETTE.metal} />
          <stop offset="1" stopColor={PALETTE.metalDark} />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={86} />

      {/* Left: crowded pot rack */}
      <rect x={-60} y={-118} width={56} height={118} rx={6} fill={PALETTE.wood} stroke={ink} strokeWidth={5} />
      <rect x={-56} y={-114} width={10} height={110} rx={4} fill="#ffffff" opacity={0.18} />
      <rect x={-16} y={-114} width={9} height={110} rx={4} fill={PALETTE.woodDark} opacity={0.35} />
      {RACK_ROWS.map((r) => (
        <line
          key={`sh${r}`}
          x1={-58}
          y1={-4 - r * 28}
          x2={-6}
          y2={-4 - r * 28}
          stroke={PALETTE.woodDark}
          strokeWidth={4}
        />
      ))}
      {RACK_ROWS.map((r) =>
        RACK_COLS.map((c) => {
          const i = r * 3 + c;
          const steam = 0.5 + 0.5 * Math.sin(frame * 0.15 + rnd(seed, i) * 6.28);
          return <Pot key={`p${i}`} x={-49 + c * 17} y={-5 - r * 28} s={0.6} steam={steam} />;
        }),
      )}

      {/* Busy stick chef */}
      <g transform={`translate(${chefX.toFixed(2)} ${(-hop).toFixed(2)})`}>
        <line x1={0} y1={-40} x2={-7} y2={-2} stroke={ink} strokeWidth={5} strokeLinecap="round" />
        <line x1={0} y1={-40} x2={7} y2={-2} stroke={ink} strokeWidth={5} strokeLinecap="round" />
        <line x1={0} y1={-80} x2={0} y2={-40} stroke={ink} strokeWidth={5} strokeLinecap="round" />
        <line
          x1={0}
          y1={-72}
          x2={(-12 - 4 * flail).toFixed(2)}
          y2={(-92 + 10 * flail).toFixed(2)}
          stroke={ink}
          strokeWidth={5}
          strokeLinecap="round"
        />
        <line
          x1={0}
          y1={-72}
          x2={(14 + 3 * flail).toFixed(2)}
          y2={(-60 - 14 * flail).toFixed(2)}
          stroke={ink}
          strokeWidth={5}
          strokeLinecap="round"
        />
        <circle cx={0} cy={-92} r={11} fill={PALETTE.tiSkin} stroke={ink} strokeWidth={5} />
        <circle cx={-4} cy={-95} r={3.5} fill="#ffffff" opacity={0.35} />
        <circle cx={3} cy={-93} r={1.8} fill={ink} />
        <circle cx={7} cy={-93} r={1.8} fill={ink} />
        <path d="M2 -86 Q5 -84 8 -86" fill="none" stroke={ink} strokeWidth={2} strokeLinecap="round" />
        <rect x={-9} y={-108} width={18} height={6} rx={2} fill={PALETTE.paper} stroke={ink} strokeWidth={3} />
        <circle cx={-5} cy={-112} r={6} fill={PALETTE.paper} stroke={ink} strokeWidth={3} />
        <circle cx={5} cy={-112} r={6} fill={PALETTE.paper} stroke={ink} strokeWidth={3} />
        <circle cx={0} cy={-116} r={7} fill={PALETTE.paper} stroke={ink} strokeWidth={3} />
        <path
          d={`M-14 ${dropY.toFixed(2)} q-3 5 0 7 q3 -2 0 -7 Z`}
          fill={PALETTE.screen}
          stroke={ink}
          strokeWidth={1.5}
          opacity={1 - dropT}
        />
      </g>

      {/* Divider */}
      <line
        x1={2}
        y1={-150}
        x2={2}
        y2={-8}
        stroke={PALETTE.outline}
        strokeWidth={3}
        strokeDasharray="6 7"
        strokeLinecap="round"
        opacity={0.6}
      />

      {/* Right: team of little chefs, back row then front row */}
      <ellipse cx={46} cy={-40} rx={40} ry={6} fill={PALETTE.ok} opacity={0.15 + 0.15 * glow} />
      {CHEF_COLS.map((c) => (
        <g key={`b${c}`}>
          <LittleChef x={24 + c * 22} y={-40} s={0.62} a={stir} blink={blink} />
          <Pot x={24 + c * 22} y={-38} s={0.62} steam={0.5 + 0.5 * Math.sin(stir)} />
        </g>
      ))}
      {CHEF_COLS.map((c) => (
        <g key={`f${c}`}>
          <LittleChef x={20 + c * 24} y={-2} s={0.75} a={stir} blink={blink} />
          <Pot x={20 + c * 24} y={0} s={0.75} steam={0.5 + 0.5 * Math.sin(stir)} />
        </g>
      ))}
      <path
        d="M78 -128 l3 -7 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 Z"
        fill={PALETTE.warn}
        stroke={ink}
        strokeWidth={2}
        opacity={0.4 + 0.6 * glow}
      />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 160,
  Component: ChefsParallel,
};
