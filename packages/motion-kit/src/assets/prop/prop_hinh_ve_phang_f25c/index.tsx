import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, lerp, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const WATER = "#4fb3e8";
const WATER_LIGHT = "#bfe8ff";
const FIELD = "#7cc84e";
const FIELD_LIGHT = "#b5e36f";
const FIELD_DARK = "#4f9a35";
const EARTH = "#a8703f";
const EARTH_DARK = "#7a4c26";

const TRUNK = "M -90 -112 C -66 -114 -52 -100 -36 -96";
const UPPER = "M -36 -96 C -12 -110 10 -128 50 -130";
const MIDDLE = "M -36 -96 C -10 -97 20 -92 50 -94";
const LOWER = "M -36 -96 C -16 -80 10 -62 50 -58";
const RIVERS = [TRUNK, UPPER, MIDDLE, LOWER];

const Palm: FC<{ x: number; base: number; h: number; lean: number; sway: number }> = ({
  x,
  base,
  h,
  lean,
  sway,
}) => {
  const topX = x + lean;
  const topY = base - h;
  const angles = [-160, -125, -90, -55, -20];
  return (
    <g>
      <path
        d={`M ${x - 4} ${base} Q ${x + lean * 0.2} ${base - h * 0.5} ${topX - 3} ${topY} L ${topX + 3} ${topY} Q ${x + lean * 0.2 + 8} ${base - h * 0.5} ${x + 4} ${base} Z`}
        fill={PALETTE.wood}
        stroke={ink}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <g transform={`rotate(${sway.toFixed(2)} ${topX} ${topY})`}>
        {angles.map((a, i) => (
          <ellipse
            key={i}
            cx={topX + 15 * Math.cos((a * Math.PI) / 180)}
            cy={topY + 9 * Math.sin((a * Math.PI) / 180) + 4}
            rx={17}
            ry={5.5}
            transform={`rotate(${a + 90 > 0 ? a + 180 : a} ${topX + 15 * Math.cos((a * Math.PI) / 180)} ${topY + 9 * Math.sin((a * Math.PI) / 180) + 4})`}
            fill={i % 2 === 0 ? PALETTE.leaf : FIELD_DARK}
            stroke={ink}
            strokeWidth={3.5}
          />
        ))}
        <circle cx={topX - 3} cy={topY + 4} r={3.5} fill={EARTH_DARK} stroke={ink} strokeWidth={2} />
        <circle cx={topX + 4} cy={topY + 5} r={3.5} fill={EARTH_DARK} stroke={ink} strokeWidth={2} />
      </g>
    </g>
  );
};

