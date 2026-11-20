import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const GLASS_PATH =
  "M -24 -84 C -24 -102 -60 -120 -60 -160 A 60 60 0 0 1 60 -160 C 60 -120 24 -102 24 -84 Z";
const COIL_PATH =
  "M -18 -150 L -13 -162 L -8 -150 L -3 -162 L 2 -150 L 7 -162 L 12 -150 L 18 -160";

/** Bóng đèn sợi đốt: sợi tóc đỏ cam rực sáng theo nhịp, vệt hơi nóng lượn sóng bốc lên. */
const HotBulb: FC<PropProps> = ({ frame, seed }) => {
  const p = (frame % 60) / 60;
  const tri = p < 0.5 ? p * 2 : 2 - p * 2;
  const glow = easing.inOut(tri);
  const flick = 0.5 + 0.5 * wobble(frame, seed, 24);
  const waves = [0, 1, 2].map((i) => {
    const ph = ((frame + i * 20) % 60) / 60;
    const rise = easing.out(ph) * 26;
    const op = Math.sin(Math.PI * ph);
    const sway = 4 * wobble(frame, seed + i * 5, 40);
    const x = -26 + i * 26 + sway;
    const y = -232 - rise;
    const d = `M ${x.toFixed(2)} ${y.toFixed(2)} q -8 -9 0 -18 q 8 -9 0 -18`;
    return { d, op, key: i };
  });
  return (
    <g>
      <defs>
        <radialGradient id="mk-gen-bulb-glass" cx="0.4" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#FFFBE0" />
          <stop offset="0.55" stopColor="#FFE58A" />
          <stop offset="1" stopColor="#F5B841" />
        </radialGradient>
        <radialGradient id="mk-gen-bulb-halo" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFD54A" stopOpacity="0.7" />
          <stop offset="1" stopColor="#FFD54A" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="mk-gen-bulb-cap" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#E3E7EC" />
          <stop offset="0.45" stopColor="#B7BEC7" />
          <stop offset="1" stopColor="#7C8693" />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={46} />
      {/* quầng sáng ấm */}
      <circle cx={0} cy={-158} r={60 + 8 * glow} fill="url(#mk-gen-bulb-halo)" opacity={0.5 + 0.5 * glow} />
      {/* đuôi đèn xoáy */}
      <path d="M -12 -14 L 12 -14 L 8 -2 Q 0 4 -8 -2 Z" fill={PALETTE.metalDark} stroke={ink} strokeWidth={5} strokeLinejoin="round" />
      <rect x={-28} y={-86} width={56} height={74} rx={8} fill="url(#mk-gen-bulb-cap)" stroke={ink} strokeWidth={6} />
      <path d="M -28 -66 Q 0 -58 28 -70" fill="none" stroke={ink} strokeWidth={4} strokeLinecap="round" />
      <path d="M -28 -48 Q 0 -40 28 -52" fill="none" stroke={ink} strokeWidth={4} strokeLinecap="round" />
      <path d="M -28 -30 Q 0 -22 28 -34" fill="none" stroke={ink} strokeWidth={4} strokeLinecap="round" />
      <rect x={-22} y={-82} width={8} height={64} rx={4} fill="#FFFFFF" opacity={0.45} />
      {/* bầu thủy tinh */}
      <path d={GLASS_PATH} fill="url(#mk-gen-bulb-glass)" stroke={ink} strokeWidth={6} strokeLinejoin="round" />
      {/* bóng đổ phía phải */}
      <path d="M 34 -205 A 58 58 0 0 1 40 -118 Q 52 -150 34 -205 Z" fill="#E08A1E" opacity={0.35} />
      {/* dây đỡ */}
      <path d="M -10 -86 L -10 -120 L -18 -150" fill="none" stroke={PALETTE.metalDark} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M 10 -86 L 10 -120 L 18 -160" fill="none" stroke={PALETTE.metalDark} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      {/* sợi tóc phát sáng */}
      <path d={COIL_PATH} fill="none" stroke="#FFB020" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" opacity={0.25 + 0.35 * glow} />
      <path d={COIL_PATH} fill="none" stroke={PALETTE.alert} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      <path d={COIL_PATH} fill="none" stroke="#FFE07A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.4 + 0.6 * glow * flick} />
      {/* ánh sáng phản chiếu trái-trên */}
      <path d="M -42 -170 Q -40 -200 -14 -210" fill="none" stroke="#FFFFFF" strokeWidth={8} strokeLinecap="round" opacity={0.75} />
      <circle cx={-44} cy={-150} r={4} fill="#FFFFFF" opacity={0.7} />
      {/* vệt hơi nóng */}
      {waves.map((w) => (
        <path key={w.key} d={w.d} fill="none" stroke="#F07A2A" strokeWidth={5} strokeLinecap="round" opacity={w.op * 0.85} />
      ))}
      {/* lấp lánh */}
      <g transform={`translate(50 -212) scale(${(0.6 + 0.5 * glow).toFixed(3)})`} opacity={0.4 + 0.6 * glow}>
        <path d="M 0 -9 L 2.5 -2.5 L 9 0 L 2.5 2.5 L 0 9 L -2.5 2.5 L -9 0 L -2.5 -2.5 Z" fill={PALETTE.warn} stroke={ink} strokeWidth={2} />
      </g>
      <g transform={`translate(-56 -112) scale(${(1.1 - 0.5 * glow).toFixed(3)})`} opacity={1 - 0.6 * glow}>
        <path d="M 0 -7 L 2 -2 L 7 0 L 2 2 L 0 7 L -2 2 L -7 0 L -2 -2 Z" fill={PALETTE.warn} stroke={ink} strokeWidth={2} />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 70,
  height: 290,
  Component: HotBulb,
};
