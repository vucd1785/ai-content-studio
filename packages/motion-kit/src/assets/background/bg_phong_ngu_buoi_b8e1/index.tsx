import type { FC, ReactNode } from "react";
import { PALETTE } from "../../../palette.js";
import { GENERATED_BACKGROUND_STAGE } from "../../../stage/generated-stage.js";
import type { BackgroundAsset, BackgroundProps } from "../../../stage/types.js";

const INK = PALETTE.ink;

const Defs: FC = () => (
  <defs>
    <linearGradient id="mk-gen-bed-wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#1b2140" />
      <stop offset="1" stopColor="#2b3360" />
    </linearGradient>
    <linearGradient id="mk-gen-bed-floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#3b3150" />
      <stop offset="1" stopColor="#1f1a2e" />
    </linearGradient>
    <linearGradient id="mk-gen-bed-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#0f1636" />
      <stop offset="1" stopColor="#2a3a74" />
    </linearGradient>
    <radialGradient id="mk-gen-bed-ceil" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor="#6fd3ff" stopOpacity="0.55" />
      <stop offset="1" stopColor="#6fd3ff" stopOpacity="0" />
    </radialGradient>
    <linearGradient id="mk-gen-bed-beam" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stopColor="#8fe0ff" stopOpacity="0.4" />
      <stop offset="1" stopColor="#8fe0ff" stopOpacity="0" />
    </linearGradient>
    <radialGradient id="mk-gen-bed-moonglow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor="#fff3c4" stopOpacity="0.6" />
      <stop offset="1" stopColor="#fff3c4" stopOpacity="0" />
    </radialGradient>
    <linearGradient id="mk-gen-bed-shaft" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#dfe8ff" stopOpacity="0.35" />
      <stop offset="1" stopColor="#dfe8ff" stopOpacity="0" />
    </linearGradient>
  </defs>
);

const STARS: [number, number, number][] = [
  [440, 420, 5],
  [520, 560, 4],
  [470, 680, 5],
  [650, 640, 4],
  [430, 560, 3],
];

function stars(frame: number): ReactNode[] {
  return STARS.map(([x, y, r], i) => (
    <circle
      key={`st${i}`}
      cx={x}
      cy={y}
      r={r}
      fill="#fff6d6"
      opacity={0.55 + 0.45 * Math.sin(frame * 0.08 + i * 1.7)}
    />
  ));
}

