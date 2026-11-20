import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const CY = -150;
const RAYS = 14;

/** Đèn pha xe ban đêm: tia sáng tỏa như pháo hoa, nhấp nháy nhẹ. */
const HeadlightNight: FC<PropProps> = ({ frame, seed }) => {
  const pulse = 0.5 + 0.5 * Math.sin(frame * 0.12);
  const glow = 0.75 + 0.25 * pulse;
  const rays = [];
  for (let i = 0; i < RAYS; i++) {
    const a = (i / RAYS) * Math.PI * 2 + 0.1;
    const tw = 0.5 + 0.5 * Math.sin(frame * 0.18 + i * 1.7 + seed);
    const base = i % 2 === 0 ? 78 : 58;
    const len = base * (0.82 + 0.18 * tw);
    const w = i % 2 === 0 ? 0.11 : 0.08;
    const r0 = 34;
    const x1 = Math.cos(a - w) * r0;
    const y1 = CY + Math.sin(a - w) * r0;
    const x2 = Math.cos(a + w) * r0;
    const y2 = CY + Math.sin(a + w) * r0;
    const xt = Math.cos(a) * len;
    const yt = CY + Math.sin(a) * len;
    rays.push(
      <polygon
        key={`r${i}`}
        points={`${x1.toFixed(2)},${y1.toFixed(2)} ${xt.toFixed(2)},${yt.toFixed(2)} ${x2.toFixed(2)},${y2.toFixed(2)}`}
        fill="#FFF3B0"
        opacity={0.45 + 0.5 * tw}
      />,
    );
    const sx = Math.cos(a) * (len + 6);
    const sy = CY + Math.sin(a) * (len + 6);
    if (i % 2 === 0 && sy < -14) {
      rays.push(
        <circle
          key={`s${i}`}
          cx={sx}
          cy={sy}
          r={2.5 + 2 * tw}
          fill="#FFFFFF"
          opacity={0.3 + 0.7 * tw}
        />,
      );
    }
  }
  const sway = 1.5 * wobble(frame, seed + 3, 90);
  return (
    <g>
      <defs>
        <radialGradient id="mk-gen-headlight-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#FFFBE0" stopOpacity={0.95} />
          <stop offset="55%" stopColor="#FFE27A" stopOpacity={0.45} />
          <stop offset="100%" stopColor="#FFC93C" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="mk-gen-headlight-lens" cx="0.35" cy="0.3" r="0.75">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="50%" stopColor="#FFF1A8" />
          <stop offset="100%" stopColor="#F5C842" />
        </radialGradient>
      </defs>
      <ContactShadow halfWidth={50} />
      {/* cột đỡ */}
      <rect x={-10} y={-108} width={20} height={104} rx={6} fill={PALETTE.metalDark} stroke={ink} strokeWidth={5} />
      <rect x={-6} y={-104} width={5} height={96} rx={2} fill="#FFFFFF" opacity={0.22} />
      <rect x={-38} y={-12} width={76} height={12} rx={6} fill={PALETTE.metalDark} stroke={ink} strokeWidth={5} />
      {/* quầng sáng */}
      <circle cx={0} cy={CY} r={86 * (0.92 + 0.08 * pulse)} fill="url(#mk-gen-headlight-glow)" opacity={glow} />
      <g transform={`rotate(${sway.toFixed(2)} 0 ${CY})`}>{rays}</g>
      {/* vỏ đèn */}
      <circle cx={0} cy={CY} r={42} fill="#3A4152" stroke={ink} strokeWidth={7} />
      <path d={`M -34 ${CY - 18} A 38 38 0 0 1 18 ${CY - 36}`} fill="none" stroke="#7D879C" strokeWidth={5} strokeLinecap="round" />
      <path d={`M 36 ${CY + 10} A 38 38 0 0 1 -6 ${CY + 38}`} fill="none" stroke="#1E222C" strokeWidth={5} strokeLinecap="round" opacity={0.6} />
      {/* mặt kính */}
      <circle cx={0} cy={CY} r={30} fill="url(#mk-gen-headlight-lens)" stroke={ink} strokeWidth={5} />
      <circle cx={0} cy={CY} r={14 + 3 * pulse} fill="#FFFFFF" opacity={0.75 + 0.25 * pulse} />
      <ellipse cx={-12} cy={CY - 13} rx={8} ry={5} fill="#FFFFFF" opacity={0.85} transform={`rotate(-35 -12 ${CY - 13})`} />
      <circle cx={13} cy={CY + 12} r={3} fill="#FFFFFF" opacity={0.6} />
      {/* ốc vít */}
      <circle cx={-30} cy={CY + 28} r={3.5} fill="#AEB6C6" stroke={ink} strokeWidth={2} />
      <circle cx={30} cy={CY + 28} r={3.5} fill="#AEB6C6" stroke={ink} strokeWidth={2} />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 240,
  Component: HeadlightNight,
};
