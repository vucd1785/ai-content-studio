import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, lerp, clamp, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const ORANGE = "#F28C28";
const ORANGE_LIGHT = "#FFB866";
const ORANGE_DARK = "#C2601A";

/** Cánh tay robot công nghiệp màu cam: hạ xuống kẹp lắp chi tiết rồi nhấc lên, khớp xoay nhịp nhàng. */
const RobotArm: FC<PropProps> = ({ frame, seed }) => {
  const cycle = 60;
  const p = (((frame % cycle) + cycle) % cycle) / cycle;

  // reach: 0 = raised, 1 = down at the workpiece
  let reach = 0;
  if (p < 0.35) reach = easing.inOut(p / 0.35);
  else if (p < 0.5) reach = 1;
  else if (p < 0.85) reach = 1 - easing.outBack(1.6)((p - 0.5) / 0.35);
  else reach = 0;

  const a1 = lerp(0, 25, reach);
  const a2 = lerp(110, 130, reach);
  const a3 = 180 - a1 - a2 + 3 * wobble(frame, seed + 3, 40);

  const grip = p > 0.33 && p < 0.55 ? 1 : 0;
  const gripT = grip ? clamp((p - 0.33) / 0.05, 0, 1) : clamp(1 - (p - 0.55) / 0.05, 0, 1) * (p >= 0.55 ? 1 : 0);
  const jawGap = lerp(13, 8, easing.out(gripT));

  const sparkOn = p > 0.38 && p < 0.5;
  const sparkT = sparkOn ? (p - 0.38) / 0.12 : 0;
  const sparkR = lerp(4, 14, easing.out(sparkT));
  const sparkO = sparkOn ? 1 - sparkT : 0;

  const blink = 0.5 + 0.5 * wobble(frame, seed, 16);
  const press = reach > 0.98 ? 1.5 : 0;

  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-arm-orange" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={ORANGE_LIGHT} />
          <stop offset="0.45" stopColor={ORANGE} />
          <stop offset="1" stopColor={ORANGE_DARK} />
        </linearGradient>
        <linearGradient id="mk-gen-arm-base" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={PALETTE.metal} />
          <stop offset="1" stopColor={PALETTE.metalDark} />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={78} />

      {/* small work table */}
      <rect x={24} y={-40} width={8} height={40} fill={PALETTE.woodDark} stroke={ink} strokeWidth={4} />
      <rect x={52} y={-40} width={8} height={40} fill={PALETTE.woodDark} stroke={ink} strokeWidth={4} />
      <rect x={18} y={-44} width={48} height={10} rx={4} fill={PALETTE.wood} stroke={ink} strokeWidth={5} />
      {/* workpiece */}
      <g transform={`translate(0 ${press})`}>
        <rect x={34} y={-58} width={16} height={14} rx={3} fill={PALETTE.accent} stroke={ink} strokeWidth={4} />
        <rect x={37} y={-55} width={4} height={8} rx={2} fill="#ffffff" opacity={0.45} />
      </g>

      {/* base */}
      <rect x={-66} y={-14} width={72} height={14} rx={5} fill={PALETTE.metalDark} stroke={ink} strokeWidth={5} />
      <path d="M -56 -14 L -50 -40 L -10 -40 L -4 -14 Z" fill="url(#mk-gen-arm-base)" stroke={ink} strokeWidth={5} strokeLinejoin="round" />
      <rect x={-52} y={-36} width={6} height={18} rx={3} fill="#ffffff" opacity={0.3} />
      <circle cx={-60} cy={-7} r={2.5} fill={ink} />
      <circle cx={0} cy={-7} r={2.5} fill={ink} />
      <circle cx={-18} cy={-26} r={7} fill={PALETTE.ok} opacity={0.3 * blink} />
      <circle cx={-18} cy={-26} r={4} fill={PALETTE.ok} opacity={0.5 + 0.5 * blink} stroke={ink} strokeWidth={2} />
      <ellipse cx={-30} cy={-42} rx={22} ry={8} fill={ORANGE_DARK} stroke={ink} strokeWidth={5} />

      {/* arm chain */}
      <g transform={`translate(-30 -50) rotate(${a1.toFixed(2)})`}>
        <rect x={-13} y={-100} width={26} height={100} rx={13} fill="url(#mk-gen-arm-orange)" stroke={ink} strokeWidth={6} />
        <rect x={-8} y={-88} width={5} height={70} rx={2.5} fill="#ffffff" opacity={0.35} />
        <path d="M 9 -90 Q 20 -50 9 -10" fill="none" stroke={ink} strokeWidth={3} strokeLinecap="round" opacity={0.7} />
        <circle cx={0} cy={0} r={15} fill={PALETTE.metal} stroke={ink} strokeWidth={5} />
        <circle cx={0} cy={0} r={5} fill={PALETTE.metalDark} stroke={ink} strokeWidth={2} />
        <g transform={`translate(0 -100) rotate(${a2.toFixed(2)})`}>
          <rect x={-10} y={-70} width={20} height={70} rx={10} fill="url(#mk-gen-arm-orange)" stroke={ink} strokeWidth={6} />
          <rect x={-6} y={-60} width={4} height={46} rx={2} fill="#ffffff" opacity={0.35} />
          <rect x={2} y={-60} width={5} height={46} rx={2.5} fill={ink} opacity={0.15} />
          <circle cx={0} cy={0} r={13} fill={PALETTE.metal} stroke={ink} strokeWidth={5} />
          <circle cx={0} cy={0} r={4} fill={PALETTE.metalDark} />
          <g transform={`translate(0 -70) rotate(${a3.toFixed(2)})`}>
            <circle cx={0} cy={0} r={9} fill={PALETTE.metalDark} stroke={ink} strokeWidth={4} />
            <rect x={-7} y={-12} width={14} height={10} rx={3} fill={PALETTE.metal} stroke={ink} strokeWidth={4} />
            <rect x={-17} y={-19} width={34} height={8} rx={3} fill={ORANGE} stroke={ink} strokeWidth={4} />
            <rect x={-jawGap - 5} y={-30} width={5} height={12} rx={2} fill={PALETTE.metalDark} stroke={ink} strokeWidth={3} />
            <rect x={jawGap} y={-30} width={5} height={12} rx={2} fill={PALETTE.metalDark} stroke={ink} strokeWidth={3} />
          </g>
        </g>
      </g>

      {/* spark at contact */}
      <g opacity={sparkO} transform="translate(42 -60)">
        <circle cx={0} cy={0} r={sparkR * 0.6} fill={PALETTE.warn} opacity={0.4} />
        <line x1={-sparkR} y1={0} x2={sparkR} y2={0} stroke={PALETTE.warn} strokeWidth={3} strokeLinecap="round" />
        <line x1={0} y1={-sparkR} x2={0} y2={sparkR * 0.5} stroke={PALETTE.warn} strokeWidth={3} strokeLinecap="round" />
        <line x1={-sparkR * 0.7} y1={-sparkR * 0.7} x2={sparkR * 0.7} y2={sparkR * 0.7} stroke="#ffffff" strokeWidth={2} strokeLinecap="round" />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 80,
  height: 180,
  Component: RobotArm,
};
