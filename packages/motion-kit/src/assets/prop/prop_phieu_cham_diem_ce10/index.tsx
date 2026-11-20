import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { clamp, easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const STAR_GOLD = "#FFC93C";
const STAR_LIGHT = "#FFF0A6";
const STAR_SHADE = "#E59A1A";
const CHECK_RED = "#E8413A";
const CHECK_LIGHT = "#FF8C80";
const CYCLE = 96;

const starPath = (R: number): string => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? R : R * 0.47;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(Math.cos(a) * rad).toFixed(2)} ${(Math.sin(a) * rad).toFixed(2)}`);
  }
  return `M ${pts.join(" L ")} Z`;
};

const STAR_D = starPath(15);
const STAR_HI = starPath(8);

/** Phiếu chấm điểm: dấu tích đỏ to và ba ngôi sao vàng nảy lên lần lượt như đóng dấu khen. */
const PhieuChamDiem: FC<PropProps> = ({ frame, seed }) => {
  const sway = 1.4 * wobble(frame, seed, 80);
  const p = ((frame % CYCLE) + CYCLE) % CYCLE;
  const checkPulse = 1 + 0.05 * Math.max(0, wobble(frame, seed + 3, 30));
  const fadeOut = p > 86 ? 1 - (p - 86) / 10 : 1;

  const stars = [-34, 0, 34].map((x, i) => {
    const start = 8 + i * 14;
    const local = p - start;
    const k = clamp(local / 10, 0, 1);
    const s = local < 0 ? 0 : easing.outBack(2.2)(k) * fadeOut;
    const settle = local < 0 ? 0 : clamp((local - 10) / 14, 0, 1);
    const hop = local < 0 ? 0 : -14 * Math.sin(k * Math.PI) * (1 - settle);
    const squash = 1 + 0.12 * Math.sin(settle * Math.PI * 2) * (1 - settle);
    const ringT = clamp(local / 14, 0, 1);
    const ringOp = local < 0 ? 0 : (1 - ringT) * 0.8;
    return { x, s, hop, squash, ringT, ringOp, i };
  });

  const sparkle = 0.5 + 0.5 * wobble(frame, seed + 11, 24);

  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-paper-ce10" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#E9E2CF" />
        </linearGradient>
        <linearGradient id="mk-gen-board-ce10" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={PALETTE.wood} />
          <stop offset="1" stopColor={PALETTE.woodDark} />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={66} />
      {/* chân giá */}
      <line x1={-38} y1={-44} x2={-54} y2={-4} stroke={ink} strokeWidth={11} strokeLinecap="round" />
      <line x1={-38} y1={-44} x2={-54} y2={-4} stroke={PALETTE.woodDark} strokeWidth={5} strokeLinecap="round" />
      <line x1={38} y1={-44} x2={54} y2={-4} stroke={ink} strokeWidth={11} strokeLinecap="round" />
      <line x1={38} y1={-44} x2={54} y2={-4} stroke={PALETTE.woodDark} strokeWidth={5} strokeLinecap="round" />
      <g transform={`rotate(${sway.toFixed(2)} 0 -40)`}>
        {/* bảng kẹp */}
        <rect x={-64} y={-236} width={128} height={198} rx={12} fill="url(#mk-gen-board-ce10)" stroke={ink} strokeWidth={6} />
        {/* giấy */}
        <rect x={-53} y={-222} width={106} height={172} rx={6} fill="url(#mk-gen-paper-ce10)" stroke={ink} strokeWidth={4} />
        <rect x={-49} y={-218} width={8} height={164} rx={4} fill="#FFFFFF" opacity={0.7} />
        <rect x={35} y={-218} width={14} height={164} rx={4} fill="#C9BFA6" opacity={0.35} />
        {/* dòng kẻ */}
        <rect x={-38} y={-206} width={44} height={6} rx={3} fill={PALETTE.metal} />
        <rect x={-38} y={-194} width={70} height={5} rx={2.5} fill={PALETTE.metal} opacity={0.6} />
        <rect x={-38} y={-106} width={76} height={4} rx={2} fill={PALETTE.metal} opacity={0.45} />
        {/* dấu tích đỏ */}
        <g transform={`translate(2 -150) scale(${checkPulse.toFixed(3)}) translate(-2 150)`}>
          <path d="M -30 -150 L -8 -126 L 36 -182" fill="none" stroke={ink} strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M -30 -150 L -8 -126 L 36 -182" fill="none" stroke={CHECK_RED} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M -29 -152 L -9 -130 L 32 -181" fill="none" stroke={CHECK_LIGHT} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" opacity={0.75} />
        </g>
        {/* kẹp kim loại */}
        <rect x={-26} y={-246} width={52} height={22} rx={7} fill={PALETTE.metal} stroke={ink} strokeWidth={5} />
        <rect x={-20} y={-242} width={22} height={5} rx={2.5} fill="#FFFFFF" opacity={0.6} />
        <circle cx={0} cy={-231} r={4} fill={PALETTE.metalDark} />
        {/* ba ngôi sao */}
        {stars.map((st) => (
          <g key={st.i} transform={`translate(${st.x} ${(-76 + st.hop).toFixed(2)})`}>
            <circle r={8 + 18 * st.ringT} fill="none" stroke={STAR_GOLD} strokeWidth={3} opacity={st.ringOp} />
            <g transform={`scale(${(st.s * st.squash).toFixed(3)} ${(st.s / st.squash).toFixed(3)})`}>
              <path d={STAR_D} fill={STAR_GOLD} stroke={ink} strokeWidth={4} strokeLinejoin="round" />
              <path d={STAR_D} fill={STAR_SHADE} opacity={0.35} transform="translate(3 3) scale(0.8)" />
              <path d={STAR_HI} fill={STAR_LIGHT} opacity={0.85} transform="translate(-3 -3)" />
            </g>
          </g>
        ))}
        {/* lấp lánh */}
        <g transform={`translate(44 -196) scale(${(0.6 + 0.5 * sparkle).toFixed(3)})`} opacity={0.4 + 0.6 * sparkle}>
          <path d="M 0 -8 L 2 -2 L 8 0 L 2 2 L 0 8 L -2 2 L -8 0 L -2 -2 Z" fill={STAR_GOLD} stroke={ink} strokeWidth={1.5} />
        </g>
        <g transform={`translate(-44 -120) scale(${(1.1 - 0.5 * sparkle).toFixed(3)})`} opacity={1 - 0.6 * sparkle}>
          <path d="M 0 -6 L 1.5 -1.5 L 6 0 L 1.5 1.5 L 0 6 L -1.5 1.5 L -6 0 L -1.5 -1.5 Z" fill={STAR_GOLD} stroke={ink} strokeWidth={1.5} />
        </g>
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 72,
  height: 260,
  Component: PhieuChamDiem,
};
