import type { FC, ReactNode } from "react";
import { PALETTE } from "../../../palette.js";
import { rnd, wobble } from "../../../rig/math.js";
import { GENERATED_WIDE_BACKGROUND_STAGE } from "../../../stage/generated-stage.js";
import type { BackgroundAsset, BackgroundProps } from "../../../stage/types.js";

const INK = PALETTE.ink;
/** Vùng vẽ: rộng hơn khung dọc 440 mỗi bên cho khung ngang 16:9. */
const X0 = -440;
const WIDTH = 1960;
const BLUE = "#4aa3df";
const BLUE_HI = "#9fd6f5";
const ORANGE = "#f39a4a";
const ORANGE_HI = "#ffcf9a";

const Defs: FC = () => (
  <defs>
    <linearGradient id="mk-gen-wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#e3f2f6" />
      <stop offset="0.55" stopColor="#cfe6ee" />
      <stop offset="1" stopColor="#b6d3dd" />
    </linearGradient>
    <linearGradient id="mk-gen-floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#c7dbe2" />
      <stop offset="1" stopColor="#8eaebb" />
    </linearGradient>
    <linearGradient id="mk-gen-liquid" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#7fdcf2" />
      <stop offset="1" stopColor="#2f8fc4" />
    </linearGradient>
    <radialGradient id="mk-gen-glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor="#bfeaff" stopOpacity="0.85" />
      <stop offset="1" stopColor="#bfeaff" stopOpacity="0" />
    </radialGradient>
  </defs>
);

/** Bể ngâm máy chủ: khung kim loại, chất lỏng xanh gợn sóng, máy chủ chìm, bọt khí nổi lên. */
function tank(key: string, x: number, y: number, w: number, h: number, frame: number, seed: number): ReactNode {
  const count = Math.max(2, Math.floor((w - 60) / 95));
  const gap = (w - 60) / count;
  const servers: ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    const sx = x + 30 + i * gap + 10;
    const blink = 0.55 + 0.45 * Math.max(0, Math.sin(frame / 9 + i * 1.9 + seed));
    servers.push(
      <g key={`${key}-s${i}`}>
        <rect x={sx} y={y + 80} width={gap - 20} height={h - 120} rx={6} fill="#2f5a70" stroke={INK} strokeWidth={4} opacity={0.85} />
        <rect x={sx + 8} y={y + 96} width={gap - 36} height={10} rx={4} fill="#4f86a0" />
        <circle cx={sx + gap / 2 - 10} cy={y + 130} r={6} fill={PALETTE.ok} opacity={blink} />
      </g>,
    );
  }
  const bubbles: ReactNode[] = [];
  const span = h - 90;
  for (let i = 0; i < 7; i++) {
    const phase = (frame * (1.2 + rnd(seed, i) * 0.8) + rnd(seed + 3, i) * span) % span;
    const bx = x + 34 + rnd(seed + 7, i) * (w - 68) + Math.sin(frame / 12 + i) * 5;
    bubbles.push(
      <circle key={`${key}-b${i}`} cx={bx.toFixed(1)} cy={(y + h - 30 - phase).toFixed(1)} r={5 + rnd(seed, i + 9) * 6} fill="#ffffff" opacity={0.55} />,
    );
  }
  const s = y + 52;
  const wv = wobble(frame, seed, 50) * 6;
  const wave = `M ${x + 18} ${s} Q ${x + w * 0.25} ${(s - 10 + wv).toFixed(1)} ${x + w * 0.5} ${s} Q ${x + w * 0.75} ${(s + 10 - wv).toFixed(1)} ${x + w - 18} ${s} L ${x + w - 18} ${s + 16} L ${x + 18} ${s + 16} Z`;
  return (
    <g key={key}>
      <rect x={x} y={y} width={w} height={h} rx={18} fill={PALETTE.metal} stroke={INK} strokeWidth={6} />
      <rect x={x + 18} y={y + 46} width={w - 36} height={h - 64} rx={8} fill="url(#mk-gen-liquid)" />
      {servers}
      {bubbles}
      <path d={wave} fill="#d4f6ff" opacity={0.6} />
      <rect x={x + 26} y={y + 70} width={12} height={h - 110} rx={6} fill="#ffffff" opacity={0.35} />
      <rect x={x - 10} y={y - 8} width={w + 20} height={30} rx={12} fill={PALETTE.metalDark} stroke={INK} strokeWidth={6} />
      <rect x={x + 6} y={y - 2} width={w * 0.4} height={8} rx={4} fill="#ffffff" opacity={0.3} />
    </g>
  );
}

