import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const TICKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const SAMPLES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

/** Cuộn thước dây vàng: dải thước có vạch đen uốn lượn, rung nhẹ. */
const TapeMeasure: FC<PropProps> = ({ frame, seed }) => {
  const phase = frame * 0.12 + seed * 0.7;
  const amp = 7 + 2 * wobble(frame, seed + 3, 60);
  const tapeX = (u: number) => 2 + 76 * u;
  const tapeY = (u: number) => -22 - 36 * u + Math.sin(u * Math.PI * 2.2 - phase) * amp * u;
  const pts = SAMPLES.map((i) => {
    const u = i / 20;
    return `${tapeX(u).toFixed(2)},${tapeY(u).toFixed(2)}`;
  });
  const tapePath = `M ${pts.join(" L ")}`;
  const endX = tapeX(1);
  const endY = tapeY(1);
  const dEnd = tapeY(1) - tapeY(0.97);
  const endAngle = (Math.atan2(dEnd, 76 * 0.03) * 180) / Math.PI;
  const breathe = 1 + 0.025 * Math.sin(frame * 0.1 + seed);
  const shine = 0.35 + 0.2 * (0.5 + 0.5 * wobble(frame, seed + 9, 40));

  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-tape-case" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFE27A" />
          <stop offset="0.55" stopColor="#F7C531" />
          <stop offset="1" stopColor="#D99A12" />
        </linearGradient>
        <radialGradient id="mk-gen-tape-hub" cx="0.35" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor={PALETTE.metalDark} />
        </radialGradient>
      </defs>
      <ContactShadow halfWidth={86} />

      {/* dải thước */}
      <path d={tapePath} fill="none" stroke={ink} strokeWidth={18} strokeLinecap="round" strokeLinejoin="round" />
      <path d={tapePath} fill="none" stroke="#F9D33F" strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
      <path d={tapePath} fill="none" stroke="#FFF2B0" strokeWidth={3} strokeLinecap="round" opacity={0.6} transform="translate(-1 -3)" />
      {TICKS.map((i) => {
        const u = i / 14;
        const x = tapeX(u);
        const y = tapeY(u);
        const dx = tapeX(u + 0.01) - x;
        const dy = tapeY(u + 0.01) - y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const tick = i % 2 === 0 ? 9 : 5;
        return (
          <line
            key={i}
            x1={(x + nx * 5.5).toFixed(2)}
            y1={(y + ny * 5.5).toFixed(2)}
            x2={(x + nx * (5.5 - tick)).toFixed(2)}
            y2={(y + ny * (5.5 - tick)).toFixed(2)}
            stroke={ink}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        );
      })}

      {/* móc đầu thước */}
      <g transform={`translate(${endX.toFixed(2)} ${endY.toFixed(2)}) rotate(${endAngle.toFixed(2)})`}>
        <rect x={-3} y={-9} width={7} height={18} rx={2} fill={PALETTE.metal} stroke={ink} strokeWidth={3} />
        <rect x={-1.5} y={-7} width={2} height={10} rx={1} fill="#FFFFFF" opacity={0.6} />
      </g>

      {/* vỏ thước */}
      <g transform={`translate(-44 0) scale(${(2 - breathe).toFixed(4)} ${breathe.toFixed(4)}) translate(44 0)`}>
        <rect x={-84} y={-96} width={84} height={92} rx={26} fill="url(#mk-gen-tape-case)" stroke={ink} strokeWidth={6} />
        <path d="M -12 -90 Q -4 -60 -10 -12 L -20 -8 Q -14 -50 -22 -92 Z" fill="#B87E0A" opacity={0.35} />
        <path d="M -74 -70 Q -72 -88 -54 -90" fill="none" stroke="#FFFFFF" strokeWidth={6} strokeLinecap="round" opacity={shine} />
        {/* lỗ ra thước */}
        <rect x={-10} y={-32} width={12} height={20} rx={4} fill={PALETTE.woodDark} stroke={ink} strokeWidth={4} />
        {/* nút khoá */}
        <rect x={-58} y={-108} width={26} height={16} rx={7} fill={PALETTE.alert} stroke={ink} strokeWidth={4} />
        <rect x={-54} y={-105} width={10} height={4} rx={2} fill="#FFFFFF" opacity={0.5} />
        {/* trục giữa */}
        <circle cx={-42} cy={-52} r={22} fill="#E8AE1C" stroke={ink} strokeWidth={4} />
        <circle cx={-42} cy={-52} r={11} fill="url(#mk-gen-tape-hub)" stroke={ink} strokeWidth={3} />
        <circle cx={-46} cy={-56} r={3} fill="#FFFFFF" opacity={0.8} />
        {/* đinh tán */}
        <circle cx={-72} cy={-18} r={3.5} fill={PALETTE.metal} stroke={ink} strokeWidth={2} />
        <circle cx={-72} cy={-84} r={3.5} fill={PALETTE.metal} stroke={ink} strokeWidth={2} />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 115,
  Component: TapeMeasure,
};
