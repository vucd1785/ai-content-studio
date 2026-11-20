import type { FC, ReactNode } from "react";
import { PALETTE } from "../../../palette.js";
import { rnd, wobble } from "../../../rig/math.js";
import { GENERATED_WIDE_BACKGROUND_STAGE } from "../../../stage/generated-stage.js";
import type { BackgroundAsset, BackgroundProps } from "../../../stage/types.js";

const INK = PALETTE.ink;
/** Vùng vẽ: rộng hơn khung dọc 440 mỗi bên cho khung ngang 16:9. */
const X0 = -440;
const WIDTH = 1960;
const X1 = X0 + WIDTH;

const Defs: FC = () => (
  <defs>
    <linearGradient id="mk-gen-wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#cfd8e2" />
      <stop offset="0.6" stopColor="#e4eaf0" />
      <stop offset="1" stopColor="#d6dde5" />
    </linearGradient>
    <linearGradient id="mk-gen-window" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#e9f6ff" />
      <stop offset="1" stopColor="#b9dcf2" />
    </linearGradient>
    <radialGradient id="mk-gen-glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor="#fff8dc" stopOpacity="0.9" />
      <stop offset="1" stopColor="#fff8dc" stopOpacity="0" />
    </radialGradient>
    <linearGradient id="mk-gen-floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#c7ced6" />
      <stop offset="1" stopColor="#99a3ae" />
    </linearGradient>
    <linearGradient id="mk-gen-body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#ffffff" />
      <stop offset="0.65" stopColor="#eef2f6" />
      <stop offset="1" stopColor="#c9d2dc" />
    </linearGradient>
    <linearGradient id="mk-gen-bell" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stopColor="#b8c2cc" />
      <stop offset="1" stopColor="#5d6875" />
    </linearGradient>
    <radialGradient id="mk-gen-spark" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
      <stop offset="0.35" stopColor="#bfe9ff" stopOpacity="0.8" />
      <stop offset="1" stopColor="#7fd0ff" stopOpacity="0" />
    </radialGradient>
  </defs>
);

const WINDOWS = [-300, 140, 580, 1020];
const LAMPS = [-220, 220, 660, 1100, 1440];

/** Lớp xa: tường xưởng, cửa sổ cao, khung giàn trần, ray cần cẩu với xe con chạy chậm và đèn trần. */
const Far: FC<BackgroundProps> = ({ frame }) => {
  const tx = 540 + Math.sin(frame / 120) * 300;
  const sway = Math.sin(frame / 40) * 3;
  const ribs: ReactNode[] = [];
  for (let i = 0; i < 14; i++) {
    const x = X0 + 70 + i * 140;
    ribs.push(<rect key={`r${i}`} x={x} y={380} width={16} height={1140} fill="#c3ccd6" />);
  }
  return (
    <g>
      <Defs />
      <rect x={X0} y={0} width={WIDTH} height={2615} fill="url(#mk-gen-wall)" />
      <rect x={X0} y={0} width={WIDTH} height={300} fill="#aeb9c6" />
      {ribs}
      {WINDOWS.map((x) => (
        <g key={`w${x}`}>
          <rect x={x} y={520} width={320} height={560} rx={18} fill="url(#mk-gen-window)" stroke="#8d9aa8" strokeWidth={8} />
          <line x1={x + 160} y1={520} x2={x + 160} y2={1080} stroke="#8d9aa8" strokeWidth={6} />
          <line x1={x} y1={800} x2={x + 320} y2={800} stroke="#8d9aa8" strokeWidth={6} />
          <path d={`M ${x + 30} 560 L ${x + 120} 560 L ${x + 40} 760 Z`} fill="#ffffff" opacity={0.55} />
        </g>
      ))}
      <path
        d={`M ${X0} 300 ${Array.from({ length: 15 }, (_, i) => `L ${X0 + 70 + i * 140} ${i % 2 === 0 ? 380 : 300}`).join(" ")} L ${X1} 340`}
        fill="none"
        stroke="#94a1b0"
        strokeWidth={10}
        strokeLinejoin="round"
      />
      <rect x={X0} y={372} width={WIDTH} height={22} fill="#94a1b0" />
      <rect x={X0} y={420} width={WIDTH} height={36} fill="#f2c45a" stroke="#b78b2c" strokeWidth={6} />
      <g transform={`translate(${tx.toFixed(1)} 0)`}>
        <rect x={-80} y={400} width={160} height={80} rx={14} fill="#f0b23d" stroke="#a87a22" strokeWidth={6} />
        <rect x={-62} y={410} width={60} height={18} rx={8} fill="#ffe08f" />
        <g transform={`rotate(${sway.toFixed(2)} 0 480)`}>
          <line x1={0} y1={480} x2={0} y2={860} stroke="#6f7b88" strokeWidth={6} />
          <rect x={-34} y={860} width={68} height={50} rx={10} fill="#f0b23d" stroke="#a87a22" strokeWidth={5} />
          <path d="M 0 910 L 0 940 Q 0 980 -28 975 Q -46 968 -40 948" fill="none" stroke="#6f7b88" strokeWidth={10} strokeLinecap="round" />
        </g>
      </g>
      {LAMPS.map((x, i) => {
        const glow = 0.72 + 0.12 * wobble(frame, 30 + i, 70);
        return (
          <g key={`l${x}`}>
            <ellipse cx={x} cy={320} rx={190} ry={150} fill="url(#mk-gen-glow)" opacity={glow} />
            <path d={`M ${x - 48} 330 L ${x - 30} 296 L ${x + 30} 296 L ${x + 48} 330 Z`} fill="#7f8c9b" stroke="#5d6875" strokeWidth={5} />
            <ellipse cx={x} cy={332} rx={40} ry={9} fill="#fffbe8" opacity={0.6 + glow * 0.4} />
          </g>
        );
      })}
    </g>
  );
};

