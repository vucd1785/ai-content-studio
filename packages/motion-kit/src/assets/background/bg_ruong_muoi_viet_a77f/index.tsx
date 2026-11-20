import type { FC, ReactNode } from "react";
import { PALETTE } from "../../../palette.js";
import { GENERATED_BACKGROUND_STAGE } from "../../../stage/generated-stage.js";
import type { BackgroundAsset, BackgroundProps } from "../../../stage/types.js";

const INK = PALETTE.ink;

const Defs: FC = () => (
  <defs>
    <linearGradient id="mk-gen-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#3f9be0" />
      <stop offset="1" stopColor="#bfe6fb" />
    </linearGradient>
    <radialGradient id="mk-gen-sun" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor="#fff6c8" stopOpacity="0.95" />
      <stop offset="0.4" stopColor="#ffe27a" stopOpacity="0.5" />
      <stop offset="1" stopColor="#ffe27a" stopOpacity="0" />
    </radialGradient>
    <linearGradient id="mk-gen-pan" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#c9ecf2" />
      <stop offset="1" stopColor="#8fcfdc" />
    </linearGradient>
    <linearGradient id="mk-gen-dike" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#d6b98a" />
      <stop offset="1" stopColor="#b8956a" />
    </linearGradient>
    <linearGradient id="mk-gen-glare" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#fff8d6" stopOpacity="0.5" />
      <stop offset="1" stopColor="#fff8d6" stopOpacity="0" />
    </linearGradient>
  </defs>
);

/** Các ô ruộng muối: [x, y, w, h]. */
const PANS: [number, number, number, number][] = [
  [-20, 1160, 360, 110],
  [360, 1160, 360, 110],
  [740, 1160, 360, 110],
  [-20, 1295, 540, 215],
  [545, 1295, 555, 215],
  [-20, 1660, 540, 400],
  [545, 1660, 555, 400],
  [-20, 2090, 1120, 560],
];

const SPARKS: [number, number, number][] = [
  [150, 1210, 10],
  [520, 1230, 9],
  [880, 1200, 10],
  [250, 1400, 14],
  [700, 1360, 13],
  [960, 1450, 12],
  [180, 1800, 18],
  [420, 1950, 16],
  [760, 1760, 18],
  [980, 1980, 16],
  [300, 2250, 22],
  [820, 2400, 22],
];

function sparkles(frame: number): ReactNode[] {
  return SPARKS.map(([x, y, s], i) => {
    const o = 0.25 + 0.75 * Math.abs(Math.sin(frame * 0.11 + i * 1.7));
    return (
      <path
        key={`sp${i}`}
        d={`M ${x} ${y - s} L ${x + s * 0.25} ${y} L ${x} ${y + s} L ${x - s * 0.25} ${y} Z M ${x - s} ${y} L ${x} ${y - s * 0.25} L ${x + s} ${y} L ${x} ${y + s * 0.25} Z`}
        fill="#ffffff"
        opacity={o}
      />
    );
  });
}

function ripples(frame: number): ReactNode[] {
  const out: ReactNode[] = [];
  PANS.forEach(([x, y, w, h], i) => {
    const dx = Math.sin(frame * 0.05 + i) * 8;
    const n = h > 300 ? 3 : h > 150 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const yy = y + (h * (k + 1)) / (n + 1);
      out.push(
        <path
          key={`rp${i}-${k}`}
          d={`M ${x + 60 + dx} ${yy} q 30 -8 60 0 t 60 0 M ${x + w * 0.55 - dx} ${yy + 14} q 25 -7 50 0 t 50 0`}
          stroke="#ffffff"
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
          opacity={0.55}
        />,
      );
    }
  });
  return out;
}

