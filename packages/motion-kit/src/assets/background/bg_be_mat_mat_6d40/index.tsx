import type { FC, ReactNode } from "react";
import { PALETTE } from "../../../palette.js";
import { GENERATED_BACKGROUND_STAGE } from "../../../stage/generated-stage.js";
import type { BackgroundAsset, BackgroundProps } from "../../../stage/types.js";

const INK = PALETTE.ink;
const HORIZON = 1420;

const Defs: FC = () => (
  <defs>
    <linearGradient id="mk-gen-moon-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#05060d" />
      <stop offset="1" stopColor="#10121f" />
    </linearGradient>
    <linearGradient id="mk-gen-moon-ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#b9b8b4" />
      <stop offset="0.4" stopColor="#9d9c98" />
      <stop offset="1" stopColor="#77767a" />
    </linearGradient>
    <radialGradient id="mk-gen-moon-sunglow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
      <stop offset="0.35" stopColor="#fff6d8" stopOpacity="0.45" />
      <stop offset="1" stopColor="#fff6d8" stopOpacity="0" />
    </radialGradient>
    <radialGradient id="mk-gen-moon-sun" cx="0.45" cy="0.45" r="0.6">
      <stop offset="0" stopColor="#ffffff" />
      <stop offset="1" stopColor="#fff1b8" />
    </radialGradient>
    <radialGradient id="mk-gen-moon-earth" cx="0.4" cy="0.35" r="0.7">
      <stop offset="0" stopColor="#6fb8ff" />
      <stop offset="1" stopColor="#2a62c4" />
    </radialGradient>
    <radialGradient id="mk-gen-moon-crater" cx="0.5" cy="0.4" r="0.6">
      <stop offset="0" stopColor="#6e6d72" />
      <stop offset="1" stopColor="#8d8c8f" />
    </radialGradient>
    <linearGradient id="mk-gen-moon-beam" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#fffbe8" stopOpacity="0.4" />
      <stop offset="1" stopColor="#fffbe8" stopOpacity="0" />
    </linearGradient>
  </defs>
);

function stars(frame: number): ReactNode[] {
  const out: ReactNode[] = [];
  for (let i = 0; i < 60; i++) {
    const x = (i * 397 + 53) % 1080;
    const y = (i * 251 + 37) % (HORIZON - 120);
    const r = 2 + (i % 3);
    const tw = 0.55 + 0.45 * Math.sin(frame * 0.08 + i * 1.7);
    out.push(<circle key={`s${i}`} cx={x} cy={y} r={r} fill="#ffffff" opacity={tw} />);
  }
  return out;
}

const CRATERS = [
  { x: 120, y: 1490, rx: 90, ry: 22 },
  { x: 950, y: 1500, rx: 110, ry: 26 },
  { x: 200, y: 1840, rx: 150, ry: 40 },
  { x: 820, y: 1900, rx: 180, ry: 46 },
  { x: 480, y: 2150, rx: 210, ry: 55 },
  { x: 130, y: 2380, rx: 130, ry: 36 },
  { x: 900, y: 2420, rx: 150, ry: 40 },
];

const MoonSurface: FC<BackgroundProps> = ({ frame, lightShaft = false }) => {
  const pulse = 1 + 0.04 * Math.sin(frame * 0.05);
  return (
    <g>
      <Defs />
      <rect x={0} y={0} width={1080} height={HORIZON + 40} fill="url(#mk-gen-moon-sky)" />
      {stars(frame)}
      {/* Trái Đất xanh nhỏ ở xa */}
      <circle
        cx={230}
        cy={420}
        r={70}
        fill="url(#mk-gen-moon-earth)"
        stroke={INK}
        strokeWidth={5}
      />
      <path d="M 190 380 Q 215 360 240 385 Q 250 410 225 425 Q 200 420 190 380 Z" fill="#5fb35a" />
      <path d="M 245 450 Q 270 440 280 460 Q 262 478 245 465 Z" fill="#5fb35a" />
      <path
        d="M 300 420 A 70 70 0 0 1 230 490 A 55 70 0 0 0 300 420 Z"
        fill="#0b1a3a"
        opacity={0.5}
      />
      {/* Mặt Trời chói */}
      <circle cx={830} cy={330} r={260 * pulse} fill="url(#mk-gen-moon-sunglow)" />
      <circle cx={830} cy={330} r={95} fill="url(#mk-gen-moon-sun)" stroke={INK} strokeWidth={6} />
      {/* Mặt đất Mặt Trăng */}
      <path
        d={`M 0 ${HORIZON + 20} Q 270 ${HORIZON - 30} 540 ${HORIZON} Q 820 ${HORIZON + 30} 1080 ${HORIZON - 10} L 1080 2615 L 0 2615 Z`}
        fill="url(#mk-gen-moon-ground)"
        stroke={INK}
        strokeWidth={6}
      />
      <path
        d={`M 640 ${HORIZON + 6} Q 720 ${HORIZON - 40} 800 ${HORIZON + 14}`}
        fill="#a9a8a5"
        stroke={INK}
        strokeWidth={5}
      />
      {CRATERS.map((c) => (
        <g key={`c${c.x}-${c.y}`}>
          <ellipse
            cx={c.x}
            cy={c.y}
            rx={c.rx}
            ry={c.ry}
            fill="url(#mk-gen-moon-crater)"
            stroke={INK}
            strokeWidth={5}
          />
          <path
            d={`M ${c.x - c.rx * 0.8} ${c.y + c.ry * 0.3} Q ${c.x} ${c.y + c.ry * 1.05} ${c.x + c.rx * 0.8} ${c.y + c.ry * 0.3}`}
            fill="none"
            stroke="#c9c8c4"
            strokeWidth={4}
            opacity={0.8}
          />
        </g>
      ))}
      {/* đá nhỏ rải rác, tránh dải nhân vật */}
      <ellipse cx={60} cy={1640} rx={28} ry={14} fill="#8a898c" stroke={INK} strokeWidth={4} />
      <ellipse cx={1030} cy={1660} rx={24} ry={12} fill="#8a898c" stroke={INK} strokeWidth={4} />
      <ellipse cx={640} cy={2420} rx={34} ry={16} fill="#8a898c" stroke={INK} strokeWidth={4} />
      {lightShaft ? (
        <polygon points="760,400 900,400 1080,1700 420,1700" fill="url(#mk-gen-moon-beam)" />
      ) : null}
    </g>
  );
};

export const asset: BackgroundAsset = { stage: GENERATED_BACKGROUND_STAGE, Component: MoonSurface };
