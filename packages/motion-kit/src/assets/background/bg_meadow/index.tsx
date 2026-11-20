import type { FC, ReactNode } from "react";
import { PALETTE } from "../../../palette.js";
import { GENERATED_WIDE_BACKGROUND_STAGE } from "../../../stage/generated-stage.js";
import type { BackgroundAsset, BackgroundProps } from "../../../stage/types.js";

const INK = PALETTE.ink;
/** Vùng vẽ: rộng hơn khung dọc 440 mỗi bên cho khung ngang 16:9. */
const X0 = -440;
const WIDTH = 1960;

const Defs: FC = () => (
  <defs>
    <linearGradient id="mk-meadow-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#7cc4f0" />
      <stop offset="0.6" stopColor="#c9ecff" />
      <stop offset="1" stopColor="#f3fbe6" />
    </linearGradient>
    <radialGradient id="mk-meadow-sun" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor="#fff6c9" stopOpacity="0.95" />
      <stop offset="1" stopColor="#fff6c9" stopOpacity="0" />
    </radialGradient>
    <linearGradient id="mk-meadow-grass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#8fd16a" />
      <stop offset="1" stopColor="#4f9a45" />
    </linearGradient>
  </defs>
);

/** Một đám mây ba múi, trôi chậm và lặp lại trong vùng vẽ. */
function cloud(key: string, x: number, y: number, size: number, frame: number, speed: number) {
  const cx = X0 + ((x - X0 + frame * speed) % WIDTH);
  return (
    <g key={key} transform={`translate(${cx.toFixed(1)} ${y}) scale(${size})`} opacity={0.92}>
      <ellipse cx={0} cy={0} rx={120} ry={46} fill="#ffffff" />
      <ellipse cx={-60} cy={-28} rx={62} ry={44} fill="#ffffff" />
      <ellipse cx={30} cy={-40} rx={74} ry={52} fill="#ffffff" />
      <ellipse cx={10} cy={14} rx={110} ry={26} fill="#dcefff" />
    </g>
  );
}

/** Lớp xa: trời, quầng nắng, mây trôi và hai dãy đồi nhạt dần theo khoảng cách. */
const Far: FC<BackgroundProps> = ({ frame }) => (
  <g>
    <Defs />
    <rect x={X0} y={0} width={WIDTH} height={2615} fill="url(#mk-meadow-sky)" />
    <circle cx={170} cy={330} r={330} fill="url(#mk-meadow-sun)" />
    <circle cx={170} cy={330} r={74} fill="#fff1a8" />
    {cloud("c1", 620, 420, 1, frame, 0.35)}
    {cloud("c2", -120, 640, 0.7, frame, 0.22)}
    {cloud("c3", 1180, 760, 0.85, frame, 0.28)}
    <path
      d={`M ${X0} 1330 Q -150 1120 180 1260 Q 430 1090 720 1250 Q 1010 1100 1290 1240 Q 1420 1180 1520 1260 L 1520 2615 L ${X0} 2615 Z`}
      fill="#bfe3c9"
    />
    <path
      d={`M ${X0} 1440 Q -220 1300 60 1400 Q 330 1270 620 1400 Q 900 1290 1180 1400 Q 1380 1320 1520 1400 L 1520 2615 L ${X0} 2615 Z`}
      fill="#9ed39a"
    />
  </g>
);

/** Một cái cây: thân nâu, ba tán lá đung đưa lệch nhịp. */
function tree(key: string, x: number, base: number, size: number, frame: number): ReactNode {
  const sway = Math.sin(frame / 28 + x) * 2.2;
  return (
    <g key={key} transform={`translate(${x} ${base}) scale(${size})`}>
      <ellipse cx={0} cy={0} rx={120} ry={18} fill="#000" opacity={0.18} />
      <path
        d="M -22 0 L -14 -230 L 14 -230 L 24 0 Z"
        fill={PALETTE.wood}
        stroke={INK}
        strokeWidth={6}
      />
      <g transform={`rotate(${sway.toFixed(2)} 0 -230)`}>
        <circle cx={-70} cy={-290} r={92} fill="#4f9a45" stroke={INK} strokeWidth={6} />
        <circle cx={72} cy={-300} r={98} fill="#5fae52" stroke={INK} strokeWidth={6} />
        <circle cx={0} cy={-390} r={112} fill={PALETTE.leaf} stroke={INK} strokeWidth={6} />
        <circle cx={-36} cy={-430} r={44} fill="#a6e07c" opacity={0.6} />
      </g>
    </g>
  );
}