/** Một động cơ tên lửa đặt trên bệ gỗ, ánh sáng từ trái. */
function engine(key: string, x: number, base: number, size: number): ReactNode {
  return (
    <g key={key} transform={`translate(${x} ${base}) scale(${size})`}>
      <ellipse cx={0} cy={4} rx={95} ry={14} fill="#000" opacity={0.15} />
      <rect x={-75} y={-60} width={150} height={60} rx={8} fill={PALETTE.wood} stroke={INK} strokeWidth={6} />
      <rect x={-75} y={-60} width={150} height={14} fill="#ffffff" opacity={0.25} />
      <path d="M -26 -230 L 26 -230 L 62 -62 L -62 -62 Z" fill="url(#mk-gen-bell)" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
      <path d="M -18 -220 L -8 -220 L -38 -70 L -50 -70 Z" fill="#ffffff" opacity={0.45} />
      <circle cx={0} cy={-250} r={38} fill="#9aa5b1" stroke={INK} strokeWidth={6} />
      <circle cx={-12} cy={-262} r={11} fill="#ffffff" opacity={0.5} />
    </g>
  );
}

/** Lớp giữa: sàn xưởng, thân tên lửa trắng nằm ngang trên giá, hàng động cơ hai bên và tia hàn lóe sáng. */
const Workshop: FC<BackgroundProps> = ({ frame }) => {
  const flick = rnd(11, Math.floor(frame / 3));
  const on = flick > 0.25 ? 1 : 0.35;
  const sparkSize = 0.6 + flick * 0.6;
  const sparks: ReactNode[] = [];
  for (let i = 0; i < 5; i++) {
    const p = ((frame * 1.4 + i * 9) % 40) / 40;
    const dir = (i - 2) * 26 + 8;
    sparks.push(
      <circle
        key={`s${i}`}
        cx={(1000 + dir * p).toFixed(1)}
        cy={(1402 - 30 * p + 160 * p * p).toFixed(1)}
        r={5 - p * 3}
        fill="#fff3b0"
        opacity={(1 - p) * on}
      />,
    );
  }
  return (
    <g>
      <Defs />
      <path d={`M ${X0} 1500 L ${X1} 1500 L ${X1} 2615 L ${X0} 2615 Z`} fill="url(#mk-gen-floor)" stroke={INK} strokeWidth={6} />
      <rect x={X0} y={1500} width={WIDTH} height={18} fill="#ffffff" opacity={0.35} />
      <path d={`M ${X0} 1700 L ${X1} 1700`} stroke="#e9c35a" strokeWidth={12} strokeDasharray="70 40" opacity={0.55} />
      <path d={`M ${X0} 2250 L ${X1} 2250`} stroke="#e9c35a" strokeWidth={14} strokeDasharray="80 46" opacity={0.45} />
      <ellipse cx={500} cy={1505} rx={760} ry={22} fill="#000" opacity={0.12} />
      {[160, 860].map((c) => (
        <path
          key={`cr${c}`}
          d={`M ${c - 95} 1505 L ${c - 62} 1385 Q ${c} 1418 ${c + 62} 1385 L ${c + 95} 1505 Z`}
          fill="#7f8c9b"
          stroke={INK}
          strokeWidth={6}
          strokeLinejoin="round"
        />
      ))}
      <path d="M -200 1250 L -275 1222 L -275 1398 L -200 1370 Z" fill="url(#mk-gen-bell)" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
      <path
        d="M -200 1220 L 960 1220 Q 1120 1232 1210 1310 Q 1120 1388 960 1400 L -200 1400 Z"
        fill="url(#mk-gen-body)"
        stroke={INK}
        strokeWidth={7}
        strokeLinejoin="round"
      />
      <rect x={640} y={1222} width={52} height={176} fill="#3a4452" />
      <rect x={-190} y={1236} width={820} height={22} rx={11} fill="#ffffff" opacity={0.8} />
      <line x1={300} y1={1222} x2={300} y2={1398} stroke="#c3ccd6" strokeWidth={5} />
      <line x1={1000} y1={1224} x2={1000} y2={1396} stroke="#c3ccd6" strokeWidth={5} />
      <circle cx={1000} cy={1402} r={90 * sparkSize} fill="url(#mk-gen-spark)" opacity={on} />
      <path
        d={`M 1000 ${1402 - 28 * sparkSize} L ${1000 + 7} 1395 L ${1000 + 28 * sparkSize} 1402 L 1007 1409 L 1000 ${1402 + 28 * sparkSize} L 993 1409 L ${1000 - 28 * sparkSize} 1402 L 993 1395 Z`}
        fill="#ffffff"
        opacity={on}
      />
      {sparks}
      {engine("e1", -330, 1560, 1)}
      {engine("e2", 1170, 1540, 0.9)}
      {engine("e3", 1320, 1560, 1)}
      {engine("e4", 1470, 1580, 1.08)}
    </g>
  );
};