/** Một ống nằm ngang có ánh sáng trên và vệt dòng chảy trôi theo frame. */
function hPipe(key: string, y: number, color: string, hi: string, frame: number, dir: number): ReactNode {
  return (
    <g key={key}>
      <rect x={X0 - 10} y={y} width={WIDTH + 20} height={44} fill={color} stroke={INK} strokeWidth={6} />
      <rect x={X0} y={y + 7} width={WIDTH} height={8} fill={hi} opacity={0.8} />
      <line x1={X0} y1={y + 28} x2={1520} y2={y + 28} stroke="#ffffff" strokeWidth={5} strokeLinecap="round" strokeDasharray="34 70" strokeDashoffset={(-frame * 3 * dir).toFixed(1)} opacity={0.45} />
      {[-300, 140, 600, 1060, 1400].map((fx) => (
        <rect key={`${key}-f${fx}`} x={fx} y={y - 8} width={22} height={60} rx={5} fill={PALETTE.metalDark} stroke={INK} strokeWidth={5} />
      ))}
    </g>
  );
}

/** Một ống thẳng đứng chạy từ ống ngang xuống bể. */
function vPipe(key: string, x: number, y1: number, y2: number, color: string, hi: string): ReactNode {
  return (
    <g key={key}>
      <rect x={x} y={y1} width={40} height={y2 - y1} fill={color} stroke={INK} strokeWidth={6} />
      <rect x={x + 7} y={y1} width={8} height={y2 - y1} fill={hi} opacity={0.8} />
    </g>
  );
}

/** Lớp xa: tường xanh nhạt, đèn trần dịu nhấp nháy, ống xanh và cam, đồng hồ áp suất và bể ngâm phía sau. */
const Far: FC<BackgroundProps> = ({ frame }) => {
  const glow = 0.55 + 0.12 * wobble(frame, 11, 70);
  const needle = -20 + wobble(frame, 5, 60) * 14;
  return (
    <g>
      <Defs />
      <rect x={X0} y={0} width={WIDTH} height={2615} fill="url(#mk-gen-wall)" />
      <rect x={X0} y={0} width={WIDTH} height={170} fill="#c3dbe3" />
      {[-320, 280, 900].map((lx) => (
        <g key={`l${lx}`}>
          <ellipse cx={lx + 230} cy={300} rx={340} ry={180} fill="url(#mk-gen-glow)" opacity={glow} />
          <rect x={lx} y={150} width={460} height={30} rx={14} fill="#eafaff" stroke={INK} strokeWidth={5} />
        </g>
      ))}
      {[-200, 40, 280, 520, 760, 1000, 1240].map((px) => (
        <line key={`p${px}`} x1={px} y1={520} x2={px} y2={1490} stroke="#acc9d3" strokeWidth={4} />
      ))}
      {vPipe("v1", 120, 360, 1120, BLUE, BLUE_HI)}
      {vPipe("v2", 920, 440, 1120, ORANGE, ORANGE_HI)}
      {vPipe("v3", -260, 440, 1500, ORANGE, ORANGE_HI)}
      {vPipe("v4", 1320, 360, 1500, BLUE, BLUE_HI)}
      {hPipe("hb", 330, BLUE, BLUE_HI, frame, 1)}
      {hPipe("ho", 410, ORANGE, ORANGE_HI, frame, -1)}
      <g transform="translate(1160 760)">
        <circle cx={0} cy={0} r={62} fill="#f6fbfd" stroke={INK} strokeWidth={6} />
        <path d="M -40 20 A 45 45 0 0 1 40 20" fill="none" stroke={PALETTE.ok} strokeWidth={8} />
        <line x1={0} y1={0} x2={0} y2={-42} stroke={PALETTE.alert} strokeWidth={6} strokeLinecap="round" transform={`rotate(${needle.toFixed(2)})`} />
        <circle cx={0} cy={0} r={8} fill={INK} />
      </g>
      <rect x={-140} y={640} width={200} height={140} rx={14} fill="#bcd5de" stroke={INK} strokeWidth={5} />
      {[670, 700, 730, 760].map((vy) => (
        <line key={`vent${vy}`} x1={-118} y1={vy - 5} x2={38} y2={vy - 5} stroke="#7d9fac" strokeWidth={6} strokeLinecap="round" />
      ))}
      <g opacity={0.82}>{tank("back", 150, 1120, 790, 370, frame, 21)}</g>
      <rect x={X0} y={1488} width={WIDTH} height={30} fill="#9dbac5" />
    </g>
  );
};

