import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

/** Router bị nhiễm mã độc (một máy trong botnet): mắt đỏ phát sáng theo nhịp, con bọ bò trên nắp. */
const RouterInfected: FC<PropProps> = ({ frame, seed }) => {
  const glow = 0.5 + 0.5 * wobble(frame, seed, 20);
  const bugX = 30 * wobble(frame, seed + 7, 70);
  const legs = Math.sin(frame * 0.9) * 4;
  return (
    <g>
      <ContactShadow halfWidth={60} />
      <rect
        x={-10}
        y={-140}
        width={20}
        height={140}
        fill={PALETTE.metalDark}
        stroke={ink}
        strokeWidth={5}
      />
      <rect
        x={-44}
        y={-10}
        width={88}
        height={10}
        rx={5}
        fill={PALETTE.metalDark}
        stroke={ink}
        strokeWidth={4}
      />
      <line
        x1={-40}
        y1={-180}
        x2={-56}
        y2={-250}
        stroke={ink}
        strokeWidth={8}
        strokeLinecap="round"
      />
      <line
        x1={40}
        y1={-180}
        x2={56}
        y2={-250}
        stroke={ink}
        strokeWidth={8}
        strokeLinecap="round"
      />
      <rect
        x={-66}
        y={-190}
        width={132}
        height={52}
        rx={14}
        fill={PALETTE.bitShell}
        stroke={ink}
        strokeWidth={6}
      />
      <circle cx={0} cy={-164} r={20} fill={PALETTE.alert} opacity={0.25 * glow} />
      <circle cx={0} cy={-164} r={10} fill={PALETTE.alert} opacity={0.5 + 0.5 * glow} />
      <circle cx={-40} cy={-164} r={5} fill={PALETTE.warn} />
      <circle cx={40} cy={-164} r={5} fill={PALETTE.warn} opacity={glow} />
      <g transform={`translate(${bugX.toFixed(2)} -196)`}>
        <line
          x1={-12}
          y1={0}
          x2={-18}
          y2={8 + legs}
          stroke={ink}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <line
          x1={0}
          y1={0}
          x2={0}
          y2={9 - legs}
          stroke={ink}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <line
          x1={12}
          y1={0}
          x2={18}
          y2={8 + legs}
          stroke={ink}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <ellipse cx={0} cy={-6} rx={16} ry={11} fill={PALETTE.leaf} stroke={ink} strokeWidth={3} />
        <circle cx={14} cy={-10} r={6} fill={ink} />
      </g>
    </g>
  );
};

export const propRouterInfected: PropAsset = {
  placement: "floor",
  halfWidth: 70,
  height: 254,
  Component: RouterInfected,
};