/** Phòng ngủ tối của Tí: điện thoại hắt ánh xanh, trăng ngoài cửa sổ. */
const Component: FC<BackgroundProps> = ({ frame, lightShaft = false }) => {
  const glow = 0.75 + 0.25 * Math.sin(frame * 0.21) * Math.sin(frame * 0.047 + 1);
  const sec = (frame * 1.2) % 360;
  return (
    <g>
      <Defs />
      <rect x={0} y={0} width={1080} height={1580} fill="url(#mk-gen-bed-wall)" />
      {/* ánh xanh trên trần */}
      <ellipse cx={230} cy={90} rx={380} ry={190} fill="url(#mk-gen-bed-ceil)" opacity={glow} />
      <polygon points="190,1360 225,1360 520,0 -60,0" fill="url(#mk-gen-bed-beam)" opacity={glow} />
      {/* sàn */}
      <rect x={-200} y={1580} width={1480} height={1035} fill="url(#mk-gen-bed-floor)" />
      <rect x={0} y={1560} width={1080} height={22} fill="#141a33" stroke={INK} strokeWidth={5} />
      <ellipse cx={540} cy={1800} rx={360} ry={70} fill="#4a3d66" opacity={0.7} />
      {/* cửa sổ và trăng */}
      <ellipse cx={540} cy={560} rx={260} ry={260} fill="url(#mk-gen-bed-moonglow)" opacity={0.5} />
      <rect
        x={400}
        y={380}
        width={280}
        height={360}
        fill="url(#mk-gen-bed-sky)"
        stroke={INK}
        strokeWidth={7}
      />
      {stars(frame)}
      <circle cx={600} cy={480} r={52} fill="#fff1b8" stroke={INK} strokeWidth={5} />
      <circle cx={585} cy={468} r={10} fill="#e9d48a" />
      <circle cx={615} cy={500} r={7} fill="#e9d48a" />
      <line x1={540} y1={380} x2={540} y2={740} stroke={INK} strokeWidth={6} />
      <line x1={400} y1={560} x2={680} y2={560} stroke={INK} strokeWidth={6} />
      <rect x={380} y={740} width={320} height={20} fill="#3c4572" stroke={INK} strokeWidth={5} />
      <path
        d="M 370 350 L 440 350 Q 420 560 455 780 L 370 780 Z"
        fill="#4b3f7a"
        stroke={INK}
        strokeWidth={5}
      />
      <path
        d="M 710 350 L 640 350 Q 660 560 625 780 L 710 780 Z"
        fill="#4b3f7a"
        stroke={INK}
        strokeWidth={5}
      />
      <rect
        x={350}
        y={335}
        width={380}
        height={18}
        rx={9}
        fill="#2c2550"
        stroke={INK}
        strokeWidth={5}
      />
      {lightShaft ? (
        <polygon points="400,740 680,740 900,2000 260,2000" fill="url(#mk-gen-bed-shaft)" />
      ) : null}
      {/* giường */}
      <ellipse cx={130} cy={1585} rx={170} ry={14} fill="#000" opacity={0.35} />
      <rect
        x={10}
        y={1180}
        width={46}
        height={400}
        rx={14}
        fill="#5a3f5e"
        stroke={INK}
        strokeWidth={6}
      />
      <rect
        x={30}
        y={1400}
        width={230}
        height={110}
        rx={10}
        fill="#6a5a8c"
        stroke={INK}
        strokeWidth={6}
      />
      <ellipse cx={115} cy={1380} rx={62} ry={30} fill="#d8d6ee" stroke={INK} strokeWidth={6} />
      <path
        d="M 120 1395 Q 190 1370 262 1395 L 262 1500 L 120 1500 Z"
        fill="#4f7fb8"
        stroke={INK}
        strokeWidth={6}
      />
      <rect x={235} y={1510} width={18} height={70} fill="#3b2a40" stroke={INK} strokeWidth={4} />
      {/* điện thoại */}
      <circle cx={208} cy={1376} r={60} fill="url(#mk-gen-bed-ceil)" opacity={glow} />
      <rect
        x={186}
        y={1366}
        width={44}
        height={20}
        rx={5}
        fill="#9fe6ff"
        stroke={INK}
        strokeWidth={5}
      />
      {/* bàn đầu giường và đồng hồ báo thức */}
      <ellipse cx={950} cy={1585} rx={110} ry={12} fill="#000" opacity={0.35} />
      <rect
        x={860}
        y={1400}
        width={180}
        height={175}
        rx={8}
        fill="#5a3f5e"
        stroke={INK}
        strokeWidth={6}
      />
      <line x1={872} y1={1480} x2={1028} y2={1480} stroke={INK} strokeWidth={4} />
      <circle cx={950} cy={1440} r={7} fill="#c9a24a" stroke={INK} strokeWidth={3} />
      <circle cx={922} cy={1312} r={14} fill="#c9a24a" stroke={INK} strokeWidth={5} />
      <circle cx={978} cy={1312} r={14} fill="#c9a24a" stroke={INK} strokeWidth={5} />
      <circle cx={950} cy={1350} r={42} fill="#e05a4f" stroke={INK} strokeWidth={6} />
      <circle cx={950} cy={1350} r={30} fill="#f4f0e2" stroke={INK} strokeWidth={4} />
      <line
        x1={950}
        y1={1350}
        x2={950}
        y2={1330}
        stroke={INK}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <line
        x1={950}
        y1={1350}
        x2={964}
        y2={1356}
        stroke={INK}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <line
        x1={950}
        y1={1350}
        x2={950}
        y2={1326}
        stroke="#e05a4f"
        strokeWidth={2}
        transform={`rotate(${sec} 950 1350)`}
      />
    </g>
  );
};

export const asset: BackgroundAsset = { stage: GENERATED_BACKGROUND_STAGE, Component };
