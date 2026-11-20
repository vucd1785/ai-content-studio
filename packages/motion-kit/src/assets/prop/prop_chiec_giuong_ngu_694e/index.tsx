import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../../prop/prop_server/index.js";

const ink = PALETTE.ink;
const wood = "#b97f4c";
const woodDark = "#8a5a33";
const sheet = "#f4efe6";
const blanketA = "#5b8fd6";
const blanketB = "#e9f0fb";

/** Giường ngủ đơn có gối và chăn kẻ sọc, chăn phập phồng nhẹ như đang thở. */
const SingleBed: FC<PropProps> = ({ frame, seed }) => {
  const breath = 0.5 + 0.5 * Math.sin((frame * Math.PI * 2) / 90);
  const lift = breath * 7;
  const pillowSquish = 1 + 0.03 * wobble(frame, seed, 90);
  const topY = -82 - lift;
  const blanketPath = `M -30 -50 L -30 -72 Q -18 ${(-78 - lift * 0.4).toFixed(2)} 0 ${(topY + 2).toFixed(2)} Q 22 ${(topY - 2).toFixed(2)} 42 ${(-78 - lift * 0.5).toFixed(2)} Q 60 -74 70 -70 L 70 -44 Q 20 -40 -30 -44 Z`;
  const clipId = `bed-blanket-${seed}`;
  const stripes = [-18, 2, 22, 42, 62];
  return (
    <g>
      <ContactShadow halfWidth={84} />
      {/* chân giường */}
      <rect
        x={-80}
        y={-26}
        width={12}
        height={26}
        rx={3}
        fill={woodDark}
        stroke={ink}
        strokeWidth={5}
      />
      <rect
        x={66}
        y={-26}
        width={12}
        height={26}
        rx={3}
        fill={woodDark}
        stroke={ink}
        strokeWidth={5}
      />
      {/* khung giường */}
      <rect
        x={-76}
        y={-50}
        width={150}
        height={28}
        rx={6}
        fill={wood}
        stroke={ink}
        strokeWidth={6}
      />
      {/* đầu giường */}
      <rect
        x={-86}
        y={-142}
        width={22}
        height={124}
        rx={10}
        fill={wood}
        stroke={ink}
        strokeWidth={6}
      />
      <line
        x1={-75}
        y1={-128}
        x2={-75}
        y2={-34}
        stroke={woodDark}
        strokeWidth={4}
        strokeLinecap="round"
      />
      {/* nệm */}
      <rect
        x={-66}
        y={-70}
        width={136}
        height={24}
        rx={8}
        fill={sheet}
        stroke={ink}
        strokeWidth={5}
      />
      {/* gối */}
      <g transform={`translate(-46 -80) scale(1 ${pillowSquish.toFixed(3)})`}>
        <ellipse cx={0} cy={0} rx={20} ry={12} fill="#ffffff" stroke={ink} strokeWidth={5} />
        <path
          d="M -8 -3 Q 0 2 8 -3"
          fill="none"
          stroke={ink}
          strokeWidth={2.5}
          strokeLinecap="round"
          opacity={0.5}
        />
      </g>
      {/* chăn kẻ sọc */}
      <defs>
        <clipPath id={clipId}>
          <path d={blanketPath} />
        </clipPath>
      </defs>
      <path d={blanketPath} fill={blanketB} />
      <g clipPath={`url(#${clipId})`}>
        {stripes.map((x) => (
          <rect key={x} x={x} y={-110} width={10} height={80} fill={blanketA} />
        ))}
        <rect x={-30} y={-110} width={6} height={80} fill={blanketA} opacity={0.6} />
      </g>
      <path d={blanketPath} fill="none" stroke={ink} strokeWidth={6} strokeLinejoin="round" />
      {/* mép chăn gấp */}
      <path
        d="M -30 -72 Q -24 -60 -30 -46"
        fill="none"
        stroke={ink}
        strokeWidth={3.5}
        strokeLinecap="round"
      />
      {/* chân giường cuối */}
      <rect x={66} y={-98} width={18} height={80} rx={8} fill={wood} stroke={ink} strokeWidth={6} />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 88,
  height: 146,
  Component: SingleBed,
};
