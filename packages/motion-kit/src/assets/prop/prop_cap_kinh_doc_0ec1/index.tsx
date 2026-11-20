import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, clamp, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const R = 28;
const CY = -74;
const LX = 38;

/** Cặp kính đọc sách gọng tròn: vệt sáng chạy chéo qua tròng kính, ánh lấp lánh nhẹ. */
const ReadingGlasses: FC<PropProps> = ({ frame, seed }) => {
  const period = 80;
  const phase = (frame % period) / period;
  const sweepT = (delay: number) => {
    const p = clamp((phase - delay) / 0.35, 0, 1);
    return easing.inOut(p);
  };
  const sL = -55 + 110 * sweepT(0.05);
  const sR = -55 + 110 * sweepT(0.15);
  const sparkleP = clamp((phase - 0.45) / 0.25, 0, 1);
  const sparkle = Math.sin(sparkleP * Math.PI);
  const sway = wobble(frame, seed, 110) * 1.6;
  const bob = 1.5 * wobble(frame, seed + 3, 70);
  const shine = 0.6 + 0.25 * wobble(frame, seed + 5, 40);
  const clipL = `mk-gen-kinh-clipL-${seed}`;
  const clipR = `mk-gen-kinh-clipR-${seed}`;
  const grad = `mk-gen-kinh-lens-${seed}`;
  const rimGrad = `mk-gen-kinh-rim-${seed}`;

  const lens = (cx: number, clip: string, sx: number) => (
    <g>
      <circle cx={cx} cy={CY} r={R} fill={`url(#${grad})`} />
      <g clipPath={`url(#${clip})`}>
        <g transform={`translate(${(cx + sx).toFixed(2)} ${CY}) rotate(35)`}>
          <rect x={-9} y={-50} width={14} height={100} fill="#FFFFFF" opacity={0.75} />
          <rect x={9} y={-50} width={5} height={100} fill="#FFFFFF" opacity={0.55} />
        </g>
        <circle cx={cx + 10} cy={CY + 12} r={R} fill="#4A7FA8" opacity={0.18} />
      </g>
      <path
        d={`M ${cx - 18} ${CY - 8} A 20 20 0 0 1 ${cx - 6} ${CY - 19}`}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={4}
        strokeLinecap="round"
        opacity={shine}
      />
      <circle cx={cx} cy={CY} r={R} fill="none" stroke={ink} strokeWidth={14} />
      <circle cx={cx} cy={CY} r={R} fill="none" stroke={`url(#${rimGrad})`} strokeWidth={7} />
      <path
        d={`M ${cx - 25} ${CY - 10} A 27 27 0 0 1 ${cx - 8} ${CY - 26}`}
        fill="none"
        stroke="#E9C08A"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </g>
  );

  return (
    <g>
      <ContactShadow halfWidth={70} />
      <defs>
        <radialGradient id={grad} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#EAF8FF" />
          <stop offset="100%" stopColor="#9FD3EE" />
        </radialGradient>
        <linearGradient id={rimGrad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={PALETTE.wood} />
          <stop offset="100%" stopColor={PALETTE.woodDark} />
        </linearGradient>
        <clipPath id={clipL}>
          <circle cx={-LX} cy={CY} r={R} />
        </clipPath>
        <clipPath id={clipR}>
          <circle cx={LX} cy={CY} r={R} />
        </clipPath>
      </defs>
      <g transform={`rotate(${sway.toFixed(2)}) translate(0 ${bob.toFixed(2)})`}>
        {/* càng kính gập phía sau, chạm đất */}
        <path
          d={`M ${-LX - 30} ${CY - 6} L ${-50} -10 Q ${-46} -2 ${-38} -4`}
          fill="none"
          stroke={ink}
          strokeWidth={9}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={`M ${-LX - 30} ${CY - 6} L ${-50} -10 Q ${-46} -2 ${-38} -4`}
          fill="none"
          stroke={PALETTE.woodDark}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={`M ${LX + 30} ${CY - 6} L ${50} -10 Q ${46} -2 ${38} -4`}
          fill="none"
          stroke={ink}
          strokeWidth={9}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={`M ${LX + 30} ${CY - 6} L ${50} -10 Q ${46} -2 ${38} -4`}
          fill="none"
          stroke={PALETTE.woodDark}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* cầu kính */}
        <path
          d={`M -12 ${CY - 8} Q 0 ${CY - 20} 12 ${CY - 8}`}
          fill="none"
          stroke={ink}
          strokeWidth={10}
          strokeLinecap="round"
        />
        <path
          d={`M -12 ${CY - 8} Q 0 ${CY - 20} 12 ${CY - 8}`}
          fill="none"
          stroke={PALETTE.wood}
          strokeWidth={4}
          strokeLinecap="round"
        />
        {lens(-LX, clipL, sL)}
        {lens(LX, clipR, sR)}
        {/* bản lề */}
        <rect x={-LX - 38} y={CY - 12} width={10} height={12} rx={3} fill={PALETTE.metal} stroke={ink} strokeWidth={3} />
        <rect x={LX + 28} y={CY - 12} width={10} height={12} rx={3} fill={PALETTE.metal} stroke={ink} strokeWidth={3} />
        <circle cx={-LX - 33} cy={CY - 6} r={1.8} fill={PALETTE.metalDark} />
        <circle cx={LX + 33} cy={CY - 6} r={1.8} fill={PALETTE.metalDark} />
        {/* đệm mũi */}
        <ellipse cx={-11} cy={CY + 6} rx={3.5} ry={5} fill="#FFFFFF" stroke={ink} strokeWidth={2} opacity={0.9} />
        <ellipse cx={11} cy={CY + 6} rx={3.5} ry={5} fill="#FFFFFF" stroke={ink} strokeWidth={2} opacity={0.9} />
        {/* lấp lánh */}
        <g
          transform={`translate(${LX + 14} ${CY - 18}) scale(${(0.2 + 0.9 * sparkle).toFixed(3)}) rotate(${(sparkleP * 45).toFixed(1)})`}
          opacity={sparkle}
        >
          <path d="M 0 -12 L 3 -3 L 12 0 L 3 3 L 0 12 L -3 3 L -12 0 L -3 -3 Z" fill="#FFFFFF" stroke={PALETTE.warn} strokeWidth={1.5} />
        </g>
        <circle cx={-LX - 16} cy={CY - 24} r={2.5} fill="#FFFFFF" opacity={0.4 + 0.5 * sparkle} />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 80,
  height: 120,
  Component: ReadingGlasses,
};
