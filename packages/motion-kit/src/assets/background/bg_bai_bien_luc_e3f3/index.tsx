import type { FC, ReactNode } from "react";
import { PALETTE } from "../../../palette.js";
import { GENERATED_BACKGROUND_STAGE } from "../../../stage/generated-stage.js";
import type { BackgroundAsset, BackgroundProps } from "../../../stage/types.js";

const INK = PALETTE.ink;
const HORIZON = 1150;
const SHORE = 1430;

const Defs: FC = () => (
  <defs>
    <linearGradient id="mk-gen-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#4a3a7a" />
      <stop offset="0.35" stopColor="#9a4f9a" />
      <stop offset="0.65" stopColor="#e86f8a" />
      <stop offset="0.88" stopColor="#f79a4e" />
      <stop offset="1" stopColor="#ffc46b" />
    </linearGradient>
    <linearGradient id="mk-gen-sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#c45a6e" />
      <stop offset="0.5" stopColor="#7a3f78" />
      <stop offset="1" stopColor="#4b356e" />
    </linearGradient>
    <linearGradient id="mk-gen-sand" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#e7a979" />
      <stop offset="1" stopColor="#b9745a" />
    </linearGradient>
    <radialGradient id="mk-gen-sun" cx="0.45" cy="0.4" r="0.6">
      <stop offset="0" stopColor="#ffd27a" />
      <stop offset="0.6" stopColor="#ff8a3d" />
      <stop offset="1" stopColor="#e8492e" />
    </radialGradient>
    <radialGradient id="mk-gen-glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor="#ffb05a" stopOpacity="0.75" />
      <stop offset="1" stopColor="#ffb05a" stopOpacity="0" />
    </radialGradient>
    <linearGradient id="mk-gen-beam" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#ffd9a0" stopOpacity="0.5" />
      <stop offset="1" stopColor="#ffd9a0" stopOpacity="0" />
    </linearGradient>
  </defs>
);

function wavePath(
  y: number,
  amp: number,
  len: number,
  phase: number,
  x0: number,
  x1: number,
): string {
  let d = `M ${x0} ${y}`;
  for (let x = x0; x <= x1; x += 20) {
    const yy = y + Math.sin((x / len) * Math.PI * 2 + phase) * amp;
    d += ` L ${x} ${yy.toFixed(1)}`;
  }
  return d;
}

function glitter(frame: number): ReactNode[] {
  const out: ReactNode[] = [];
  for (let i = 0; i < 7; i++) {
    const y = HORIZON + 28 + i * 38;
    const w = 220 - i * 18 + Math.sin(frame / 20 + i * 1.3) * 18;
    const op = 0.55 + 0.35 * Math.sin(frame / 12 + i * 2.1);
    out.push(
      <line
        key={`gl${i}`}
        x1={540 - w / 2 + ((i * 37) % 40) - 20}
        y1={y}
        x2={540 + w / 2 + ((i * 37) % 40) - 20}
        y2={y}
        stroke="#ffc46b"
        strokeWidth={10 - i * 0.6}
        strokeLinecap="round"
        opacity={op}
      />,
    );
  }
  return out;
}

