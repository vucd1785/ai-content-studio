import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, lerp, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const COLS = 11;
const ROWS = 6;
const K = (Math.PI * 2) / 70;
const W = (Math.PI * 2) / 40;
const AMP = 6;

/** Bảng hạt không khí: chấm tròn xanh nhạt rung nhẹ, xô vào nhau thành sóng chạy từ trái sang phải. */
const AirParticleWave: FC<PropProps> = ({ frame, seed }) => {
  const cols = Array.from({ length: COLS }, (_, i) => i);
  const rows = Array.from({ length: ROWS }, (_, j) => j);
  const p = (frame % 45) / 45;
  const arrowShift = lerp(-10, 10, easing.inOut(p));
  const arrowAlpha = 0.55 + 0.45 * Math.sin(p * Math.PI);
  const breathe = 1 + 0.01 * wobble(frame, seed + 3, 60);

  const colData = cols.map((i) => {
    const x0 = -70 + i * 14;
    const phase = K * x0 - W * frame;
    const dx = AMP * Math.sin(phase);
    const comp = Math.max(0, -Math.cos(phase));
    return { i, x0, dx, comp };
  });

  return (
    <g>
      <ContactShadow halfWidth={80} />
      <defs>
        <linearGradient id="mk-gen-airwave-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F4FBFF" />
          <stop offset="1" stopColor="#D6ECF8" />
        </linearGradient>
        <clipPath id="mk-gen-airwave-clip">
          <rect x={-78} y={-186} width={156} height={150} rx={14} />
        </clipPath>
      </defs>

      {/* feet */}
      <rect x={-66} y={-34} width={16} height={30} rx={6} fill={PALETTE.woodDark} stroke={ink} strokeWidth={5} />
      <rect x={50} y={-34} width={16} height={30} rx={6} fill={PALETTE.woodDark} stroke={ink} strokeWidth={5} />

      <g transform={`translate(0 -110) scale(${breathe.toFixed(4)}) translate(0 110)`}>
        {/* frame */}
        <rect x={-86} y={-194} width={172} height={166} rx={20} fill={PALETTE.wood} stroke={ink} strokeWidth={6} />
        <rect x={-80} y={-188} width={160} height={10} rx={5} fill="#FFFFFF" opacity={0.3} />
        {/* panel */}
        <rect x={-78} y={-186} width={156} height={150} rx={14} fill="url(#mk-gen-airwave-bg)" stroke={ink} strokeWidth={4} />

        <g clipPath="url(#mk-gen-airwave-clip)">
          {/* compression bands */}
          {colData.map((c) => (
            <rect
              key={`band-${c.i}`}
              x={c.x0 + c.dx - 8}
              y={-186}
              width={16}
              height={150}
              fill="#4FA8DD"
              opacity={0.18 * c.comp}
            />
          ))}
          {/* particles */}
          {colData.map((c) =>
            rows.map((j) => {
              const y0 = -165 + j * 22;
              const s = seed + c.i * 13 + j * 7;
              const jx = 1.5 * wobble(frame, s, 16);
              const jy = 1.8 * wobble(frame, s + 101, 19);
              const x = c.x0 + c.dx + jx;
              const y = y0 + jy;
              return (
                <g key={`p-${c.i}-${j}`}>
                  <circle cx={x} cy={y} r={5.5} fill="#BFE6FB" stroke="#2F6F99" strokeWidth={2.2} />
                  <circle cx={x} cy={y} r={5.5} fill="#3D93CC" opacity={0.55 * c.comp} />
                  <circle cx={x - 1.8} cy={y - 1.8} r={1.6} fill="#FFFFFF" opacity={0.9} />
                </g>
              );
            }),
          )}
          {/* glass shine */}
          <path d="M -78 -186 L -40 -186 L -78 -120 Z" fill="#FFFFFF" opacity={0.25} />
          <rect x={-78} y={-56} width={156} height={20} fill="#2F6F99" opacity={0.08} />
        </g>

        {/* corner rivets */}
        <circle cx={-76} cy={-184} r={3} fill={PALETTE.metal} stroke={ink} strokeWidth={1.5} />
        <circle cx={76} cy={-184} r={3} fill={PALETTE.metal} stroke={ink} strokeWidth={1.5} />
        <circle cx={-76} cy={-38} r={3} fill={PALETTE.metal} stroke={ink} strokeWidth={1.5} />
        <circle cx={76} cy={-38} r={3} fill={PALETTE.metal} stroke={ink} strokeWidth={1.5} />
      </g>

      {/* direction arrow */}
      <g transform={`translate(${arrowShift.toFixed(2)} -214)`} opacity={arrowAlpha}>
        <path
          d="M -44 -5 L 26 -5 L 26 -14 L 46 0 L 26 14 L 26 5 L -44 5 Z"
          fill={PALETTE.accent}
          stroke={ink}
          strokeWidth={4}
          strokeLinejoin="round"
        />
        <rect x={-40} y={-3} width={60} height={3} rx={1.5} fill="#FFFFFF" opacity={0.5} />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 232,
  Component: AirParticleWave,
};
