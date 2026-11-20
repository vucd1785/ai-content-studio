import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const R = 60;
const PERIOD = 260;

const LAND_A =
  "M -110 -30 C -95 -50 -70 -45 -65 -25 C -60 -5 -80 5 -85 20 C -90 35 -105 30 -108 10 C -115 -5 -120 -15 -110 -30 Z";
const LAND_B =
  "M -20 -50 C 0 -58 25 -50 30 -35 C 35 -20 15 -15 10 0 C 5 15 20 30 5 42 C -10 50 -20 35 -18 20 C -16 5 -35 -5 -30 -25 C -28 -38 -30 -45 -20 -50 Z";
const LAND_C =
  "M 60 10 C 75 0 100 5 105 20 C 110 35 90 45 75 40 C 60 35 50 22 60 10 Z";

const Lands: FC<{ x: number }> = ({ x }) => (
  <g transform={`translate(${x.toFixed(2)} 0)`}>
    <path d={LAND_A} fill={PALETTE.leaf} stroke={ink} strokeWidth={4} strokeLinejoin="round" />
    <path d={LAND_B} fill={PALETTE.leaf} stroke={ink} strokeWidth={4} strokeLinejoin="round" />
    <path d={LAND_C} fill={PALETTE.leaf} stroke={ink} strokeWidth={4} strokeLinejoin="round" />
    <ellipse cx={72} cy={-34} rx={12} ry={7} fill={PALETTE.leaf} stroke={ink} strokeWidth={3} />
    <path d="M -104 -28 C -92 -40 -78 -38 -74 -28" fill="none" stroke="#9BE08A" strokeWidth={4} strokeLinecap="round" />
    <path d="M -16 -46 C -2 -52 14 -48 20 -40" fill="none" stroke="#9BE08A" strokeWidth={4} strokeLinecap="round" />
    <path d="M 66 12 C 76 6 90 8 96 16" fill="none" stroke="#9BE08A" strokeWidth={4} strokeLinecap="round" />
  </g>
);

const Clouds: FC<{ x: number }> = ({ x }) => (
  <g transform={`translate(${x.toFixed(2)} 0)`} opacity={0.85}>
    <rect x={-90} y={-12} width={40} height={9} rx={4.5} fill="#FFFFFF" />
    <rect x={-10} y={26} width={34} height={8} rx={4} fill="#FFFFFF" />
    <rect x={50} y={-22} width={44} height={9} rx={4.5} fill="#FFFFFF" />
  </g>
);

/** Quả Trái Đất xoay chậm từ trái sang phải, có mũi tên cong vòng quanh. */
const QuaTraiDat: FC<PropProps> = ({ frame, seed }) => {
  const bob = 4 * Math.sin((frame / 60) * Math.PI * 2);
  const landShift = (frame * 0.8) % PERIOD;
  const cloudShift = (frame * 1.3) % PERIOD;
  const pulse = 1 + 0.12 * Math.max(0, Math.sin((frame / 30) * Math.PI * 2));
  const twinkle = 0.5 + 0.5 * wobble(frame, seed, 24);
  const shadowScale = 1 - bob * 0.02;
  const cy = -150 + bob;
  return (
    <g>
      <defs>
        <clipPath id="mk-gen-earth-clip">
          <circle cx={0} cy={0} r={R} />
        </clipPath>
        <radialGradient id="mk-gen-earth-shade" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity={0.35} />
          <stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0} />
          <stop offset="0.85" stopColor="#0B2A5B" stopOpacity={0.25} />
          <stop offset="1" stopColor="#0B2A5B" stopOpacity={0.45} />
        </radialGradient>
      </defs>
      <g transform={`scale(${shadowScale.toFixed(3)} 1)`}>
        <ContactShadow halfWidth={56} />
      </g>
      <g transform={`translate(0 ${cy.toFixed(2)})`}>
        <g transform="rotate(-10)">
          <path d="M 80 0 A 80 22 0 0 0 -80 0" fill="none" stroke={ink} strokeWidth={12} strokeLinecap="round" />
          <path d="M 80 0 A 80 22 0 0 0 -80 0" fill="none" stroke="#D9A21B" strokeWidth={6} strokeLinecap="round" />
        </g>
        <circle cx={0} cy={0} r={R} fill="#3A8EE6" />
        <g clipPath="url(#mk-gen-earth-clip)">
          <Lands x={landShift} />
          <Lands x={landShift - PERIOD} />
          <Clouds x={cloudShift} />
          <Clouds x={cloudShift - PERIOD} />
          <ellipse cx={0} cy={-R + 4} rx={30} ry={10} fill="#F4FBFF" stroke={ink} strokeWidth={3} />
          <ellipse cx={0} cy={R - 4} rx={26} ry={9} fill="#F4FBFF" stroke={ink} strokeWidth={3} />
          <circle cx={0} cy={0} r={R} fill="url(#mk-gen-earth-shade)" />
          <path d="M 30 -52 A 60 60 0 0 1 30 52 A 70 70 0 0 0 30 -52 Z" fill="#0B2A5B" opacity={0.2} />
        </g>
        <circle cx={0} cy={0} r={R} fill="none" stroke={ink} strokeWidth={6} />
        <ellipse cx={-28} cy={-32} rx={12} ry={7} fill="#FFFFFF" opacity={0.6} transform="rotate(-35 -28 -32)" />
        <circle cx={-14} cy={-44} r={3.5} fill="#FFFFFF" opacity={0.7} />
        <g transform="rotate(-10)">
          <path d="M -80 0 A 80 22 0 0 0 54 16.2" fill="none" stroke={ink} strokeWidth={12} strokeLinecap="round" />
          <path d="M -80 0 A 80 22 0 0 0 54 16.2" fill="none" stroke={PALETTE.warn} strokeWidth={6} strokeLinecap="round" />
          <g transform={`translate(58 15) rotate(-16) scale(${pulse.toFixed(3)})`}>
            <path d="M 16 0 L -6 -12 L -2 0 L -6 12 Z" fill={PALETTE.warn} stroke={ink} strokeWidth={4} strokeLinejoin="round" />
          </g>
        </g>
      </g>
      <g opacity={twinkle} transform={`translate(-66 ${(-212 + bob).toFixed(2)})`}>
        <path d="M 0 -8 L 2 -2 L 8 0 L 2 2 L 0 8 L -2 2 L -8 0 L -2 -2 Z" fill={PALETTE.warn} stroke={ink} strokeWidth={2} />
      </g>
      <g opacity={1 - twinkle * 0.7} transform={`translate(70 ${(-200 + bob).toFixed(2)})`}>
        <path d="M 0 -6 L 1.5 -1.5 L 6 0 L 1.5 1.5 L 0 6 L -1.5 1.5 L -6 0 L -1.5 -1.5 Z" fill="#FFFFFF" stroke={ink} strokeWidth={2} />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 230,
  Component: QuaTraiDat,
};
