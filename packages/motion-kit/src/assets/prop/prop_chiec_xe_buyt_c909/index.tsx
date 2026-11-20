import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

/** Xe buýt vàng phanh gấp: thân chúi về trước, bánh khựng, khói và vạch chuyển động phía sau. */
const BusBraking: FC<PropProps> = ({ frame, seed }) => {
  const tilt = 4 + 1.5 * wobble(frame, seed, 26);
  const bob = 1.2 * wobble(frame, seed + 3, 13);
  const jitter = Math.sin(frame * 1.3) * 0.6;
  const brake = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(frame * 0.4));
  const headGlow = 0.5 + 0.5 * wobble(frame, seed + 9, 30);
  const dash = (frame * 3) % 40;

  const puffs = [0, 1, 2].map((i) => {
    const ph = ((frame + i * 20) % 60) / 60;
    const e = easing.out(ph);
    return {
      x: -64 - 14 * e,
      y: -12 - 16 * e,
      r: 5 + 6 * e,
      o: 0.75 * (1 - ph),
    };
  });

  const windows = [-50, -24, 2, 28];

  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-bus-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFD95A" />
          <stop offset="0.6" stopColor="#FFC22E" />
          <stop offset="1" stopColor="#E89B12" />
        </linearGradient>
        <linearGradient id="mk-gen-bus-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#D9F3FF" />
          <stop offset="1" stopColor={PALETTE.screen} />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={80} />

      {/* vệt bánh trượt trên đường */}
      <line x1={-86} y1={-2} x2={-50} y2={-2} stroke={ink} strokeWidth={4} strokeLinecap="round" opacity={0.35} />
      <line x1={-20} y1={-2} x2={36} y2={-2} stroke={ink} strokeWidth={4} strokeLinecap="round" opacity={0.3} />

      {/* vạch chuyển động */}
      <g stroke={ink} strokeWidth={4} strokeLinecap="round" opacity={0.55}>
        <line x1={-88} y1={-104} x2={-68} y2={-104} strokeDasharray="14 26" strokeDashoffset={dash} />
        <line x1={-86} y1={-86} x2={-66} y2={-86} strokeDasharray="10 30" strokeDashoffset={dash + 12} />
        <line x1={-88} y1={-68} x2={-68} y2={-68} strokeDasharray="14 26" strokeDashoffset={dash + 24} />
      </g>

      {/* khói phanh */}
      {puffs.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={p.r}
          fill={PALETTE.smoke}
          stroke={ink}
          strokeWidth={2.5}
          opacity={p.o}
        />
      ))}

      {/* thân xe chúi về trước */}
      <g transform={`translate(0 ${bob.toFixed(2)}) rotate(${tilt.toFixed(2)} 54 -14)`}>
        <path
          d="M -60 -30 L -60 -108 Q -60 -122 -46 -122 L 60 -122 Q 74 -122 76 -108 L 80 -60 L 80 -30 Q 80 -24 74 -24 L -54 -24 Q -60 -24 -60 -30 Z"
          fill="url(#mk-gen-bus-body)"
          stroke={ink}
          strokeWidth={6}
          strokeLinejoin="round"
        />
        {/* highlight mái */}
        <path d="M -50 -116 L 58 -116" stroke="#FFF3C4" strokeWidth={5} strokeLinecap="round" opacity={0.8} />
        {/* bóng dưới thân */}
        <rect x={-57} y={-40} width={134} height={13} rx={5} fill="#C9800A" opacity={0.45} />
        {/* sọc đen */}
        <rect x={-60} y={-58} width={140} height={7} fill={ink} />
        {/* cửa sổ */}
        {windows.map((wx, i) => (
          <g key={i}>
            <rect x={wx} y={-110} width={22} height={30} rx={5} fill="url(#mk-gen-bus-glass)" stroke={ink} strokeWidth={4} />
            <line x1={wx + 5} y1={-104} x2={wx + 11} y2={-96} stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={0.75} />
          </g>
        ))}
        {/* kính chắn gió */}
        <path
          d="M 56 -110 L 70 -110 Q 73 -110 73.5 -106 L 76 -72 L 56 -72 Z"
          fill="url(#mk-gen-bus-glass)"
          stroke={ink}
          strokeWidth={4}
          strokeLinejoin="round"
        />
        <line x1={61} y1={-104} x2={65} y2={-94} stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={0.75} />
        {/* đèn pha */}
        <circle cx={77} cy={-42} r={9} fill={PALETTE.warn} opacity={0.3 * headGlow} />
        <circle cx={76} cy={-42} r={5} fill="#FFF6C8" stroke={ink} strokeWidth={3} />
        {/* đèn phanh đỏ */}
        <circle cx={-60} cy={-44} r={10} fill={PALETTE.alert} opacity={0.3 * brake} />
        <rect x={-62} y={-50} width={8} height={12} rx={3} fill={PALETTE.alert} stroke={ink} strokeWidth={3} opacity={0.6 + 0.4 * brake} />
        {/* cản trước */}
        <rect x={68} y={-30} width={14} height={8} rx={3} fill={PALETTE.metal} stroke={ink} strokeWidth={3} />
        {/* hốc bánh */}
        <path d="M -52 -24 A 18 18 0 0 1 -16 -24 Z" fill={PALETTE.woodDark} stroke={ink} strokeWidth={4} />
        <path d="M 30 -24 A 18 18 0 0 1 66 -24 Z" fill={PALETTE.woodDark} stroke={ink} strokeWidth={4} />
      </g>

      {/* bánh xe khựng lại (không quay) */}
      {[-34, 48].map((wx, i) => (
        <g key={i} transform={`translate(${(wx + jitter).toFixed(2)} -15)`}>
          <ellipse cx={0} cy={0.5} rx={15.5} ry={14.5} fill={ink} />
          <circle cx={0} cy={0} r={7} fill={PALETTE.metal} stroke={PALETTE.metalDark} strokeWidth={2} />
          <circle cx={-2} cy={-2} r={2} fill="#FFFFFF" opacity={0.8} />
        </g>
      ))}
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 150,
  Component: BusBraking,
};
