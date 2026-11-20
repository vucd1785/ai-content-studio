import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const LEAF_DARK = "#2E7D32";
const LEAF_MID = "#43A047";
const LEAF_LIGHT = "#8BD46A";
const RIVER_HI = "#B9C98A";

type TreeProps = { x: number; y: number; r: number; fill: string; sway: number };

const Tree: FC<TreeProps> = ({ x, y, r, fill, sway }) => (
  <g transform={`translate(${x} ${y}) rotate(${sway.toFixed(2)})`}>
    <rect x={-3} y={-r * 0.9} width={6} height={r * 0.9} fill={PALETTE.woodDark} stroke={ink} strokeWidth={3} />
    <circle cx={-r * 0.55} cy={-r * 1.1} r={r * 0.7} fill={fill} stroke={ink} strokeWidth={4} />
    <circle cx={r * 0.55} cy={-r * 1.1} r={r * 0.7} fill={fill} stroke={ink} strokeWidth={4} />
    <circle cx={0} cy={-r * 1.6} r={r * 0.8} fill={fill} stroke={ink} strokeWidth={4} />
    <circle cx={-r * 0.3} cy={-r * 1.85} r={r * 0.3} fill="#FFFFFF" opacity={0.25} />
  </g>
);

/** Sông Amazon giữa rừng mưa: sông nâu xanh mở rộng ra biển, cây đung đưa, vẹt đỏ bay. */
const AmazonRiver: FC<PropProps> = ({ frame, seed }) => {
  const flow = (frame * 0.6) % 24;
  const swayA = 3 * wobble(frame, seed, 60);
  const swayB = 3 * wobble(frame, seed + 3, 75);
  const phase = (frame % 160) / 160;
  const tri = phase < 0.5 ? phase * 2 : 2 - phase * 2;
  const px = -48 + 96 * easing.inOut(tri);
  const dir = phase < 0.5 ? 1 : -1;
  const py = -172 + 5 * wobble(frame, seed + 9, 30);
  const flap = Math.sin(frame * 0.45);
  const sparkle = 0.5 + 0.5 * wobble(frame, seed + 5, 24);
  const wave = 4 * wobble(frame, seed + 11, 40);

  const riverPath =
    "M -42 -14 C -22 -48 -52 -70 -32 -94 C -22 -108 -58 -118 -84 -130 L 84 -130 C 44 -120 22 -110 22 -94 C 10 -70 42 -48 36 -14 Z";

  return (
    <g>
      <ContactShadow halfWidth={86} />
      <defs>
        <clipPath id="mk-gen-amazon-clip">
          <rect x={-82} y={-198} width={164} height={186} rx={20} />
        </clipPath>
        <linearGradient id="mk-gen-amazon-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7FD0F5" />
          <stop offset="1" stopColor="#D8F3FF" />
        </linearGradient>
        <linearGradient id="mk-gen-amazon-river" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#8A7444" />
          <stop offset="0.6" stopColor="#7E8C4C" />
          <stop offset="1" stopColor="#5E9A7A" />
        </linearGradient>
        <linearGradient id="mk-gen-amazon-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2F8FD0" />
          <stop offset="1" stopColor="#4FB3E0" />
        </linearGradient>
      </defs>

      {/* đế gỗ */}
      <rect x={-78} y={-16} width={156} height={16} rx={7} fill={PALETTE.wood} stroke={ink} strokeWidth={5} />
      <rect x={-70} y={-12} width={140} height={4} rx={2} fill="#FFFFFF" opacity={0.3} />

      <g clipPath="url(#mk-gen-amazon-clip)">
        <rect x={-84} y={-200} width={168} height={60} fill="url(#mk-gen-amazon-sky)" />
        <circle cx={-56} cy={-180} r={11} fill={PALETTE.warn} opacity={0.35 + 0.2 * sparkle} />
        <circle cx={-56} cy={-180} r={7} fill={PALETTE.warn} />
        <rect x={-84} y={-150} width={168} height={26} fill="url(#mk-gen-amazon-sea)" />
        <path
          d={`M ${-70 + wave} -142 q 6 -4 12 0 M ${10 + wave} -145 q 6 -4 12 0 M ${46 - wave} -138 q 6 -4 12 0`}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={2.5}
          strokeLinecap="round"
          opacity={0.8}
        />
        <rect x={-84} y={-130} width={168} height={120} fill={LEAF_MID} />
        <rect x={-84} y={-130} width={168} height={120} fill={LEAF_DARK} opacity={0.25} />

        <path d={riverPath} fill="url(#mk-gen-amazon-river)" stroke={ink} strokeWidth={5} strokeLinejoin="round" />
        <path
          d="M -34 -20 C -18 -50 -44 -70 -26 -94 C -18 -106 -46 -116 -66 -126"
          fill="none"
          stroke={RIVER_HI}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray="10 14"
          strokeDashoffset={flow}
          opacity={0.75}
        />
        <path
          d="M 22 -22 C 30 -50 4 -70 12 -96 C 18 -110 36 -118 60 -126"
          fill="none"
          stroke={RIVER_HI}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray="8 16"
          strokeDashoffset={flow}
          opacity={0.6}
        />
        <circle cx={-6} cy={-60} r={2.5} fill="#FFFFFF" opacity={sparkle} />
        <circle cx={4} cy={-112} r={2} fill="#FFFFFF" opacity={1 - sparkle} />

        {/* rừng phía sau */}
        <Tree x={-70} y={-112} r={12} fill={LEAF_DARK} sway={swayB} />
        <Tree x={64} y={-110} r={12} fill={LEAF_DARK} sway={-swayA} />
        <Tree x={-60} y={-80} r={15} fill={LEAF_MID} sway={swayA} />
        <Tree x={60} y={-78} r={15} fill={LEAF_MID} sway={swayB} />
        {/* rừng phía trước */}
        <Tree x={-72} y={-36} r={17} fill={LEAF_LIGHT} sway={swayB} />
        <Tree x={-50} y={-18} r={13} fill={LEAF_MID} sway={-swayA} />
        <Tree x={70} y={-34} r={17} fill={LEAF_LIGHT} sway={swayA} />
        <Tree x={52} y={-16} r={12} fill={LEAF_MID} sway={-swayB} />

        <rect x={-84} y={-200} width={70} height={190} fill="#FFFFFF" opacity={0.08} />
        <rect x={30} y={-200} width={54} height={190} fill="#000000" opacity={0.07} />
      </g>

      <rect x={-82} y={-198} width={164} height={186} rx={20} fill="none" stroke={ink} strokeWidth={6} />

      {/* vẹt đỏ */}
      <g transform={`translate(${px.toFixed(2)} ${py.toFixed(2)}) scale(${dir} 1)`}>
        <path d="M -10 2 L -24 8 L -22 2 Z" fill={PALETTE.shield} stroke={ink} strokeWidth={2.5} strokeLinejoin="round" />
        <path d="M -10 0 L -22 -2 L -20 -6 Z" fill={PALETTE.warn} stroke={ink} strokeWidth={2.5} strokeLinejoin="round" />
        <ellipse cx={0} cy={0} rx={12} ry={7} fill="#E53935" stroke={ink} strokeWidth={3} />
        <ellipse cx={-2} cy={-2} rx={6} ry={2.5} fill="#FF8A80" opacity={0.7} />
        <circle cx={11} cy={-4} r={6} fill="#E53935" stroke={ink} strokeWidth={3} />
        <path d="M 16 -6 Q 22 -4 17 1 Z" fill={PALETTE.warn} stroke={ink} strokeWidth={2} strokeLinejoin="round" />
        <circle cx={12} cy={-5} r={1.6} fill={ink} />
        <g transform={`translate(0 -2) scale(1 ${(0.3 + 0.7 * Math.abs(flap)).toFixed(3)}) scale(1 ${flap >= 0 ? -1 : 1})`}>
          <path d="M -6 0 Q 2 14 10 0 Z" fill={PALETTE.shield} stroke={ink} strokeWidth={2.5} strokeLinejoin="round" />
          <path d="M -2 0 Q 3 7 8 0 Z" fill={PALETTE.warn} opacity={0.8} />
        </g>
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 88,
  height: 202,
  Component: AmazonRiver,
};