/** Tiền cảnh: thùng gỗ, bình khí, cuộn cáp và hộp đồ nghề tối màu ở hai góc dưới. */
const Near: FC<BackgroundProps> = ({ frame }) => {
  const hose = Math.sin(frame / 50) * 6;
  return (
    <g>
      <rect x={-410} y={1720} width={300} height={380} rx={16} fill="#2d3540" />
      <rect x={-400} y={1760} width={280} height={26} fill="#3a4452" />
      <rect x={20} y={1700} width={110} height={400} rx={50} fill="#333c48" />
      <path
        d={`M 75 1700 Q ${(120 + hose).toFixed(1)} 1660 ${(170 + hose).toFixed(1)} 1760 Q 190 1900 150 2100 L 130 2100 Q 160 1900 ${(150 + hose).toFixed(1)} 1780 Z`}
        fill="#262d36"
      />
      <circle cx={1090} cy={1950} r={170} fill="#2d3540" />
      <circle cx={1090} cy={1950} r={60} fill="#3a4452" />
      <rect x={1270} y={1760} width={220} height={340} rx={14} fill="#333c48" />
      <path d="M 1320 1760 L 1320 1720 L 1440 1720 L 1440 1760" fill="none" stroke="#262d36" strokeWidth={16} />
    </g>
  );
};

/** Xưởng lắp ráp tên lửa trong nhà, bối cảnh ba lớp: lớp xa, lớp giữa, tiền cảnh. */
export const asset: BackgroundAsset = {
  stage: GENERATED_WIDE_BACKGROUND_STAGE,
  Far,
  Component: Workshop,
  Near,
};
