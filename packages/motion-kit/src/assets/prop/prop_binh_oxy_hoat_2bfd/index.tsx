import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const white = "#F4F8FB";
const paleBlue = "#BFE3F5";
const blue = "#3A9AD9";
const deepBlue = "#2B6FA3";

/** Bình oxy hoạt hình trắng xanh có van và đồng hồ nhỏ, khẽ nhấp nhô. */
const OxygenTank: FC<PropProps> = ({ frame, seed }) => {
  const b = wobble(frame, seed, 64);
  const lift = -3 - 3 * b;
  const sy = 1 + 0.018 * b;
  const sx = 1 - 0.012 * b;
  const needle = -35 + 22 * wobble(frame, seed + 3, 46);
  const cyc = (frame % 90) / 90;
  const sp = cyc < 0.3 ? easing.inOut(Math.sin((cyc / 0.3) * Math.PI)) : 0;
  const glow = 0.5 + 0.5 * wobble(frame, seed + 9, 30);
  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-oxy-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.45" stopColor={white} />
          <stop offset="1" stopColor={paleBlue} />
        </linearGradient>
        <linearGradient id="mk-gen-oxy-band" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6BB8E8" />
          <stop offset="0.5" stopColor={blue} />
          <stop offset="1" stopColor={deepBlue} />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={50} />
      <g transform={`translate(0 ${lift.toFixed(2)}) scale(${sx.toFixed(4)} ${sy.toFixed(4)})`}>
        {/* đế */}
        <rect x={-34} y={-22} width={68} height={16} rx={7} fill={deepBlue} stroke={ink} strokeWidth={5} />
        {/* thân bình */}
        <rect x={-42} y={-192} width={84} height={176} rx={38} fill="url(#mk-gen-oxy-body)" stroke={ink} strokeWidth={6} />
        {/* sọc xanh */}
        <rect x={-39} y={-112} width={78} height={34} fill="url(#mk-gen-oxy-band)" stroke={ink} strokeWidth={4} />
        <rect x={-39} y={-60} width={78} height={10} fill={blue} opacity={0.85} />
        {/* bóng tối bên phải */}
        <path d="M22 -182 Q40 -170 38 -140 L38 -40 Q36 -24 20 -20 Q30 -60 26 -140 Q24 -170 22 -182 Z" fill={deepBlue} opacity={0.18} />
        {/* highlight bên trái */}
        <rect x={-30} y={-176} width={10} height={60} rx={5} fill="#FFFFFF" opacity={0.9} />
        <rect x={-30} y={-72} width={10} height={36} rx={5} fill="#FFFFFF" opacity={0.6} />
        {/* biểu tượng giọt khí trên sọc */}
        <circle cx={-8} cy={-95} r={7} fill={white} stroke={ink} strokeWidth={3} />
        <circle cx={9} cy={-95} r={5} fill={white} stroke={ink} strokeWidth={3} />
        {/* cổ bình */}
        <rect x={-15} y={-210} width={30} height={22} rx={5} fill={PALETTE.metal} stroke={ink} strokeWidth={5} />
        <rect x={-11} y={-207} width={6} height={15} rx={3} fill="#FFFFFF" opacity={0.6} />
        {/* ống nối sang đồng hồ */}
        <rect x={12} y={-204} width={18} height={10} rx={3} fill={PALETTE.metalDark} stroke={ink} strokeWidth={4} />
        {/* van tay quay */}
        <rect x={-4} y={-224} width={8} height={16} fill={PALETTE.metalDark} stroke={ink} strokeWidth={4} />
        <ellipse cx={0} cy={-228} rx={22} ry={7} fill={PALETTE.alert} stroke={ink} strokeWidth={5} />
        <ellipse cx={-7} cy={-230} rx={7} ry={2.5} fill="#FFFFFF" opacity={0.55} />
        {/* đồng hồ nhỏ */}
        <circle cx={40} cy={-199} r={15} fill={PALETTE.metal} stroke={ink} strokeWidth={5} />
        <circle cx={40} cy={-199} r={10} fill={white} />
        <path d="M32 -199 A8 8 0 0 1 40 -207" stroke={PALETTE.ok} strokeWidth={3} fill="none" strokeLinecap="round" />
        <path d="M40 -207 A8 8 0 0 1 48 -199" stroke={PALETTE.alert} strokeWidth={3} fill="none" strokeLinecap="round" />
        <line
          x1={40}
          y1={-199}
          x2={40}
          y2={-207}
          stroke={ink}
          strokeWidth={2.5}
          strokeLinecap="round"
          transform={`rotate(${needle.toFixed(2)} 40 -199)`}
        />
        <circle cx={40} cy={-199} r={2.5} fill={ink} />
        <circle cx={40} cy={-199} r={17} fill={PALETTE.ok} opacity={0.12 * glow} />
        {/* lấp lánh */}
        <g transform={`translate(-24 -150) scale(${(0.2 + 0.8 * sp).toFixed(3)})`} opacity={sp}>
          <path d="M0 -10 L2.5 -2.5 L10 0 L2.5 2.5 L0 10 L-2.5 2.5 L-10 0 L-2.5 -2.5 Z" fill="#FFFFFF" stroke={paleBlue} strokeWidth={1.5} />
        </g>
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 60,
  height: 250,
  Component: OxygenTank,
};
