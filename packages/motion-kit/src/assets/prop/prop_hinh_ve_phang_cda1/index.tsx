import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, clamp, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

/** Router đứng giữa ngã tư: đèn xanh nhấp nháy, mũi tên chỉ đường xoay sang từng ngả. */
const RouterCrossroad: FC<PropProps> = ({ frame, seed }) => {
  const step = 48;
  const idx = Math.floor(frame / step);
  const local = frame - idx * step;
  const turn = easing.outBack(1.8)(clamp(local / 14, 0, 1));
  const angle = ((idx % 4) + turn) * 90;
  const breathe = 1 + 0.015 * Math.sin(frame * 0.12);
  const sway = 2 * wobble(frame, seed + 3, 60);
  const glow = 0.5 + 0.5 * Math.sin(frame * 0.3);
  const packetX = -78 + ((frame * 2.2) % 156);
  const packetY = -48 + ((frame * 1.1) % 46);
  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-router-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7fb6ff" />
          <stop offset="0.55" stopColor={PALETTE.bitShell} />
          <stop offset="1" stopColor="#3d5f9e" />
        </linearGradient>
        <radialGradient id="mk-gen-router-dial" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor={PALETTE.paper} />
        </radialGradient>
      </defs>
      <ContactShadow halfWidth={80} />
      {/* ngã tư */}
      <rect x={-86} y={-30} width={172} height={26} rx={10} fill="#5b6270" stroke={ink} strokeWidth={5} />
      <polygon points="-30,0 30,0 18,-52 -18,-52" fill="#5b6270" stroke={ink} strokeWidth={5} strokeLinejoin="round" />
      <rect x={-26} y={-29} width={52} height={24} fill="#5b6270" />
      <rect x={-84} y={-28} width={168} height={6} rx={3} fill="#ffffff" opacity={0.12} />
      <line x1={-80} y1={-17} x2={-36} y2={-17} stroke="#f4f1e6" strokeWidth={3} strokeDasharray="8 7" strokeLinecap="round" />
      <line x1={36} y1={-17} x2={80} y2={-17} stroke="#f4f1e6" strokeWidth={3} strokeDasharray="8 7" strokeLinecap="round" />
      <line x1={0} y1={-50} x2={0} y2={-34} stroke="#f4f1e6" strokeWidth={3} strokeLinecap="round" />
      {/* gói dữ liệu chạy trên đường */}
      <rect x={packetX - 5} y={-21} width={10} height={8} rx={2} fill={PALETTE.ok} stroke={ink} strokeWidth={2} />
      <rect x={-4} y={packetY} width={8} height={7} rx={2} fill={PALETTE.warn} stroke={ink} strokeWidth={2} />
      <g transform={`translate(0 -40) scale(1 ${breathe.toFixed(4)}) translate(0 40)`}>
        {/* ăng-ten */}
        <line x1={-36} y1={-106} x2={-60 + sway} y2={-140} stroke={ink} strokeWidth={7} strokeLinecap="round" />
        <line x1={36} y1={-106} x2={60 - sway} y2={-140} stroke={ink} strokeWidth={7} strokeLinecap="round" />
        <circle cx={-60 + sway} cy={-142} r={6} fill={PALETTE.ok} stroke={ink} strokeWidth={3} />
        <circle cx={60 - sway} cy={-142} r={6} fill={PALETTE.ok} stroke={ink} strokeWidth={3} />
        {/* thân router */}
        <rect x={-54} y={-108} width={108} height={64} rx={14} fill="url(#mk-gen-router-body)" stroke={ink} strokeWidth={6} />
        <rect x={-44} y={-100} width={60} height={9} rx={4.5} fill="#ffffff" opacity={0.35} />
        <rect x={-50} y={-62} width={100} height={12} rx={6} fill={ink} opacity={0.15} />
        <rect x={-40} y={-50} width={14} height={8} rx={2} fill={PALETTE.metalDark} stroke={ink} strokeWidth={3} />
        <rect x={26} y={-50} width={14} height={8} rx={2} fill={PALETTE.metalDark} stroke={ink} strokeWidth={3} />
        {/* đèn xanh nhấp nháy */}
        {[0, 1, 2, 3].map((i) => {
          const on = 0.5 + 0.5 * Math.sin(frame * 0.35 - i * 1.4);
          const cx = -30 + i * 20;
          return (
            <g key={i}>
              <circle cx={cx} cy={-74} r={10} fill={PALETTE.ok} opacity={0.3 * on} />
              <circle cx={cx} cy={-74} r={5.5} fill={PALETTE.ok} stroke={ink} strokeWidth={2.5} opacity={0.35 + 0.65 * on} />
              <circle cx={cx - 1.8} cy={-76} r={1.6} fill="#ffffff" opacity={on} />
            </g>
          );
        })}
        {/* cột & biển mũi tên */}
        <rect x={-5} y={-150} width={10} height={44} rx={3} fill={PALETTE.metal} stroke={ink} strokeWidth={4} />
        <circle cx={0} cy={-182} r={38} fill={PALETTE.ok} opacity={0.15 + 0.15 * glow} />
        <circle cx={0} cy={-182} r={30} fill="url(#mk-gen-router-dial)" stroke={ink} strokeWidth={6} />
        <path d="M -20 -174 A 22 22 0 0 1 -6 -201" stroke="#ffffff" strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.8} />
        <g transform={`translate(0 -182) rotate(${angle.toFixed(2)})`}>
          <path d="M -17 -5 L 4 -5 L 4 -14 L 21 0 L 4 14 L 4 5 L -17 5 Z" fill={PALETTE.accent} stroke={ink} strokeWidth={3.5} strokeLinejoin="round" />
          <circle cx={0} cy={0} r={3.5} fill={ink} />
        </g>
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 88,
  height: 226,
  Component: RouterCrossroad,
};