const SaltPile: FC<{ x: number; y: number; s: number }> = ({ x, y, s }) => (
  <g>
    <ellipse cx={x} cy={y + 4} rx={70 * s} ry={12 * s} fill="#000" opacity={0.18} />
    <path
      d={`M ${x - 65 * s} ${y} Q ${x - 20 * s} ${y - 95 * s} ${x} ${y - 100 * s} Q ${x + 20 * s} ${y - 95 * s} ${x + 65 * s} ${y} Z`}
      fill="#fbfdff"
      stroke={INK}
      strokeWidth={6}
      strokeLinejoin="round"
    />
    <path
      d={`M ${x + 8 * s} ${y - 90 * s} Q ${x + 30 * s} ${y - 50 * s} ${x + 50 * s} ${y - 6 * s}`}
      stroke="#d6e4ee"
      strokeWidth={10 * s}
      fill="none"
      strokeLinecap="round"
    />
  </g>
);

const SaltField: FC<BackgroundProps> = ({ frame, lightShaft = false }) => (
  <g>
    <Defs />
    {/* bầu trời và mặt trời */}
    <rect x={0} y={0} width={1080} height={1140} fill="url(#mk-gen-sky)" />
    <circle cx={820} cy={300} r={260} fill="url(#mk-gen-sun)" />
    <circle
      cx={820}
      cy={300}
      r={80 + Math.sin(frame * 0.06) * 3}
      fill="#fff1a0"
      stroke={INK}
      strokeWidth={6}
    />
    <path
      d="M 120 420 q 40 -50 90 -20 q 40 -40 90 0 q 50 0 40 40 l -230 0 q -30 -10 10 -20 Z"
      fill="#ffffff"
      opacity={0.9}
    />
    {/* biển xa */}
    <rect x={0} y={1060} width={1080} height={80} fill="#4aa6c8" />
    <line x1={0} y1={1060} x2={1080} y2={1060} stroke={INK} strokeWidth={5} />
    {/* nền bờ đất */}
    <rect x={-200} y={1135} width={1480} height={1520} fill="url(#mk-gen-dike)" />
    <line x1={0} y1={1137} x2={1080} y2={1137} stroke={INK} strokeWidth={5} />
    {/* các ô ruộng nước nông */}
    {PANS.map(([x, y, w, h], i) => (
      <rect
        key={`pan${i}`}
        x={x}
        y={y}
        width={w}
        height={h}
        rx={8}
        fill="url(#mk-gen-pan)"
        stroke={INK}
        strokeWidth={6}
      />
    ))}
    {ripples(frame)}
    {sparkles(frame)}
    {/* bờ chính nơi nhân vật đứng */}
    <line x1={0} y1={1630} x2={1080} y2={1630} stroke="#a07f55" strokeWidth={4} opacity={0.6} />
    {/* đống muối hai bên bờ và tiền cảnh */}
    <SaltPile x={985} y={1570} s={0.8} />
    <SaltPile x={150} y={1940} s={1} />
    <SaltPile x={320} y={1960} s={0.75} />
    <SaltPile x={880} y={2400} s={1.1} />
    {/* cào gỗ dựng bên bờ trái */}
    <line
      x1={70}
      y1={1600}
      x2={180}
      y2={1360}
      stroke={PALETTE.woodDark}
      strokeWidth={10}
      strokeLinecap="round"
    />
    <rect
      x={30}
      y={1585}
      width={100}
      height={22}
      rx={4}
      fill={PALETTE.wood}
      stroke={INK}
      strokeWidth={5}
      transform="rotate(-8 80 1596)"
    />
    {/* nón lá đặt trên bờ phải */}
    <ellipse cx={900} cy={1612} rx={58} ry={9} fill="#000" opacity={0.2} />
    <path
      d="M 838 1606 L 900 1540 L 962 1606 Q 900 1620 838 1606 Z"
      fill="#f1dc9e"
      stroke={INK}
      strokeWidth={6}
      strokeLinejoin="round"
    />
    <path d="M 870 1575 L 930 1575 M 855 1592 L 945 1592" stroke="#c9ad6a" strokeWidth={3} />
    {lightShaft ? (
      <polygon points="700,300 940,300 1080,1700 420,1700" fill="url(#mk-gen-glare)" />
    ) : null}
  </g>
);

export const asset: BackgroundAsset = { stage: GENERATED_BACKGROUND_STAGE, Component: SaltField };
