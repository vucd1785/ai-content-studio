import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

/** Khung ảnh chân dung (phong cách hoạt hình) trên giá vẽ: khung khẽ đung đưa, người trong ảnh chớp mắt, kính lóe sáng. */
const PortraitFrame: FC<PropProps> = ({ frame, seed }) => {
  const sway = 1.6 * wobble(frame, seed, 90);
  const cyc = frame % 96;
  const blink = cyc < 5 ? 0.15 + 0.85 * Math.abs(cyc - 2.5) / 2.5 : 1;
  const shineT = (frame % 120) / 120;
  const shineX = -90 + 180 * easing.inOut(shineT);
  const sparkle = 0.5 + 0.5 * wobble(frame, seed + 3, 30);
  const breath = 1 + 0.012 * wobble(frame, seed + 5, 60);
  return (
    <g>
      <ContactShadow halfWidth={62} />
      <defs>
        <linearGradient id="mk-gen-portrait-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#CFE8F7" />
          <stop offset="100%" stopColor="#8FBBD9" />
        </linearGradient>
        <linearGradient id="mk-gen-portrait-frame" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E9B872" />
          <stop offset="100%" stopColor={PALETTE.woodDark} />
        </linearGradient>
        <clipPath id="mk-gen-portrait-clip">
          <rect x={-46} y={-232} width={92} height={118} rx={6} />
        </clipPath>
      </defs>
      {/* easel legs */}
      <line x1={-40} y1={-120} x2={-56} y2={-4} stroke={ink} strokeWidth={12} strokeLinecap="round" />
      <line x1={-40} y1={-120} x2={-56} y2={-4} stroke={PALETTE.wood} strokeWidth={6} strokeLinecap="round" />
      <line x1={40} y1={-120} x2={56} y2={-4} stroke={ink} strokeWidth={12} strokeLinecap="round" />
      <line x1={40} y1={-120} x2={56} y2={-4} stroke={PALETTE.woodDark} strokeWidth={6} strokeLinecap="round" />
      <line x1={0} y1={-200} x2={0} y2={-10} stroke={ink} strokeWidth={11} strokeLinecap="round" />
      <line x1={0} y1={-200} x2={0} y2={-10} stroke={PALETTE.woodDark} strokeWidth={5} strokeLinecap="round" />
      <g transform={`rotate(${sway.toFixed(2)} 0 -100)`}>
        {/* frame */}
        <rect x={-60} y={-246} width={120} height={146} rx={10} fill="url(#mk-gen-portrait-frame)" stroke={ink} strokeWidth={6} />
        <rect x={-54} y={-240} width={108} height={8} rx={4} fill="#FFFFFF" opacity={0.3} />
        <rect x={-46} y={-232} width={92} height={118} rx={6} fill="url(#mk-gen-portrait-bg)" stroke={ink} strokeWidth={4} />
        <g clipPath="url(#mk-gen-portrait-clip)">
          <g transform={`translate(0 -114) scale(1 ${breath.toFixed(4)}) translate(0 114)`}>
            {/* shoulders / sweater */}
            <path d="M -44 -112 Q -42 -146 -14 -152 L 14 -152 Q 42 -146 44 -112 Z" fill="#4A5568" stroke={ink} strokeWidth={4} />
            <path d="M -36 -114 Q -34 -140 -14 -146 L -10 -128 Z" fill="#FFFFFF" opacity={0.15} />
            <path d="M -12 -152 L 0 -138 L 12 -152 Z" fill="#E2E8F0" stroke={ink} strokeWidth={3} />
            {/* neck */}
            <rect x={-8} y={-162} width={16} height={14} fill={PALETTE.tiSkin} stroke={ink} strokeWidth={3} />
            {/* head */}
            <ellipse cx={0} cy={-184} rx={22} ry={26} fill={PALETTE.tiSkin} stroke={ink} strokeWidth={4} />
            <ellipse cx={9} cy={-180} rx={11} ry={18} fill="#000000" opacity={0.08} />
            <ellipse cx={-10} cy={-192} rx={6} ry={8} fill="#FFFFFF" opacity={0.3} />
            {/* ears */}
            <circle cx={-22} cy={-182} r={5} fill={PALETTE.tiSkin} stroke={ink} strokeWidth={3} />
            <circle cx={22} cy={-182} r={5} fill={PALETTE.tiSkin} stroke={ink} strokeWidth={3} />
            {/* hair */}
            <path d="M -23 -188 Q -26 -214 0 -213 Q 26 -214 23 -188 Q 16 -202 4 -200 Q -10 -206 -23 -188 Z" fill="#6B4A2F" stroke={ink} strokeWidth={4} strokeLinejoin="round" />
            <path d="M -14 -206 Q -4 -211 8 -208" stroke="#A47A52" strokeWidth={3} fill="none" strokeLinecap="round" />
            {/* eyes */}
            <ellipse cx={-8} cy={-184} rx={3} ry={3.5 * blink} fill={ink} />
            <ellipse cx={8} cy={-184} rx={3} ry={3.5 * blink} fill={ink} />
            <path d="M -13 -192 L -4 -193" stroke="#6B4A2F" strokeWidth={2.5} strokeLinecap="round" />
            <path d="M 4 -193 L 13 -192" stroke="#6B4A2F" strokeWidth={2.5} strokeLinecap="round" />
            {/* smile and cheeks */}
            <path d="M -7 -170 Q 0 -165 7 -170" stroke={ink} strokeWidth={3} fill="none" strokeLinecap="round" />
            <circle cx={-14} cy={-174} r={3.5} fill="#F28B82" opacity={0.45} />
            <circle cx={14} cy={-174} r={3.5} fill="#F28B82" opacity={0.45} />
          </g>
          {/* glass shine */}
          <path d={`M ${shineX - 10} -232 L ${shineX + 8} -232 L ${shineX - 22} -114 L ${shineX - 40} -114 Z`} fill="#FFFFFF" opacity={0.28} />
        </g>
        {/* corner rivets */}
        <circle cx={-52} cy={-238} r={3} fill={PALETTE.warn} stroke={ink} strokeWidth={1.5} />
        <circle cx={52} cy={-238} r={3} fill={PALETTE.warn} stroke={ink} strokeWidth={1.5} />
        <circle cx={-52} cy={-108} r={3} fill={PALETTE.warn} stroke={ink} strokeWidth={1.5} />
        <circle cx={52} cy={-108} r={3} fill={PALETTE.warn} stroke={ink} strokeWidth={1.5} />
        {/* sparkle */}
        <path
          d="M 38 -226 L 41 -219 L 48 -216 L 41 -213 L 38 -206 L 35 -213 L 28 -216 L 35 -219 Z"
          fill="#FFFFFF"
          opacity={0.4 + 0.6 * sparkle}
          transform={`translate(38 -216) scale(${(0.7 + 0.3 * sparkle).toFixed(3)}) translate(-38 216)`}
        />
      </g>
      {/* ledge */}
      <rect x={-50} y={-104} width={100} height={12} rx={5} fill={PALETTE.wood} stroke={ink} strokeWidth={5} />
      <rect x={-44} y={-102} width={60} height={3} rx={1.5} fill="#FFFFFF" opacity={0.3} />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 66,
  height: 252,
  Component: PortraitFrame,
};