const FLOWERS = [
  { x: -300, y: 1700, c: "#ffd166" },
  { x: -120, y: 1840, c: "#ff8fa3" },
  { x: 90, y: 1760, c: "#ffffff" },
  { x: 990, y: 1750, c: "#ffd166" },
  { x: 1190, y: 1850, c: "#ffffff" },
  { x: 1370, y: 1720, c: "#ff8fa3" },
];

/** Lớp giữa: bãi cỏ nơi nhân vật đứng, lối mòn, cây hai bên, bụi và hoa. Phía trên để trống cho lớp xa. */
const Meadow: FC<BackgroundProps> = ({ frame }) => (
  <g>
    <Defs />
    <path
      d={`M ${X0} 1520 Q 60 1470 540 1500 Q 1020 1470 1520 1520 L 1520 2615 L ${X0} 2615 Z`}
      fill="url(#mk-meadow-grass)"
      stroke={INK}
      strokeWidth={6}
    />
    <path
      d="M 470 1510 Q 520 1700 380 1960 Q 300 2200 340 2615 L 800 2615 Q 720 2200 700 1960 Q 640 1700 610 1510 Z"
      fill="#e6cf9c"
      opacity={0.85}
    />
    {tree("t1", -210, 1560, 1.25, frame)}
    {tree("t2", 60, 1500, 0.8, frame)}
    {tree("t3", 1050, 1505, 0.85, frame)}
    {tree("t4", 1330, 1570, 1.3, frame)}
    <ellipse cx={-30} cy={1575} rx={110} ry={56} fill="#4f9a45" stroke={INK} strokeWidth={6} />
    <ellipse cx={1140} cy={1580} rx={120} ry={60} fill="#5fae52" stroke={INK} strokeWidth={6} />
    {FLOWERS.map((f, i) => {
      const nod = Math.sin(frame / 18 + i * 1.7) * 5;
      return (
        <g key={`f${f.x}`} transform={`translate(${f.x} ${f.y}) rotate(${nod.toFixed(2)})`}>
          <line x1={0} y1={0} x2={0} y2={-46} stroke="#3f7f3a" strokeWidth={6} />
          <circle cx={0} cy={-54} r={17} fill={f.c} stroke={INK} strokeWidth={4} />
          <circle cx={0} cy={-54} r={6} fill={PALETTE.accent} />
        </g>
      );
    })}
  </g>
);

const CLUMPS = [
  { x: -260, lean: 1 },
  { x: 40, lean: 1 },
  { x: 1040, lean: -1 },
  { x: 1330, lean: -1 },
];

/** Tiền cảnh: vài bụi cỏ lớn, tối màu ở hai góc dưới; kit làm mờ và cho trượt nhanh hơn camera. */
const Near: FC<BackgroundProps> = ({ frame }) => {
  const blades: ReactNode[] = [];
  for (const c of CLUMPS) {
    for (let i = 0; i < 5; i++) {
      const bx = c.x + (i - 2) * 46;
      const tip = 300 + ((i * 53) % 110);
      const bend = Math.sin(frame / 22 + c.x / 300 + i * 0.8) * 16 + c.lean * 40 + (i - 2) * 22;
      blades.push(
        <path
          key={`b${c.x}-${i}`}
          d={`M ${bx - 26} 2100 Q ${bx} ${(2100 - tip * 0.6).toFixed(1)} ${(bx + bend).toFixed(1)} ${2100 - tip} Q ${bx + 14} ${(2100 - tip * 0.5).toFixed(1)} ${bx + 26} 2100 Z`}
          fill={i % 2 === 0 ? "#2f6b3a" : "#3b7d42"}
        />,
      );
    }
  }
  return <g>{blades}</g>;
};

/** Đồng cỏ ban ngày, mẫu bối cảnh ba lớp của kit (ADR-023): lớp xa, lớp giữa, tiền cảnh. */
export const bgMeadow: BackgroundAsset = {
  stage: GENERATED_WIDE_BACKGROUND_STAGE,
  Far,
  Component: Meadow,
  Near,
};
