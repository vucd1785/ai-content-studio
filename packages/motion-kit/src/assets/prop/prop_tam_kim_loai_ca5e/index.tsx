import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble, easing, clamp } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const COLD = "#3a8ee8";
const COLD_LIGHT = "#bfe3ff";
const HOT = "#f28a2e";
const HOT_LIGHT = "#ffd9a8";
const BOARD = "#3f9b6b";
const BOARD_DARK = "#2c7350";
const BOARD_LIGHT = "#7fd1a2";

const BLUE_PATH = "M -30 -96 L -30 -148 Q -30 -180 -60 -180 L -66 -180";
const ORANGE_PATH = "M 30 -96 L 30 -148 Q 30 -180 60 -180 L 66 -180";

/** Tấm kim loại làm mát áp lên chip, ống xanh đưa nước mát vào, ống cam đưa nước nóng ra, nước chảy theo nhịp. */
const ColdPlate: FC<PropProps> = ({ frame, seed }) => {
  // pulsing flow: speed rises and falls like a pump beat, but always moves forward
  const flow = 1.6 * (frame + 5 * Math.sin(frame * 0.18));
  const beat = 0.5 + 0.5 * Math.sin(frame * 0.18);
  const heat = 0.5 + 0.5 * wobble(frame, seed, 40);
  const sway = wobble(frame, seed + 3, 60) * 1.2;
  const dropPhase = (frame % 45) / 45;
  const dropUp = easing.out(dropPhase);
  const dropAlpha = clamp(1 - dropPhase * 1.2, 0, 1);
  const sparkle = 0.4 + 0.6 * Math.abs(wobble(frame, seed + 11, 24));
  const gid = `mk-gen-plate-${seed}`;
  const bid = `mk-gen-board-${seed}`;
  return (
    <g>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#eef3f7" />
          <stop offset="0.5" stopColor={PALETTE.metal} />
          <stop offset="1" stopColor={PALETTE.metalDark} />
        </linearGradient>
        <linearGradient id={bid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={BOARD_LIGHT} />
          <stop offset="0.35" stopColor={BOARD} />
          <stop offset="1" stopColor={BOARD_DARK} />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={80} />
      {/* feet */}
      <rect x={-70} y={-14} width={18} height={14} rx={4} fill={PALETTE.metalDark} stroke={ink} strokeWidth={4} />
      <rect x={52} y={-14} width={18} height={14} rx={4} fill={PALETTE.metalDark} stroke={ink} strokeWidth={4} />
      {/* circuit board */}
      <rect x={-80} y={-48} width={160} height={36} rx={9} fill={`url(#${bid})`} stroke={ink} strokeWidth={6} />
      <path d="M -72 -22 L -56 -22 L -50 -30 M 50 -30 L 56 -22 L 72 -22" stroke={BOARD_LIGHT} strokeWidth={3} fill="none" strokeLinecap="round" />
      <circle cx={-66} cy={-36} r={3.5} fill={PALETTE.warn} stroke={ink} strokeWidth={2} />
      <circle cx={66} cy={-36} r={3.5} fill={PALETTE.warn} stroke={ink} strokeWidth={2} />
      {/* chip with heat glow */}
      <ellipse cx={0} cy={-58} rx={62} ry={14} fill={PALETTE.alert} opacity={0.18 + 0.22 * heat} />
      <rect x={-46} y={-64} width={92} height={18} rx={4} fill="#2b2f3a" stroke={ink} strokeWidth={5} />
      {[-36, -24, -12, 0, 12, 24, 36].map((x) => (
        <line key={x} x1={x} y1={-46} x2={x} y2={-41} stroke={PALETTE.metal} strokeWidth={3} strokeLinecap="round" />
      ))}
      <rect x={-40} y={-60} width={80} height={4} rx={2} fill={HOT} opacity={0.35 + 0.45 * heat} />
      {/* cold plate */}
      <rect x={-58} y={-98} width={116} height={36} rx={9} fill={`url(#${gid})`} stroke={ink} strokeWidth={6} />
      <rect x={-50} y={-93} width={56} height={6} rx={3} fill="#ffffff" opacity={0.6} />
      <rect x={-54} y={-74} width={108} height={8} rx={4} fill={PALETTE.metalDark} opacity={0.35} />
      {[-46, 46].map((x) => (
        <g key={x}>
          <circle cx={x} cy={-80} r={5} fill={PALETTE.metal} stroke={ink} strokeWidth={2.5} />
          <line x1={x - 3} y1={-80} x2={x + 3} y2={-80} stroke={ink} strokeWidth={2} />
        </g>
      ))}
      {/* pipes */}
      <g transform={`rotate(${(-sway).toFixed(2)} -30 -96)`}>
        <path d={BLUE_PATH} stroke={ink} strokeWidth={24} fill="none" strokeLinejoin="round" />
        <path d={BLUE_PATH} stroke={COLD} strokeWidth={14} fill="none" strokeLinejoin="round" />
        <path d={BLUE_PATH} stroke={COLD_LIGHT} strokeWidth={6} fill="none" strokeLinecap="round" strokeDasharray="8 16" strokeDashoffset={flow.toFixed(2)} />
        <rect x={-80} y={-191} width={16} height={22} rx={4} fill={PALETTE.metal} stroke={ink} strokeWidth={4} />
        <rect x={-77} y={-187} width={4} height={14} rx={2} fill="#ffffff" opacity={0.6} />
      </g>
      <g transform={`rotate(${sway.toFixed(2)} 30 -96)`}>
        <path d={ORANGE_PATH} stroke={ink} strokeWidth={24} fill="none" strokeLinejoin="round" />
        <path d={ORANGE_PATH} stroke={HOT} strokeWidth={14} fill="none" strokeLinejoin="round" />
        <path d={ORANGE_PATH} stroke={HOT_LIGHT} strokeWidth={6} fill="none" strokeLinecap="round" strokeDasharray="8 16" strokeDashoffset={(-flow).toFixed(2)} />
        <rect x={64} y={-191} width={16} height={22} rx={4} fill={PALETTE.metal} stroke={ink} strokeWidth={4} />
        <rect x={67} y={-187} width={4} height={14} rx={2} fill="#ffffff" opacity={0.6} />
      </g>
      {/* pipe collars on plate */}
      <rect x={-42} y={-106} width={24} height={12} rx={4} fill={PALETTE.metalDark} stroke={ink} strokeWidth={4} />
      <rect x={18} y={-106} width={24} height={12} rx={4} fill={PALETTE.metalDark} stroke={ink} strokeWidth={4} />
      {/* cool sparkle near inlet */}
      <g transform={`translate(-8 -150) scale(${(0.7 + 0.4 * sparkle).toFixed(3)})`} opacity={sparkle}>
        <path d="M 0 -9 L 2.5 -2.5 L 9 0 L 2.5 2.5 L 0 9 L -2.5 2.5 L -9 0 L -2.5 -2.5 Z" fill={COLD_LIGHT} stroke={ink} strokeWidth={2} />
      </g>
      {/* warm droplet rising from outlet side */}
      <g opacity={dropAlpha} transform={`translate(8 ${(-120 - 30 * dropUp).toFixed(2)})`}>
        <path d="M 0 -8 Q 6 0 0 6 Q -6 0 0 -8 Z" fill={HOT_LIGHT} stroke={ink} strokeWidth={2} />
      </g>
      {/* pump beat indicator */}
      <circle cx={0} cy={-30} r={6 + 2 * beat} fill={PALETTE.ok} opacity={0.3 + 0.3 * beat} />
      <circle cx={0} cy={-30} r={4} fill={PALETTE.ok} stroke={ink} strokeWidth={2} />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 85,
  height: 200,
  Component: ColdPlate,
};
