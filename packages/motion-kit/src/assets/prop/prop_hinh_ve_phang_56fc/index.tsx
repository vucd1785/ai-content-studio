import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

const CHILE_PATH =
  "M -2 -280 C 5 -266, 7 -240, 5 -212 C 3 -182, 7 -152, 5 -122 C 3 -92, 5 -64, 3 -44 C 1 -34, -5 -28, -12 -24 C -7 -32, -5 -40, -6 -54 C -8 -84, -6 -114, -6 -144 C -6 -174, -8 -204, -8 -232 C -8 -256, -8 -272, -2 -280 Z";

const MOUNTAINS = [-268, -236, -204, -172, -140, -108, -76, -46];
const WAVES = [-250, -205, -160, -115, -70];
const SPARKS = [0, 1, 2];

/** Bản đồ dải đất Chile dài mảnh như sợi mì, biển xanh bên trái, núi nâu bên phải, lấp lánh nhẹ. */
const ChileMap: FC<PropProps> = ({ frame, seed }) => {
  const sway = 1.2 * wobble(frame, seed, 90);
  const shimmer = 0.5 + 0.5 * Math.sin(frame * 0.12);
  const waveShift = 3 * wobble(frame, seed + 3, 50);
  return (
    <g>
      <ContactShadow halfWidth={62} />
      <defs>
        <linearGradient id="mk-gen-sea-56fc" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7fd3f5" />
          <stop offset="1" stopColor="#2f86c9" />
        </linearGradient>
        <linearGradient id="mk-gen-chile-56fc" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffc06a" />
          <stop offset="0.5" stopColor="#ff8a1f" />
          <stop offset="1" stopColor="#d9620a" />
        </linearGradient>
      </defs>
      <rect x={-34} y={-14} width={68} height={12} rx={6} fill={PALETTE.woodDark} stroke={ink} strokeWidth={5} />
      <g transform={`rotate(${sway.toFixed(2)} 0 -10)`}>
        <rect x={-60} y={-298} width={120} height={286} rx={14} fill={PALETTE.wood} stroke={ink} strokeWidth={7} />
        <rect x={-52} y={-290} width={104} height={270} rx={8} fill="url(#mk-gen-sea-56fc)" />
        <rect x={0} y={-290} width={52} height={270} rx={8} fill="#e8d3a6" />
        <rect x={0} y={-290} width={14} height={270} fill="#e8d3a6" />
        {WAVES.map((wy, i) => (
          <path
            key={`w${i}`}
            d={`M ${-46 + waveShift} ${wy} q 6 -5 12 0 q 6 5 12 0`}
            fill="none"
            stroke="#d8f3ff"
            strokeWidth={3}
            strokeLinecap="round"
            opacity={0.8}
          />
        ))}
        {MOUNTAINS.map((my, i) => (
          <g key={`m${i}`}>
            <path
              d={`M 10 ${my + 22} L ${24 + (i % 2) * 6} ${my - 4} L ${44 - (i % 2) * 4} ${my + 22} Z`}
              fill="#9a6034"
              stroke={ink}
              strokeWidth={3}
              strokeLinejoin="round"
            />
            <path
              d={`M ${24 + (i % 2) * 6} ${my - 4} L ${30 + (i % 2) * 4} ${my + 6} L ${44 - (i % 2) * 4} ${my + 22} L ${36} ${my + 22} Z`}
              fill="#5e3a1d"
              opacity={0.45}
            />
            <path
              d={`M ${24 + (i % 2) * 6} ${my - 4} L ${20 + (i % 2) * 6} ${my + 4} L ${28 + (i % 2) * 6} ${my + 4} Z`}
              fill="#ffffff"
              opacity={0.85}
            />
          </g>
        ))}
        <path d={CHILE_PATH} fill="url(#mk-gen-chile-56fc)" stroke={ink} strokeWidth={5} strokeLinejoin="round" />
        <path
          d="M -4 -268 C -5 -230, -4 -190, -4 -150 C -4 -110, -3 -80, -2 -56"
          fill="none"
          stroke="#fff3d6"
          strokeWidth={2.5}
          strokeLinecap="round"
          opacity={0.35 + 0.5 * shimmer}
        />
        {SPARKS.map((i) => {
          const p = ((frame + i * 30) % 90) / 90;
          const y = -270 + easing.inOut(p) * 230;
          const s = Math.sin(p * Math.PI);
          const r = 7 * s;
          return (
            <path
              key={`s${i}`}
              d={`M 0 ${y - r} L ${r * 0.3} ${y - r * 0.3} L ${r} ${y} L ${r * 0.3} ${y + r * 0.3} L 0 ${y + r} L ${-r * 0.3} ${y + r * 0.3} L ${-r} ${y} L ${-r * 0.3} ${y - r * 0.3} Z`}
              fill="#fffbe6"
              opacity={0.9 * s}
            />
          );
        })}
        <rect x={-52} y={-290} width={104} height={20} rx={8} fill="#ffffff" opacity={0.18} />
        <rect x={-60} y={-298} width={120} height={286} rx={14} fill="none" stroke={ink} strokeWidth={7} />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 70,
  height: 304,
  Component: ChileMap,
};