/** Đồng bằng sông Cửu Long: ruộng lúa, sông chia nhánh ra biển, xuồng nhỏ và hàng dừa. */
const MekongDelta: FC<PropProps> = ({ frame, seed }) => {
  const shimmer = (-frame * 0.7).toFixed(2);
  const p = easing.inOut(0.5 + 0.5 * wobble(frame, seed, 180));
  const boatX = lerp(-28, 34, p);
  const boatY = -95 + 1.5 * Math.sin(frame * 0.12);
  const boatTilt = 4 * Math.sin(frame * 0.12 + 0.8);
  const sparkle = 0.5 + 0.5 * Math.sin(frame * 0.15);
  const sparkle2 = 0.5 + 0.5 * Math.sin(frame * 0.15 + 2.1);
  const s1 = 5 * wobble(frame, seed + 3, 90);
  const s2 = 5 * wobble(frame + 12, seed + 5, 90);
  const s3 = 5 * wobble(frame + 24, seed + 9, 90);
  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-delta-field" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={FIELD_LIGHT} />
          <stop offset="1" stopColor={FIELD} />
        </linearGradient>
        <linearGradient id="mk-gen-delta-sea" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={WATER_LIGHT} />
          <stop offset="1" stopColor={WATER} />
        </linearGradient>
        <clipPath id="mk-gen-delta-clip">
          <rect x={-86} y={-150} width={172} height={110} rx={18} />
        </clipPath>
      </defs>
      <ContactShadow halfWidth={88} />
      {/* earth block side */}
      <rect x={-86} y={-60} width={172} height={52} rx={16} fill={EARTH} stroke={ink} strokeWidth={6} />
      <rect x={-78} y={-30} width={156} height={14} rx={7} fill={EARTH_DARK} opacity={0.45} />
      <circle cx={-50} cy={-38} r={3} fill={EARTH_DARK} />
      <circle cx={10} cy={-42} r={2.5} fill={EARTH_DARK} />
      <circle cx={52} cy={-36} r={3} fill={EARTH_DARK} />
      {/* top surface */}
      <rect x={-86} y={-150} width={172} height={110} rx={18} fill="url(#mk-gen-delta-field)" />
      <g clipPath="url(#mk-gen-delta-clip)">
        {/* rice rows */}
        {[-136, -118, -78, -62, -48].map((y, i) => (
          <line
            key={i}
            x1={-80}
            y1={y}
            x2={40}
            y2={y + 2}
            stroke={i % 2 === 0 ? FIELD_DARK : FIELD_LIGHT}
            strokeWidth={3}
            strokeDasharray="6 7"
            strokeLinecap="round"
            opacity={0.7}
          />
        ))}
        <rect x={-86} y={-150} width={172} height={30} fill="#ffffff" opacity={0.12} />
        {/* sea */}
        <path
          d="M 46 -152 C 36 -130 56 -112 44 -92 C 34 -74 52 -56 44 -38 L 90 -38 L 90 -152 Z"
          fill="url(#mk-gen-delta-sea)"
          stroke={ink}
          strokeWidth={4}
        />
        <path d="M 60 -120 q 6 -4 12 0" stroke="#ffffff" strokeWidth={2.5} fill="none" opacity={sparkle} strokeLinecap="round" />
        <path d="M 58 -70 q 6 -4 12 0" stroke="#ffffff" strokeWidth={2.5} fill="none" opacity={sparkle2} strokeLinecap="round" />
        {/* rivers: outline, water, shimmer */}
        {RIVERS.map((d, i) => (
          <path key={`o${i}`} d={d} stroke={ink} strokeWidth={i === 0 ? 15 : 12} fill="none" strokeLinecap="round" />
        ))}
        {RIVERS.map((d, i) => (
          <path key={`w${i}`} d={d} stroke={WATER} strokeWidth={i === 0 ? 9 : 6.5} fill="none" strokeLinecap="round" />
        ))}
        {RIVERS.map((d, i) => (
          <path
            key={`s${i}`}
            d={d}
            stroke={WATER_LIGHT}
            strokeWidth={2}
            fill="none"
            strokeDasharray="5 12"
            strokeDashoffset={shimmer}
            strokeLinecap="round"
            opacity={0.9}
          />
        ))}
      </g>
      <rect x={-86} y={-150} width={172} height={110} rx={18} fill="none" stroke={ink} strokeWidth={6} />
      {/* boat */}
      <g transform={`translate(${boatX.toFixed(2)} ${boatY.toFixed(2)}) rotate(${boatTilt.toFixed(2)})`}>
        <path d="M -6 -4 L 0 -14 L 6 -4 Z" fill="#f2d27a" stroke={ink} strokeWidth={2.5} strokeLinejoin="round" />
        <rect x={-3} y={-5} width={6} height={5} fill={PALETTE.tiSkin} stroke={ink} strokeWidth={2} />
        <path d="M -15 -1 Q 0 9 15 -1 Z" fill={PALETTE.woodDark} stroke={ink} strokeWidth={3} strokeLinejoin="round" />
        <line x1={6} y1={-4} x2={14} y2={6} stroke={ink} strokeWidth={2} strokeLinecap="round" />
      </g>
      {/* coconut palms row at the back */}
      <Palm x={-68} base={-138} h={78} lean={-8} sway={s1} />
      <Palm x={-46} base={-140} h={92} lean={4} sway={s2} />
      <Palm x={-22} base={-136} h={70} lean={10} sway={s3} />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 260,
  Component: MekongDelta,
};
