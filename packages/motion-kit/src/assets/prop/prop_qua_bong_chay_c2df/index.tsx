import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { clamp, easing, lerp, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const leather = "#A8662E";
const leatherLight = "#D39A5C";
const leatherDark = "#6E3F1C";
const lace = "#4E2B12";
const stitch = "#D7263D";

const CYCLE = 96;

/** Găng tay bóng chày bắt gọn quả bóng trắng chỉ đỏ bay tới, lóe sáng khi bắt trúng. */
const BaseballCatch: FC<PropProps> = ({ frame, seed }) => {
  const p = ((frame % CYCLE) + CYCLE) % CYCLE;

  // ball flight
  const fly = easing.inOut(clamp(p / 30, 0, 1));
  const bx = lerp(-64, 16, fly);
  const by = lerp(-212, -80, fly) - 40 * Math.sin(Math.PI * fly);
  const spin = fly * 540;
  const ballOpacity = p < 4 ? p / 4 : p > 80 ? clamp(1 - (p - 80) / 10, 0, 1) : 1;

  // glove closing
  let close = 0;
  if (p >= 30 && p < 40) close = easing.outBack(1.6)((p - 30) / 10);
  else if (p >= 40 && p < 80) close = 1;
  else if (p >= 80 && p < 92) close = 1 - easing.inOut((p - 80) / 12);

  // impact squash with follow-through
  const impact = p >= 30 && p < 70 ? Math.exp(-(p - 30) / 5) * Math.cos((p - 30) * 0.7) : 0;
  const breathe = 0.012 * wobble(frame, seed, 50);
  const sx = 1 + 0.08 * impact + breathe;
  const sy = 1 - 0.08 * impact - breathe;

  // sparkle
  const k = clamp((p - 30) / 16, 0, 1);
  const sparkleOn = p >= 30 && p < 46;
  const sparkleR = lerp(8, 34, easing.out(k));
  const sparkleO = sparkleOn ? 1 - k : 0;

  const trailO = p > 4 && p < 28 ? 0.5 : 0;
  const thumbAngle = close * 38;
  const fingerCurl = 1 - 0.1 * close;

  return (
    <g>
      <defs>
        <radialGradient id="mk-gen-ball-c2df" cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.7" stopColor="#F2EEE4" />
          <stop offset="1" stopColor="#CFC8B8" />
        </radialGradient>
        <linearGradient id="mk-gen-leather-c2df" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={leatherLight} />
          <stop offset="0.55" stopColor={leather} />
          <stop offset="1" stopColor={leatherDark} />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={70} />

      {/* motion trail */}
      <g opacity={trailO} stroke={PALETTE.paper} strokeWidth={4} strokeLinecap="round">
        <line x1={bx - 26} y1={by - 14} x2={bx - 50} y2={by - 26} />
        <line x1={bx - 22} y1={by + 4} x2={bx - 44} y2={by - 4} />
      </g>

      <g transform={`scale(${sx.toFixed(3)} ${sy.toFixed(3)})`}>
        <g transform="translate(6 -72)">
          {/* fingers */}
          <g transform={`translate(0 -20) scale(1 ${fingerCurl.toFixed(3)}) translate(0 20)`}>
            <rect x={-34} y={-74} width={24} height={70} rx={12} fill={leather} stroke={ink} strokeWidth={6} />
            <rect x={-12} y={-80} width={24} height={76} rx={12} fill={leather} stroke={ink} strokeWidth={6} />
            <rect x={10} y={-76} width={24} height={72} rx={12} fill={leather} stroke={ink} strokeWidth={6} />
            <rect x={32} y={-64} width={22} height={62} rx={11} fill={leatherDark} stroke={ink} strokeWidth={6} />
            <rect x={-28} y={-68} width={6} height={30} rx={3} fill={leatherLight} opacity={0.7} />
            <rect x={-6} y={-74} width={6} height={32} rx={3} fill={leatherLight} opacity={0.7} />
            <rect x={16} y={-70} width={6} height={30} rx={3} fill={leatherLight} opacity={0.6} />
          </g>
          {/* palm */}
          <ellipse cx={6} cy={4} rx={50} ry={46} fill="url(#mk-gen-leather-c2df)" stroke={ink} strokeWidth={7} />
          <ellipse cx={10} cy={2} rx={26} ry={22} fill={leatherDark} opacity={0.45} />
          <path d="M -20 -20 Q -6 -32 12 -28" fill="none" stroke={leatherLight} strokeWidth={5} strokeLinecap="round" opacity={0.8} />
          {/* cuff */}
          <rect x={-30} y={38} width={70} height={28} rx={10} fill={leatherDark} stroke={ink} strokeWidth={6} />
          <line x1={-22} y1={52} x2={32} y2={52} stroke={lace} strokeWidth={3} strokeDasharray="6 5" />
        </g>

        {/* ball */}
        <g transform={`translate(${bx.toFixed(2)} ${by.toFixed(2)}) rotate(${spin.toFixed(1)})`} opacity={ballOpacity}>
          <circle cx={0} cy={0} r={18} fill="url(#mk-gen-ball-c2df)" stroke={ink} strokeWidth={5} />
          <path d="M -9 -14 Q -3 0 -9 14" fill="none" stroke={stitch} strokeWidth={3} strokeDasharray="3 3" />
          <path d="M 9 -14 Q 3 0 9 14" fill="none" stroke={stitch} strokeWidth={3} strokeDasharray="3 3" />
          <circle cx={-6} cy={-8} r={4} fill="#FFFFFF" opacity={0.85} />
        </g>

        {/* thumb + webbing (front, closes over ball) */}
        <g transform="translate(6 -72)">
          <g transform={`rotate(${thumbAngle.toFixed(2)} -40 32)`}>
            <path d="M -40 -50 L -28 -38 M -42 -36 L -30 -26 M -44 -22 L -32 -14" stroke={lace} strokeWidth={4} strokeLinecap="round" />
            <ellipse cx={-50} cy={-4} rx={17} ry={40} fill={leather} stroke={ink} strokeWidth={6} />
            <ellipse cx={-55} cy={-12} rx={5} ry={20} fill={leatherLight} opacity={0.7} />
            <ellipse cx={-45} cy={10} rx={6} ry={18} fill={leatherDark} opacity={0.4} />
          </g>
        </g>
      </g>

      {/* catch sparkle */}
      <g transform="translate(22 -82)" opacity={sparkleO}>
        <circle cx={0} cy={0} r={sparkleR * 0.7} fill={PALETTE.warn} opacity={0.35} />
        <g stroke={PALETTE.warn} strokeWidth={5} strokeLinecap="round">
          <line x1={0} y1={-sparkleR * 0.5} x2={0} y2={-sparkleR} />
          <line x1={sparkleR * 0.5} y1={0} x2={sparkleR} y2={0} />
          <line x1={-sparkleR * 0.5} y1={0} x2={-sparkleR} y2={0} />
          <line x1={sparkleR * 0.35} y1={-sparkleR * 0.35} x2={sparkleR * 0.7} y2={-sparkleR * 0.7} />
          <line x1={-sparkleR * 0.35} y1={-sparkleR * 0.35} x2={-sparkleR * 0.7} y2={-sparkleR * 0.7} />
        </g>
        <circle cx={0} cy={0} r={5} fill="#FFFFFF" />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 86,
  height: 240,
  Component: BaseballCatch,
};
