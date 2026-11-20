import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

/** Đôi đũa gỗ chụm lại kẹp cây bút đang rơi, vệt rơi phía trên, đũa khẽ run. */
const ChopsticksCatchPen: FC<PropProps> = ({ frame, seed }) => {
  const cycle = 60;
  const p = (frame % cycle) / cycle;
  const tremorAmp = 0.6 + 0.4 * (0.5 + 0.5 * wobble(frame, seed, 50));
  const tremor = Math.sin(frame * 1.9) * 0.9 * tremorAmp;
  const settle = p < 0.35 ? Math.sin(p / 0.35 * Math.PI * 2) * (1 - easing.out(p / 0.35)) * 4 : 0;
  const penY = settle + Math.sin(frame * 1.9 + 0.6) * 0.5 * tremorAmp;
  const penRot = Math.sin(frame * 1.9 + 1.2) * 1.2 * tremorAmp;
  const streakFade = 0.35 + 0.45 * (1 - easing.inOut(p));
  const streakShift = easing.out(p) * 10;
  const spark = 0.5 + 0.5 * wobble(frame, seed + 3, 24);

  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-d65a-wood" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#E9B77A" />
          <stop offset="0.5" stopColor={PALETTE.wood} />
          <stop offset="1" stopColor={PALETTE.woodDark} />
        </linearGradient>
        <linearGradient id="mk-gen-d65a-pen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7FB8FF" />
          <stop offset="0.55" stopColor={PALETTE.accent} />
          <stop offset="1" stopColor="#1F4F9A" />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={76} />

      {/* giá gác đũa */}
      <rect x={-66} y={-24} width={132} height={22} rx={11} fill={PALETTE.woodDark} stroke={ink} strokeWidth={5} />
      <rect x={-58} y={-20} width={100} height={6} rx={3} fill="#FFFFFF" opacity={0.25} />

      {/* vệt rơi */}
      <g opacity={streakFade} transform={`translate(0 ${(-streakShift).toFixed(2)})`}>
        <line x1={-14} y1={-250} x2={-14} y2={-232} stroke={PALETTE.smoke} strokeWidth={5} strokeLinecap="round" />
        <line x1={0} y1={-256} x2={0} y2={-234} stroke={PALETTE.smoke} strokeWidth={6} strokeLinecap="round" />
        <line x1={14} y1={-248} x2={14} y2={-232} stroke={PALETTE.smoke} strokeWidth={5} strokeLinecap="round" />
      </g>

      {/* đũa trái (phía sau bút) */}
      <g transform={`rotate(${tremor.toFixed(3)} -52 -22)`}>
        <path d="M -60 -20 L -46 -20 L -9 -176 L -14 -177 Z" fill="url(#mk-gen-d65a-wood)" stroke={ink} strokeWidth={5} strokeLinejoin="round" />
        <path d="M -54 -28 L -50 -28 L -14 -168" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" opacity={0.4} fill="none" />
        <path d="M -58 -44 L -44 -44" stroke={PALETTE.alert} strokeWidth={4} opacity={0.8} />
      </g>

      {/* cây bút */}
      <g transform={`translate(0 ${penY.toFixed(2)}) rotate(${penRot.toFixed(3)} 0 -172)`}>
        <path d="M -8 -142 L 8 -142 L 0 -120 Z" fill="#F4D7A8" stroke={ink} strokeWidth={4} strokeLinejoin="round" />
        <path d="M -3 -128 L 3 -128 L 0 -120 Z" fill={ink} />
        <rect x={-9} y={-224} width={18} height={84} rx={6} fill="url(#mk-gen-d65a-pen)" stroke={ink} strokeWidth={5} />
        <rect x={-9} y={-224} width={18} height={26} rx={6} fill="#1F4F9A" stroke={ink} strokeWidth={4} />
        <rect x={7} y={-220} width={5} height={30} rx={2.5} fill={PALETTE.metal} stroke={ink} strokeWidth={2.5} />
        <rect x={-6} y={-192} width={4} height={46} rx={2} fill="#FFFFFF" opacity={0.45} />
        <rect x={3} y={-192} width={3} height={46} rx={1.5} fill={ink} opacity={0.18} />
      </g>

      {/* đũa phải (phía trước bút) */}
      <g transform={`rotate(${(-tremor).toFixed(3)} 52 -22)`}>
        <path d="M 60 -20 L 46 -20 L 9 -176 L 14 -177 Z" fill="url(#mk-gen-d65a-wood)" stroke={ink} strokeWidth={5} strokeLinejoin="round" />
        <path d="M 48 -28 L 12 -168" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" opacity={0.35} fill="none" />
        <path d="M 58 -44 L 44 -44" stroke={PALETTE.alert} strokeWidth={4} opacity={0.8} />
      </g>

      {/* tia lấp lánh chỗ kẹp */}
      <g opacity={spark}>
        <path d="M -26 -186 L -20 -182 M -28 -172 L -21 -172" stroke={PALETTE.warn} strokeWidth={4} strokeLinecap="round" />
        <path d="M 26 -186 L 20 -182 M 28 -172 L 21 -172" stroke={PALETTE.warn} strokeWidth={4} strokeLinecap="round" />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 80,
  height: 262,
  Component: ChopsticksCatchPen,
};