const Beach: FC<BackgroundProps> = ({ frame, lightShaft = false }) => {
  const drift = Math.sin(frame / 120) * 25;
  const ph = frame / 40;
  const foam = Math.sin(frame / 50) * 18;
  return (
    <g>
      <Defs />
      {/* bầu trời */}
      <rect x={0} y={0} width={1080} height={HORIZON + 10} fill="url(#mk-gen-sky)" />
      <ellipse cx={540} cy={HORIZON} rx={520} ry={360} fill="url(#mk-gen-glow)" />
      {/* mây */}
      <ellipse
        cx={230 + drift}
        cy={520}
        rx={190}
        ry={34}
        fill="#d77a9c"
        stroke={INK}
        strokeWidth={5}
      />
      <ellipse
        cx={820 - drift}
        cy={680}
        rx={220}
        ry={30}
        fill="#f08a8a"
        stroke={INK}
        strokeWidth={5}
      />
      <ellipse
        cx={380 - drift * 0.6}
        cy={860}
        rx={150}
        ry={22}
        fill="#f7a477"
        stroke={INK}
        strokeWidth={5}
      />
      {/* chim */}
      <path
        d={`M ${700 + drift} 420 q 18 -16 34 0 q 16 -16 34 0`}
        fill="none"
        stroke={INK}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <path
        d={`M ${770 + drift} 470 q 13 -12 25 0 q 12 -12 25 0`}
        fill="none"
        stroke={INK}
        strokeWidth={5}
        strokeLinecap="round"
      />
      {/* Mặt Trời sát chân trời */}
      <circle
        cx={540}
        cy={HORIZON - 20}
        r={150}
        fill="url(#mk-gen-sun)"
        stroke={INK}
        strokeWidth={7}
      />
      {/* biển */}
      <rect x={0} y={HORIZON} width={1080} height={SHORE - HORIZON + 30} fill="url(#mk-gen-sea)" />
      <line x1={0} y1={HORIZON} x2={1080} y2={HORIZON} stroke={INK} strokeWidth={6} />
      {glitter(frame)}
      <path
        d={wavePath(HORIZON + 90, 5, 160, ph, 0, 1080)}
        fill="none"
        stroke="#f4a3a8"
        strokeWidth={4}
        opacity={0.6}
      />
      <path
        d={wavePath(HORIZON + 180, 7, 200, -ph, 0, 1080)}
        fill="none"
        stroke="#e98fa8"
        strokeWidth={4}
        opacity={0.55}
      />
      {/* bờ cát */}
      <path
        d={`${wavePath(SHORE + foam, 10, 260, ph * 0.7, -20, 1100)} L 1100 2615 L -20 2615 Z`}
        fill="url(#mk-gen-sand)"
        stroke={INK}
        strokeWidth={6}
      />
      <path
        d={wavePath(SHORE + 8 + foam, 10, 260, ph * 0.7, -20, 1100)}
        fill="none"
        stroke="#fde3d0"
        strokeWidth={9}
        opacity={0.85}
      />
      <path
        d={wavePath(SHORE + 50 + foam * 0.6, 8, 300, ph * 0.5 + 1, -20, 1100)}
        fill="none"
        stroke="#c98468"
        strokeWidth={6}
        opacity={0.6}
      />
      <rect x={-200} y={2200} width={1480} height={415} fill="#b06e55" opacity={0.35} />
      {/* vỏ sò, sỏi ở tiền cảnh */}
      <ellipse cx={180} cy={1900} rx={26} ry={16} fill="#f6d2c0" stroke={INK} strokeWidth={5} />
      <ellipse cx={880} cy={2050} rx={20} ry={12} fill="#9a6a8a" stroke={INK} strokeWidth={5} />
      <ellipse cx={520} cy={2300} rx={30} ry={14} fill="#e9b59a" stroke={INK} strokeWidth={5} />
      {/* cây dừa bên phải */}
      <ellipse cx={1010} cy={1560} rx={70} ry={12} fill="#000" opacity={0.22} />
      <path
        d="M 1000 1560 Q 1020 1250 960 980 L 990 975 Q 1055 1250 1035 1560 Z"
        fill="#5a3a4a"
        stroke={INK}
        strokeWidth={6}
      />
      <path
        d="M 975 980 Q 880 920 800 990 Q 880 950 975 990 Z"
        fill="#3e2f52"
        stroke={INK}
        strokeWidth={6}
      />
      <path
        d="M 975 980 Q 1040 900 1100 950 Q 1040 940 980 992 Z"
        fill="#3e2f52"
        stroke={INK}
        strokeWidth={6}
      />
      <path
        d="M 975 980 Q 930 880 860 880 Q 935 905 970 992 Z"
        fill="#4a3660"
        stroke={INK}
        strokeWidth={6}
      />
      {lightShaft ? (
        <polygon points="460,1130 620,1130 900,1600 180,1600" fill="url(#mk-gen-beam)" />
      ) : null}
    </g>
  );
};

export const asset: BackgroundAsset = { stage: GENERATED_BACKGROUND_STAGE, Component: Beach };