/** Lớp giữa: sàn phòng máy, rãnh lưới, hai bể ngâm lớn hai bên dải đứng của nhân vật. */
const Component: FC<BackgroundProps> = ({ frame }) => (
  <g>
    <Defs />
    <path d={`M ${X0} 1505 L 1520 1505 L 1520 2615 L ${X0} 2615 Z`} fill="url(#mk-gen-floor)" stroke={INK} strokeWidth={6} />
    {[-600, -200, 200, 540, 880, 1280, 1680].map((fx) => (
      <line key={`fl${fx}`} x1={540 + (fx - 540) * 0.45} y1={1510} x2={fx} y2={2615} stroke="#a9c3cc" strokeWidth={4} />
    ))}
    {[1700, 1900, 2200].map((fy) => (
      <line key={`fh${fy}`} x1={X0} y1={fy} x2={1520} y2={fy} stroke="#a9c3cc" strokeWidth={4} />
    ))}
    <rect x={300} y={2020} width={480} height={50} rx={10} fill="#7f9fac" stroke={INK} strokeWidth={5} />
    <ellipse cx={540} cy={1640} rx={380} ry={40} fill="#d9f4ff" opacity={0.25 + 0.08 * wobble(frame, 4, 80)} />
    <ellipse cx={-120} cy={1585} rx={320} ry={26} fill="#000" opacity={0.16} />
    <ellipse cx={1210} cy={1585} rx={300} ry={26} fill="#000" opacity={0.16} />
    {tank("left", -410, 1220, 580, 360, frame, 3)}
    {tank("right", 950, 1220, 540, 360, frame, 8)}
  </g>
);

/** Tiền cảnh: góc bể, ống uốn và vô lăng van tối màu ở hai góc dưới; kit làm mờ lớp này. */
const Near: FC<BackgroundProps> = ({ frame }) => {
  const turn = wobble(frame, 9, 90) * 6;
  return (
    <g>
      <rect x={-430} y={1720} width={400} height={520} rx={40} fill="#17323f" />
      <path d="M 40 2200 L 40 1820 Q 40 1760 -20 1760 L -60 1760 L -60 1820 L -20 1820 Q -20 1820 -20 1840 L -20 2200 Z" fill="#1f4252" />
      <rect x={1100} y={1700} width={400} height={520} rx={40} fill="#17323f" />
      <g transform={`translate(1010 1800) rotate(${turn.toFixed(2)})`}>
        <circle cx={0} cy={0} r={62} fill="none" stroke="#1f4252" strokeWidth={22} />
        <rect x={-62} y={-9} width={124} height={18} fill="#1f4252" />
        <rect x={-9} y={-62} width={18} height={124} fill="#1f4252" />
      </g>
      <rect x={995} y={1800} width={30} height={400} fill="#1f4252" />
    </g>
  );
};

/** Phòng làm mát bằng chất lỏng của trung tâm dữ liệu, bối cảnh ba lớp. */
export const asset: BackgroundAsset = {
  stage: GENERATED_WIDE_BACKGROUND_STAGE,
  Far,
  Component,
  Near,
};
