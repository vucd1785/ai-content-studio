import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";

const ink = PALETTE.ink;

const BROWN = "#8a5a34";
const BROWN_LIGHT = "#b07c4f";
const BROWN_DARK = "#5e3a1f";
const HEAD = "#3a2a22";
const SHIELD = "#f08a3c";
const SHIELD_LIGHT = "#ffc07a";
const GLOW = "#e8ff7a";
const GLOW_CORE = "#fbffd6";
const GLOW_DEEP = "#a8e04a";
const WING = "#dff4ff";

type Spark = { x: number; y: number; ph: number; s: number };

const SPARKS: Spark[] = [
  { x: -70, y: -170, ph: 0, s: 1 },
  { x: -78, y: -70, ph: 1.7, s: 0.8 },
  { x: 62, y: -175, ph: 3.1, s: 0.9 },
  { x: 70, y: -62, ph: 4.4, s: 0.7 },
  { x: -20, y: -196, ph: 2.3, s: 0.75 },
];

const smooth = (p: number): number => p * p * (3 - 2 * p);

/** Con đom đóm phóng to: đuôi bụng phát sáng vàng xanh phập phồng, cánh mỏng vỗ, thân bay nhấp nhô. */
const Firefly: FC<PropProps> = ({ frame, seed }) => {
  const cycle = 0.5 - 0.5 * Math.cos((frame * Math.PI * 2) / 48);
  const pulse = smooth(cycle);
  const flicker = 0.92 + 0.08 * wobble(frame, seed + 3, 9);
  const glow = pulse * flicker;
  const bob = 7 * Math.sin((frame * Math.PI * 2) / 64) + 2 * wobble(frame, seed, 40);
  const tilt = 3 * Math.sin((frame * Math.PI * 2) / 64 + 0.8);
  const flap = Math.sin(frame * 1.1);
  const wingBack = -24 + flap * 16;
  const wingFront = -14 + flap * 20;
  const antenna = 4 * Math.sin((frame * Math.PI * 2) / 40);
  const legSwing = 3 * Math.sin((frame * Math.PI * 2) / 32);

  return (
    <g>
      <defs>
        <radialGradient id="mk-gen-ff-halo" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={GLOW_CORE} stopOpacity={0.95} />
          <stop offset="0.35" stopColor={GLOW} stopOpacity={0.6} />
          <stop offset="1" stopColor={GLOW_DEEP} stopOpacity={0} />
        </radialGradient>
        <linearGradient id="mk-gen-ff-body" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={BROWN_LIGHT} />
          <stop offset="0.55" stopColor={BROWN} />
          <stop offset="1" stopColor={BROWN_DARK} />
        </linearGradient>
        <radialGradient id="mk-gen-ff-tail" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor={GLOW_CORE} />
          <stop offset="0.6" stopColor={GLOW} />
          <stop offset="1" stopColor={GLOW_DEEP} />
        </radialGradient>
      </defs>

      <g transform={`translate(0 ${bob.toFixed(2)}) rotate(${tilt.toFixed(2)} 0 -120)`}>
        {/* quầng sáng */}
        <circle
          cx={-44}
          cy={-112}
          r={30 + 14 * glow}
          fill="url(#mk-gen-ff-halo)"
          opacity={0.35 + 0.65 * glow}
        />

        {/* cánh sau */}
        <g transform={`rotate(${wingBack.toFixed(2)} 6 -134)`}>
          <ellipse
            cx={-26}
            cy={-150}
            rx={36}
            ry={14}
            fill={WING}
            opacity={0.55}
            stroke={ink}
            strokeWidth={4}
          />
        </g>

        {/* chân */}
        <g stroke={ink} strokeWidth={4} strokeLinecap="round" fill="none">
          <path d={`M -4 -104 L ${-12 + legSwing} -88 L ${-18 + legSwing} -80`} />
          <path d={`M 10 -102 L ${10 - legSwing} -86 L ${6 - legSwing} -78`} />
          <path d={`M 24 -104 L ${30 + legSwing} -88 L ${36 + legSwing} -82`} />
        </g>

        {/* bụng nâu */}
        <ellipse
          cx={-22}
          cy={-114}
          rx={36}
          ry={20}
          fill="url(#mk-gen-ff-body)"
          stroke={ink}
          strokeWidth={6}
        />
        {/* đốt bụng */}
        <path d="M -10 -132 Q -4 -114 -10 -96" stroke={BROWN_DARK} strokeWidth={3} fill="none" opacity={0.7} />
        <path d="M -24 -133 Q -18 -114 -24 -95" stroke={BROWN_DARK} strokeWidth={3} fill="none" opacity={0.7} />

        {/* đuôi phát sáng */}
        <ellipse
          cx={-46}
          cy={-112}
          rx={16}
          ry={17}
          fill="url(#mk-gen-ff-tail)"
          stroke={ink}
          strokeWidth={5}
        />
        <ellipse cx={-46} cy={-112} rx={12} ry={13} fill={GLOW_CORE} opacity={0.25 + 0.6 * glow} />
        <ellipse cx={-50} cy={-118} rx={5} ry={4} fill="#ffffff" opacity={0.5 + 0.4 * glow} />

        {/* ngực */}
        <ellipse
          cx={16}
          cy={-120}
          rx={22}
          ry={20}
          fill="url(#mk-gen-ff-body)"
          stroke={ink}
          strokeWidth={6}
        />
        {/* khiên ngực cam */}
        <path
          d="M 22 -140 Q 46 -142 50 -124 Q 40 -116 26 -120 Q 18 -130 22 -140 Z"
          fill={SHIELD}
          stroke={ink}
          strokeWidth={5}
          strokeLinejoin="round"
        />
        <path d="M 28 -136 Q 40 -138 44 -130" stroke={SHIELD_LIGHT} strokeWidth={4} strokeLinecap="round" fill="none" />

        {/* đầu */}
        <circle cx={50} cy={-114} r={14} fill={HEAD} stroke={ink} strokeWidth={5} />
        <circle cx={55} cy={-117} r={5.5} fill="#ffffff" />
        <circle cx={56.5} cy={-117} r={3} fill={ink} />
        <circle cx={46} cy={-121} r={3} fill="#ffffff" opacity={0.35} />

        {/* râu */}
        <g stroke={ink} strokeWidth={4} strokeLinecap="round" fill="none">
          <path d={`M 52 -126 Q 60 -150 ${72 + antenna} -160`} />
          <path d={`M 46 -127 Q 48 -152 ${58 - antenna} -166`} />
        </g>

        {/* cánh trước */}
        <g transform={`rotate(${wingFront.toFixed(2)} 10 -134)`}>
          <ellipse
            cx={-24}
            cy={-146}
            rx={38}
            ry={15}
            fill={WING}
            opacity={0.65}
            stroke={ink}
            strokeWidth={5}
          />
          <path d="M 4 -146 Q -22 -152 -50 -146" stroke="#9ec6dc" strokeWidth={2.5} fill="none" />
          <ellipse cx={-14} cy={-151} rx={14} ry={4} fill="#ffffff" opacity={0.6} />
        </g>

        {/* điểm sáng trên lưng */}
        <ellipse cx={6} cy={-130} rx={7} ry={4} fill="#ffffff" opacity={0.3} />
        <ellipse cx={-30} cy={-126} rx={10} ry={4} fill="#ffffff" opacity={0.22} />
      </g>

      {/* đốm sáng lấp lánh */}
      {SPARKS.map((sp) => {
        const tw = 0.5 + 0.5 * Math.sin(frame * 0.15 + sp.ph);
        const k = sp.s * (0.6 + 0.6 * tw);
        return (
          <g key={`${sp.x}_${sp.y}`} transform={`translate(${sp.x} ${sp.y}) scale(${k.toFixed(3)})`} opacity={0.3 + 0.7 * tw}>
            <circle cx={0} cy={0} r={9} fill={GLOW} opacity={0.35} />
            <path d="M 0 -8 L 2 -2 L 8 0 L 2 2 L 0 8 L -2 2 L -8 0 L -2 -2 Z" fill={GLOW_CORE} />
          </g>
        );
      })}
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 220,
  Component: Firefly,
};
