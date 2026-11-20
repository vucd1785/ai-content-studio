import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../../prop/prop_server/index.js";

const ink = PALETTE.ink;
const SUN = "#FFD23F";
const SUN_LIGHT = "#FFE88A";
const RAY = "#FFB627";

const CY = -150;
const RAYS = 12;

/** Mặt trời vàng tròn trên cột đế, tia sáng ngắn xoay chậm, quầng sáng nhịp nhàng. */
const SunFlat: FC<PropProps> = ({ frame, seed }) => {
  const rot = (frame * 0.6) % 360;
  const glow = 0.5 + 0.5 * wobble(frame, seed, 40);
  const pulse = 1 + 0.03 * Math.sin(frame * 0.12);
  const rays = [];
  for (let i = 0; i < RAYS; i++) {
    const a = (i * 360) / RAYS;
    const long = i % 2 === 0;
    rays.push(
      <rect
        key={i}
        x={-7}
        y={long ? -80 : -74}
        width={14}
        height={long ? 22 : 16}
        rx={7}
        fill={RAY}
        stroke={ink}
        strokeWidth={4}
        transform={`rotate(${a})`}
      />,
    );
  }
  return (
    <g>
      <ContactShadow halfWidth={50} />
      <rect
        x={-8}
        y={-96}
        width={16}
        height={92}
        fill={PALETTE.metalDark}
        stroke={ink}
        strokeWidth={5}
      />
      <rect
        x={-40}
        y={-12}
        width={80}
        height={12}
        rx={6}
        fill={PALETTE.metalDark}
        stroke={ink}
        strokeWidth={5}
      />
      <g transform={`translate(0 ${CY})`}>
        <circle cx={0} cy={0} r={72} fill={SUN_LIGHT} opacity={0.2 + 0.25 * glow} />
        <g transform={`rotate(${rot.toFixed(2)})`}>{rays}</g>
        <g transform={`scale(${pulse.toFixed(4)})`}>
          <circle cx={0} cy={0} r={52} fill={SUN} stroke={ink} strokeWidth={6} />
          <circle cx={-16} cy={-18} r={14} fill={SUN_LIGHT} opacity={0.8} />
          <circle cx={-16} cy={-4} r={5} fill={ink} />
          <circle cx={16} cy={-4} r={5} fill={ink} />
          <circle cx={-28} cy={10} r={7} fill={RAY} opacity={0.6} />
          <circle cx={28} cy={10} r={7} fill={RAY} opacity={0.6} />
          <path
            d="M -14 14 Q 0 28 14 14"
            fill="none"
            stroke={ink}
            strokeWidth={5}
            strokeLinecap="round"
          />
        </g>
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 240,
  Component: SunFlat,
};
