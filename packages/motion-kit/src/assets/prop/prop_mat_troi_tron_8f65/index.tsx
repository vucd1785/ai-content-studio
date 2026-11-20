import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../../prop/prop_server/index.js";

const ink = PALETTE.ink;
const RAYS = 12;
const CY = -150;

/** Mặt trời tròn màu vàng, tia nắng trắng xoay chậm quanh tâm, mặt cười chớp mắt. */
const MatTroiTron: FC<PropProps> = ({ frame, seed }) => {
  const angle = (frame * 0.6) % 360;
  const pulse = 1 + 0.03 * wobble(frame, seed, 40);
  const glow = 0.5 + 0.5 * wobble(frame, seed + 3, 30);
  const blinkPhase = (frame + seed * 7) % 90;
  const eyeRy = blinkPhase < 5 ? 1.5 : 6;

  const rays = [];
  for (let i = 0; i < RAYS; i++) {
    const a = (i / RAYS) * Math.PI * 2;
    const long = i % 2 === 0;
    const r0 = 54;
    const r1 = long ? 74 : 66;
    const w = 0.13;
    const p1x = Math.cos(a - w) * r0;
    const p1y = Math.sin(a - w) * r0;
    const p2x = Math.cos(a) * r1;
    const p2y = Math.sin(a) * r1;
    const p3x = Math.cos(a + w) * r0;
    const p3y = Math.sin(a + w) * r0;
    rays.push(
      <path
        key={i}
        d={`M ${p1x.toFixed(2)} ${p1y.toFixed(2)} L ${p2x.toFixed(2)} ${p2y.toFixed(2)} L ${p3x.toFixed(2)} ${p3y.toFixed(2)} Z`}
        fill="#FFFFFF"
        stroke={ink}
        strokeWidth={5}
        strokeLinejoin="round"
      />,
    );
  }

  return (
    <g>
      <ContactShadow halfWidth={60} />
      <g transform={`translate(0 ${CY}) scale(${pulse.toFixed(4)})`}>
        <circle cx={0} cy={0} r={62} fill={PALETTE.warn} opacity={0.15 + 0.15 * glow} />
        <g transform={`rotate(${angle.toFixed(2)})`}>{rays}</g>
        <circle cx={0} cy={0} r={50} fill={PALETTE.warn} stroke={ink} strokeWidth={6} />
        <circle cx={-14} cy={-16} r={14} fill="#FFFFFF" opacity={0.3} />
        <ellipse cx={-16} cy={-6} rx={5} ry={eyeRy} fill={ink} />
        <ellipse cx={16} cy={-6} rx={5} ry={eyeRy} fill={ink} />
        <circle cx={-28} cy={10} r={7} fill={PALETTE.alert} opacity={0.35} />
        <circle cx={28} cy={10} r={7} fill={PALETTE.alert} opacity={0.35} />
        <path
          d="M -16 12 Q 0 28 16 12"
          fill="none"
          stroke={ink}
          strokeWidth={5}
          strokeLinecap="round"
        />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 80,
  height: 232,
  Component: MatTroiTron,
};
