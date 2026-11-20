import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";

const ink = PALETTE.ink;

/** Trái Đất chia đôi ngày và đêm: nửa trái sáng vàng hướng về Mặt Trời nhỏ, nửa phải xanh đậm có sao; ranh giới khẽ lung linh. */
const TraiDatNgayDem: FC<PropProps> = ({ frame, seed }) => {
  const cx = 14;
  const r = 62;
  const loop = (frame % 90) / 90;
  const bobT = easing.inOut(loop < 0.5 ? loop * 2 : 2 - loop * 2);
  const cy = -104 + (bobT - 0.5) * 6;
  const sunGlow = 0.5 + 0.5 * wobble(frame, seed + 3, 40);
  const sunScale = 1 + 0.06 * sunGlow;
  const clipId = `mk-gen-earth-clip-${seed}`;
  const dayId = `mk-gen-earth-day-${seed}`;
  const nightId = `mk-gen-earth-night-${seed}`;
  const sunId = `mk-gen-earth-sun-${seed}`;

  // Wavy terminator line
  const pts: string[] = [];
  for (let i = 0; i <= 16; i++) {
    const y = cy - r - 4 + ((2 * r + 8) * i) / 16;
    const x = cx + 4 * Math.sin(i * 0.8 + frame * 0.12) + 2 * wobble(frame, seed + i, 30);
    pts.push(`${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  const termLine = `M ${pts.join(" L ")}`;
  const dayPath = `M ${cx - r - 10} ${(cy - r - 4).toFixed(2)} L ${pts.join(" L ")} L ${cx - r - 10} ${(cy + r + 4).toFixed(2)} Z`;

  const stars = [
    { x: 42, y: -30, s: 5, p: 34 },
    { x: 58, y: 4, s: 4, p: 28 },
    { x: 36, y: 30, s: 6, p: 40 },
    { x: 26, y: -48, s: 3.5, p: 24 },
    { x: 50, y: 38, s: 3, p: 30 },
  ];

  const sx = -66;
  const sy = -176;

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
        <radialGradient id={dayId} cx="0.3" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#FFF3B0" />
          <stop offset="0.6" stopColor="#FFD54F" />
          <stop offset="1" stopColor="#F2A93B" />
        </radialGradient>
        <radialGradient id={nightId} cx="0.7" cy="0.4" r="0.8">
          <stop offset="0" stopColor="#2B3F8C" />
          <stop offset="1" stopColor="#141E4F" />
        </radialGradient>
        <radialGradient id={sunId} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFE680" stopOpacity="0.9" />
          <stop offset="1" stopColor="#FFE680" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Mặt Trời nhỏ */}
      <circle cx={sx} cy={sy} r={22 + 4 * sunGlow} fill={`url(#${sunId})`} />
      <g transform={`translate(${sx} ${sy}) scale(${sunScale.toFixed(3)}) rotate(${(frame * 0.8).toFixed(2)})`}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <line
            key={i}
            x1={0}
            y1={-16}
            x2={0}
            y2={-21}
            transform={`rotate(${i * 45})`}
            stroke={PALETTE.warn}
            strokeWidth={4}
            strokeLinecap="round"
          />
        ))}
        <circle cx={0} cy={0} r={12} fill={PALETTE.warn} stroke={ink} strokeWidth={4} />
        <circle cx={-4} cy={-4} r={4} fill="#FFF6C8" />
      </g>

      {/* Tia sáng chiếu về phía Trái Đất */}
      <path
        d={`M ${sx + 14} ${sy + 10} L ${cx - 20} ${cy - r + 6} L ${cx - r + 4} ${cy - 10} Z`}
        fill="#FFE680"
        opacity={0.18 + 0.12 * sunGlow}
      />

      {/* Thân Trái Đất */}
      <g clipPath={`url(#${clipId})`}>
        <rect x={cx - r - 10} y={cy - r - 10} width={2 * r + 20} height={2 * r + 20} fill={`url(#${nightId})`} />
        {/* lục địa phía đêm */}
        <path
          d={`M ${cx + 20} ${cy - 40} q 22 -8 30 10 q 6 18 -10 22 q -16 4 -20 -12 z`}
          fill="#1F5A4A"
          stroke={ink}
          strokeWidth={3}
        />
        <path
          d={`M ${cx + 14} ${cy + 18} q 20 -6 26 12 q -4 18 -22 14 q -10 -8 -4 -26 z`}
          fill="#1F5A4A"
          stroke={ink}
          strokeWidth={3}
        />
        {/* nửa ngày */}
        <path d={dayPath} fill={`url(#${dayId})`} />
        <g clipPath={`url(#${clipId})`}>
          <path
            d={`M ${cx - 44} ${cy - 30} q 14 -20 34 -8 q 14 10 4 26 q -14 14 -30 4 q -14 -8 -8 -22 z`}
            fill={PALETTE.leaf}
            stroke={ink}
            strokeWidth={3}
            opacity={0.95}
          />
          <path
            d={`M ${cx - 30} ${cy + 20} q 18 -4 22 14 q 0 16 -16 18 q -14 -6 -6 -32 z`}
            fill={PALETTE.leaf}
            stroke={ink}
            strokeWidth={3}
          />
          <ellipse cx={cx - 36} cy={cy - 24} rx={8} ry={4} fill="#D6F5A8" opacity={0.6} />
        </g>
        {/* ánh sáng lung linh ở ranh giới */}
        <path
          d={termLine}
          fill="none"
          stroke="#FFE9A8"
          strokeWidth={10 + 4 * sunGlow}
          opacity={0.25 + 0.2 * sunGlow}
        />
        <path d={termLine} fill="none" stroke="#FFF6D6" strokeWidth={3} opacity={0.8} strokeLinecap="round" />
        {/* sao lấp lánh */}
        {stars.map((s, i) => {
          const tw = 0.5 + 0.5 * wobble(frame, seed + 11 + i * 5, s.p);
          const k = s.s * (0.7 + 0.5 * tw);
          const x = cx + s.x;
          const y = cy + s.y;
          return (
            <path
              key={i}
              d={`M ${x} ${(y - k).toFixed(2)} Q ${x} ${y} ${(x + k).toFixed(2)} ${y} Q ${x} ${y} ${x} ${(y + k).toFixed(2)} Q ${x} ${y} ${(x - k).toFixed(2)} ${y} Q ${x} ${y} ${x} ${(y - k).toFixed(2)} Z`}
              fill="#FFF8D8"
              opacity={0.5 + 0.5 * tw}
            />
          );
        })}
        {/* bóng khối bên phải và highlight trái */}
        <circle cx={cx + 18} cy={cy + 12} r={r} fill="none" stroke="#0A1033" strokeWidth={18} opacity={0.25} />
      </g>
      <ellipse cx={cx - 30} cy={cy - 38} rx={14} ry={7} fill="#FFFFFF" opacity={0.45} transform={`rotate(-35 ${cx - 30} ${cy - 38})`} />
      <circle cx={cx - 46} cy={cy - 18} r={3.5} fill="#FFFFFF" opacity={0.5} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={ink} strokeWidth={6} />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 210,
  Component: TraiDatNgayDem,
};
