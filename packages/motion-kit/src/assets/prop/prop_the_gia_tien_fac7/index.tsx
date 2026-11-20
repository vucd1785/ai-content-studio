import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const GREEN = "#3fbf6a";
const GREEN_LIGHT = "#8fe3a8";
const GREEN_DARK = "#24874a";

/** Thẻ giá xanh lá treo trên cọc gỗ, đung đưa nhẹ, mũi tên chỉ xuống nhún theo nhịp như vừa giảm giá. */
const PriceTagDown: FC<PropProps> = ({ frame, seed }) => {
  const cycle = 72;
  const p = (frame % cycle) / cycle;
  const swing = 7 * Math.sin(p * Math.PI * 2) + 1.5 * wobble(frame, seed, 50);
  const dropPhase = (frame % 48) / 48;
  const dip =
    dropPhase < 0.5
      ? easing.inOut(dropPhase / 0.5)
      : 1 - easing.out((dropPhase - 0.5) / 0.5);
  const arrowY = 7 * dip;
  const squash = 1 + 0.04 * dip;
  const spark = 0.5 + 0.5 * wobble(frame, seed + 3, 24);
  const spark2 = 0.5 + 0.5 * wobble(frame, seed + 11, 30);
  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-tag-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={GREEN_LIGHT} />
          <stop offset="0.45" stopColor={GREEN} />
          <stop offset="1" stopColor={GREEN_DARK} />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={60} />
      <rect x={-40} y={-16} width={80} height={16} rx={6} fill={PALETTE.woodDark} stroke={ink} strokeWidth={5} />
      <rect x={-34} y={-14} width={30} height={5} rx={2.5} fill="#ffffff" opacity={0.25} />
      <rect x={-7} y={-236} width={14} height={222} rx={5} fill={PALETTE.wood} stroke={ink} strokeWidth={5} />
      <rect x={-4} y={-230} width={4} height={208} rx={2} fill="#ffffff" opacity={0.3} />
      <circle cx={0} cy={-238} r={10} fill={PALETTE.woodDark} stroke={ink} strokeWidth={5} />
      <circle cx={-3} cy={-241} r={3} fill="#ffffff" opacity={0.45} />
      <g transform={`translate(0 -232) rotate(${swing.toFixed(2)})`}>
        <path d="M0 0 Q-6 12 0 26" fill="none" stroke={ink} strokeWidth={4} strokeLinecap="round" />
        <g transform={`scale(${(2 - squash).toFixed(3)} ${squash.toFixed(3)})`}>
          <path
            d="M0 10 L44 38 L44 128 Q44 140 32 140 L-32 140 Q-44 140 -44 128 L-44 38 Z"
            fill="url(#mk-gen-tag-body)"
            stroke={ink}
            strokeWidth={6}
            strokeLinejoin="round"
          />
          <path
            d="M0 20 L35 43 L35 124 Q35 131 28 131 L-28 131 Q-35 131 -35 124 L-35 43 Z"
            fill="none"
            stroke={PALETTE.paper}
            strokeWidth={2.5}
            strokeDasharray="6 6"
            opacity={0.7}
          />
          <path d="M-38 44 L-8 24 L-8 32 L-30 48 L-30 120 L-38 124 Z" fill="#ffffff" opacity={0.3} />
          <path d="M44 40 L44 128 Q44 140 32 140 L22 140 Q36 136 36 122 L36 44 Z" fill={GREEN_DARK} opacity={0.45} />
          <circle cx={0} cy={30} r={7} fill={PALETTE.paper} stroke={ink} strokeWidth={4} />
          <g transform={`translate(0 ${arrowY.toFixed(2)})`}>
            <path
              d="M-9 52 L9 52 L9 84 L22 84 L0 112 L-22 84 L-9 84 Z"
              fill={PALETTE.paper}
              stroke={ink}
              strokeWidth={5}
              strokeLinejoin="round"
            />
            <rect x={-5} y={56} width={4} height={24} rx={2} fill={GREEN_LIGHT} opacity={0.6} />
          </g>
        </g>
      </g>
      <g opacity={spark} transform={`translate(-56 -200) scale(${(0.7 + 0.3 * spark).toFixed(3)})`}>
        <path d="M0 -10 L3 -3 L10 0 L3 3 L0 10 L-3 3 L-10 0 L-3 -3 Z" fill={PALETTE.warn} stroke={ink} strokeWidth={2} />
      </g>
      <g opacity={spark2} transform={`translate(58 -150) scale(${(0.6 + 0.4 * spark2).toFixed(3)})`}>
        <path d="M0 -9 L2.5 -2.5 L9 0 L2.5 2.5 L0 9 L-2.5 2.5 L-9 0 L-2.5 -2.5 Z" fill={GREEN_LIGHT} stroke={ink} strokeWidth={2} />
      </g>
      <circle cx={52} cy={-216} r={3.5} fill={PALETTE.warn} opacity={spark2} />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 72,
  height: 252,
  Component: PriceTagDown,
};
