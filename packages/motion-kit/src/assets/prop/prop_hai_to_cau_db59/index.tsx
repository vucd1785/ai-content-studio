import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { clamp, easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

/** Hai tờ câu trả lời: tờ phải bật dấu tích xanh + ngón cái, tờ trái mờ dần với chấm đỏ nhỏ. */
const HaiToCauTraLoi: FC<PropProps> = ({ frame, seed }) => {
  const cycle = 90;
  const p = (frame % cycle) / cycle;
  const popIn = clamp(p * 5, 0, 1);
  const popOut = clamp((p - 0.88) * 9, 0, 1);
  const checkScale = Math.max(0, easing.outBack(1.8)(popIn) * (1 - easing.in(popOut)));
  const fade = 0.45 + 0.3 * (0.5 + 0.5 * Math.cos(p * Math.PI * 2));
  const dotPulse = 0.6 + 0.4 * (0.5 + 0.5 * wobble(frame, seed + 3, 24));
  const thumbBob = 4 * wobble(frame, seed + 11, 40);
  const thumbTilt = 8 * wobble(frame, seed + 5, 52);
  const swayL = 1.2 * wobble(frame, seed, 80);
  const swayR = 1.5 * wobble(frame, seed + 9, 70);
  const glow = 0.25 + 0.2 * checkScale;
  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-paper-db59" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e6e1d3" />
        </linearGradient>
        <linearGradient id="mk-gen-wood-db59" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={PALETTE.wood} />
          <stop offset="100%" stopColor={PALETTE.woodDark} />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={86} />

      {/* Tờ trái: mờ dần */}
      <g transform={`rotate(${(-3 + swayL).toFixed(2)} -44 -20)`} opacity={fade}>
        <rect x={-78} y={-168} width={68} height={150} rx={8} fill="url(#mk-gen-paper-db59)" stroke={ink} strokeWidth={5} />
        <path d="M-26 -168 L-10 -152 L-10 -160 Q-10 -168 -18 -168 Z" fill="#d4cdb8" stroke={ink} strokeWidth={3} strokeLinejoin="round" />
        <rect x={-68} y={-150} width={36} height={6} rx={3} fill={PALETTE.metal} />
        <rect x={-68} y={-132} width={48} height={5} rx={2.5} fill={PALETTE.metal} opacity={0.8} />
        <rect x={-68} y={-118} width={42} height={5} rx={2.5} fill={PALETTE.metal} opacity={0.8} />
        <rect x={-68} y={-104} width={46} height={5} rx={2.5} fill={PALETTE.metal} opacity={0.8} />
        <rect x={-68} y={-90} width={30} height={5} rx={2.5} fill={PALETTE.metal} opacity={0.8} />
        <rect x={-74} y={-164} width={6} height={130} rx={3} fill="#ffffff" opacity={0.6} />
        <rect x={-18} y={-150} width={5} height={126} rx={2.5} fill={ink} opacity={0.12} />
        <circle cx={-44} cy={-56} r={13 * dotPulse} fill={PALETTE.alert} opacity={0.2} />
        <circle cx={-44} cy={-56} r={6} fill={PALETTE.alert} stroke={ink} strokeWidth={2.5} />
        <circle cx={-46} cy={-58} r={1.8} fill="#ffffff" opacity={0.8} />
      </g>

      {/* Tờ phải: đúng */}
      <g transform={`rotate(${(3 + swayR).toFixed(2)} 44 -20)`}>
        <rect x={6} y={-174} width={76} height={156} rx={10} fill={PALETTE.ok} opacity={glow * 0.6} />
        <rect x={10} y={-168} width={68} height={150} rx={8} fill="url(#mk-gen-paper-db59)" stroke={ink} strokeWidth={5} />
        <rect x={20} y={-150} width={36} height={6} rx={3} fill={PALETTE.screen} />
        <rect x={20} y={-132} width={48} height={5} rx={2.5} fill={PALETTE.metal} />
        <rect x={20} y={-118} width={42} height={5} rx={2.5} fill={PALETTE.metal} />
        <rect x={20} y={-104} width={46} height={5} rx={2.5} fill={PALETTE.metal} />
        <rect x={20} y={-90} width={30} height={5} rx={2.5} fill={PALETTE.metal} />
        <rect x={14} y={-164} width={6} height={130} rx={3} fill="#ffffff" opacity={0.6} />
        <rect x={70} y={-150} width={5} height={126} rx={2.5} fill={ink} opacity={0.12} />
        <g transform={`translate(44 -56) scale(${checkScale.toFixed(3)})`}>
          <circle cx={0} cy={0} r={20} fill={PALETTE.ok} stroke={ink} strokeWidth={4} />
          <circle cx={-6} cy={-7} r={6} fill="#ffffff" opacity={0.35} />
          <path d="M-10 0 L-3 8 L11 -8" fill="none" stroke="#ffffff" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </g>

      {/* Ngón cái giơ lên */}
      <g transform={`translate(66 ${(-176 + thumbBob).toFixed(2)}) rotate(${thumbTilt.toFixed(2)}) scale(${(0.6 + 0.4 * checkScale).toFixed(3)})`}>
        <circle cx={0} cy={0} r={22} fill={PALETTE.warn} opacity={0.3} />
        <rect x={-7} y={-22} width={11} height={22} rx={5.5} fill={PALETTE.tiSkin} stroke={ink} strokeWidth={4} />
        <rect x={-13} y={-4} width={26} height={22} rx={7} fill={PALETTE.tiSkin} stroke={ink} strokeWidth={4} />
        <line x1={-9} y1={4} x2={9} y2={4} stroke={ink} strokeWidth={2} opacity={0.5} />
        <line x1={-9} y1={10} x2={9} y2={10} stroke={ink} strokeWidth={2} opacity={0.5} />
        <rect x={-10} y={-1} width={5} height={14} rx={2.5} fill="#ffffff" opacity={0.4} />
      </g>

      {/* Lấp lánh */}
      <path
        d="M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2 Z"
        transform={`translate(84 -130) scale(${(0.5 + 0.6 * checkScale * dotPulse).toFixed(3)})`}
        fill={PALETTE.warn}
        stroke={ink}
        strokeWidth={1.5}
      />

      {/* Giá gỗ */}
      <rect x={-84} y={-24} width={168} height={20} rx={8} fill="url(#mk-gen-wood-db59)" stroke={ink} strokeWidth={5} />
      <rect x={-76} y={-20} width={150} height={4} rx={2} fill="#ffffff" opacity={0.3} />
      <circle cx={-44} cy={-14} r={3} fill={PALETTE.woodDark} />
      <circle cx={44} cy={-14} r={3} fill={PALETTE.woodDark} />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 210,
  Component: HaiToCauTraLoi,
};
