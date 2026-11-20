import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

/** Tầng đẩy tên lửa thân trắng đứng thẳng, chân gập sát thân, rung nhẹ và phụt lửa cam nhỏ ở đáy. */
const BoosterStage: FC<PropProps> = ({ frame, seed }) => {
  const shakeX = 1.2 * wobble(frame, seed, 5) + 0.6 * Math.sin(frame * 1.7);
  const shakeY = 0.8 * wobble(frame, seed + 3, 7);
  const raw = 0.5 + 0.5 * Math.sin(frame * 0.45);
  const pulse = easing.inOut(raw);
  const flick = wobble(frame, seed + 11, 4);
  const flameLen = 26 + 10 * pulse + 3 * flick;
  const flameW = 15 + 3 * pulse;
  const glow = 0.25 + 0.2 * pulse;
  const engineY = -46;

  const outer = `M ${-flameW} ${engineY} Q ${-flameW * 0.8} ${engineY + flameLen * 0.6} ${flick * 3} ${engineY + flameLen} Q ${flameW * 0.8} ${engineY + flameLen * 0.6} ${flameW} ${engineY} Z`;
  const inner = `M ${-flameW * 0.55} ${engineY} Q ${-flameW * 0.4} ${engineY + flameLen * 0.45} ${flick * 2} ${engineY + flameLen * 0.72} Q ${flameW * 0.4} ${engineY + flameLen * 0.45} ${flameW * 0.55} ${engineY} Z`;

  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-booster-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.45" stopColor="#f1f3f7" />
          <stop offset="1" stopColor="#c4cad6" />
        </linearGradient>
        <radialGradient id="mk-gen-booster-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffb347" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ff7a1a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ContactShadow halfWidth={50} />
      <ellipse cx={0} cy={-2} rx={46} ry={9} fill="url(#mk-gen-booster-glow)" opacity={glow + 0.3} />

      <g transform={`translate(${shakeX.toFixed(2)} ${shakeY.toFixed(2)})`}>
        {/* lửa */}
        <path d={outer} fill="#ff7a1a" stroke={ink} strokeWidth={4} strokeLinejoin="round" />
        <path d={inner} fill="#ffc94a" />
        <ellipse cx={0} cy={engineY + 5} rx={flameW * 0.3} ry={5 + 2 * pulse} fill="#fff6d6" opacity={0.9} />

        {/* chân sau (tối) */}
        <path d="M -30 -66 L -36 -150 L -28 -150 L -24 -70 Z" fill={PALETTE.metalDark} stroke={ink} strokeWidth={4} strokeLinejoin="round" />
        <path d="M 30 -66 L 36 -150 L 28 -150 L 24 -70 Z" fill={PALETTE.metalDark} stroke={ink} strokeWidth={4} strokeLinejoin="round" />

        {/* thân */}
        <rect x={-24} y={-296} width={48} height={236} rx={8} fill="url(#mk-gen-booster-body)" stroke={ink} strokeWidth={6} />
        <rect x={-17} y={-288} width={7} height={220} rx={3.5} fill="#ffffff" opacity={0.7} />
        <rect x={9} y={-288} width={10} height={220} rx={4} fill={PALETTE.metalDark} opacity={0.18} />

        {/* đai liên tầng màu đen trên đỉnh */}
        <rect x={-24} y={-296} width={48} height={30} rx={8} fill={ink} stroke={ink} strokeWidth={6} />
        <rect x={-18} y={-292} width={6} height={20} rx={3} fill="#ffffff" opacity={0.25} />

        {/* cánh lưới */}
        <g stroke={ink} strokeWidth={3}>
          <rect x={-36} y={-262} width={12} height={16} rx={2} fill={PALETTE.metal} />
          <line x1={-30} y1={-262} x2={-30} y2={-246} />
          <line x1={-36} y1={-254} x2={-24} y2={-254} />
          <rect x={24} y={-262} width={12} height={16} rx={2} fill={PALETTE.metal} />
          <line x1={30} y1={-262} x2={30} y2={-246} />
          <line x1={24} y1={-254} x2={36} y2={-254} />
        </g>

        {/* vạch sơn trang trí */}
        <rect x={-24} y={-210} width={48} height={8} fill={PALETTE.accent} opacity={0.85} />
        <rect x={-24} y={-198} width={48} height={4} fill={PALETTE.screen} opacity={0.7} />
        <line x1={-22} y1={-150} x2={22} y2={-150} stroke={ink} strokeWidth={2} opacity={0.35} />
        <line x1={-22} y1={-110} x2={22} y2={-110} stroke={ink} strokeWidth={2} opacity={0.35} />
        <circle cx={-14} cy={-240} r={2} fill={PALETTE.metalDark} />
        <circle cx={14} cy={-240} r={2} fill={PALETTE.metalDark} />
        <circle cx={-14} cy={-160} r={2} fill={PALETTE.metalDark} />
        <circle cx={14} cy={-160} r={2} fill={PALETTE.metalDark} />

        {/* chân trước gập sát thân */}
        <path d="M -20 -64 L -22 -144 L -12 -144 L -10 -66 Z" fill={PALETTE.ink} stroke={ink} strokeWidth={4} strokeLinejoin="round" />
        <path d="M 20 -64 L 22 -144 L 12 -144 L 10 -66 Z" fill={PALETTE.ink} stroke={ink} strokeWidth={4} strokeLinejoin="round" />
        <line x1={-18} y1={-136} x2={-17} y2={-74} stroke="#ffffff" strokeWidth={2} opacity={0.3} strokeLinecap="round" />

        {/* cụm động cơ */}
        <path d="M -26 -62 L 26 -62 L 22 -48 L -22 -48 Z" fill={PALETTE.metalDark} stroke={ink} strokeWidth={5} strokeLinejoin="round" />
        <path d="M -20 -50 L -14 -50 L -12 -42 L -22 -42 Z" fill={ink} stroke={ink} strokeWidth={3} strokeLinejoin="round" />
        <path d="M -5 -50 L 5 -50 L 7 -40 L -7 -40 Z" fill={ink} stroke={ink} strokeWidth={3} strokeLinejoin="round" />
        <path d="M 14 -50 L 20 -50 L 22 -42 L 12 -42 Z" fill={ink} stroke={ink} strokeWidth={3} strokeLinejoin="round" />
        <rect x={-22} y={-60} width={14} height={3} rx={1.5} fill="#ffffff" opacity={0.3} />
        <ellipse cx={0} cy={-41} rx={6} ry={2} fill="#ffb347" opacity={0.5 + 0.4 * pulse} />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 60,
  height: 306,
  Component: BoosterStage,
};
