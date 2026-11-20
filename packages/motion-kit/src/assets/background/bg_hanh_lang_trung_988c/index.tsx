import type { FC, ReactNode } from "react";
import { PALETTE } from "../../../palette.js";
import { rnd, wobble } from "../../../rig/math.js";
import { GENERATED_WIDE_BACKGROUND_STAGE } from "../../../stage/generated-stage.js";
import type { BackgroundAsset, BackgroundProps } from "../../../stage/types.js";

const INK = PALETTE.ink;
/** Vùng vẽ: rộng hơn khung dọc 440 mỗi bên cho khung ngang 16:9. */
const X0 = -440;
const WIDTH = 1960;
const GREEN = "#5cf0a0";
const BLUE = "#5cc8ff";

const Defs: FC = () => (
  <defs>
    <linearGradient id="mk-gen-dc-wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#1c2636" />
      <stop offset="0.45" stopColor="#2c3a50" />
      <stop offset="1" stopColor="#3a4c64" />
    </linearGradient>
    <radialGradient id="mk-gen-dc-door" cx="0.5" cy="0.5" r="0.6">
      <stop offset="0" stopColor="#d8f1ff" stopOpacity="1" />
      <stop offset="1" stopColor="#7fb6d9" stopOpacity="1" />
    </radialGradient>
    <radialGradient id="mk-gen-dc-halo" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor="#bfe6ff" stopOpacity="0.55" />
      <stop offset="1" stopColor="#bfe6ff" stopOpacity="0" />
    </radialGradient>
    <linearGradient id="mk-gen-dc-floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#4a5d76" />
      <stop offset="0.35" stopColor="#33445a" />
      <stop offset="1" stopColor="#1f2a3a" />
    </linearGradient>
    <linearGradient id="mk-gen-dc-rack" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stopColor="#4b5a70" />
      <stop offset="0.25" stopColor="#3a475a" />
      <stop offset="1" stopColor="#262f3e" />
    </linearGradient>
    <linearGradient id="mk-gen-dc-refl" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#8fb4d6" stopOpacity="0.32" />
      <stop offset="1" stopColor="#8fb4d6" stopOpacity="0" />
    </linearGradient>
  </defs>
);

/** Lớp xa: tường trần tối, máng cáp, hai dãy tủ xa hội tụ về cửa sáng cuối hành lang. */
const Far: FC<BackgroundProps> = ({ frame }) => {
  const dots: ReactNode[] = [];
  for (let i = 0; i < 10; i++) {
    const y = 640 + i * 78;
    const on = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(frame / (7 + (i % 4)) + i * 1.9));
    dots.push(<circle key={`fl${i}`} cx={290 + i * 9} cy={y} r={5} fill={i % 2 ? BLUE : GREEN} opacity={on * 0.7} />);
    dots.push(<circle key={`fr${i}`} cx={790 - i * 9} cy={y} r={5} fill={i % 2 ? GREEN : BLUE} opacity={on * 0.7} />);
  }
  const lamps: ReactNode[] = [];
  for (let i = 0; i < 7; i++) {
    const lx = -340 + i * 300;
    const glow = 0.85 + 0.15 * wobble(frame, 11 + i, 90);
    lamps.push(<rect key={`lp${i}`} x={lx} y={250} width={180} height={22} rx={10} fill="#cfe9ff" opacity={glow * 0.8} />);
  }
  return (
    <g>
      <Defs />
      <rect x={X0} y={0} width={WIDTH} height={2615} fill="url(#mk-gen-dc-wall)" />
      <rect x={X0} y={330} width={WIDTH} height={36} fill="#2a3446" />
      <rect x={X0} y={366} width={WIDTH} height={10} fill="#46566e" />
      {lamps}
      <path d="M 230 560 L 440 990 L 440 1420 L 230 1560 Z" fill="#56677f" stroke={INK} strokeWidth={5} />
      <path d="M 850 560 L 640 990 L 640 1420 L 850 1560 Z" fill="#4b5b72" stroke={INK} strokeWidth={5} />
      <path d="M 230 560 L 440 990 L 640 990 L 850 560 Z" fill="#26313f" />
      <circle cx={540} cy={1200} r={300} fill="url(#mk-gen-dc-halo)" opacity={0.85 + 0.15 * wobble(frame, 3, 120)} />
      <rect x={440} y={990} width={200} height={430} fill="url(#mk-gen-dc-door)" stroke={INK} strokeWidth={5} />
      <rect x={455} y={1005} width={70} height={400} fill="#ffffff" opacity={0.25} />
      {dots}
      <rect x={X0} y={1420} width={WIDTH} height={1195} fill="#2a3648" />
    </g>
  );
};

/** Một tủ máy chủ: vỏ có bóng, khe ổ, đèn nhấp nháy lệch nhịp và quạt gió quay chậm. */
function rack(key: string, x: number, w: number, seed: number, frame: number): ReactNode {
  const top = 470;
  const bottom = 1565;
  const leds: ReactNode[] = [];
  const slots: ReactNode[] = [];
  for (let r = 0; r < 9; r++) {
    const y = top + 70 + r * 72;
    slots.push(<rect key={`${key}s${r}`} x={x + 22} y={y} width={w - 44} height={52} rx={6} fill="#1a2230" stroke={INK} strokeWidth={3} />);
    for (let c = 0; c < 3; c++) {
      const period = 5 + rnd(seed, r * 3 + c) * 9;
      const phase = rnd(seed + 7, r * 3 + c) * 6.28;
      const s = Math.sin(frame / period + phase);
      const on = s > -0.2 ? 1 : 0.25;
      const col = rnd(seed + 3, r * 3 + c) > 0.45 ? GREEN : BLUE;
      leds.push(<circle key={`${key}l${r}-${c}`} cx={x + 42 + c * 24} cy={y + 26} r={7} fill={col} opacity={on} />);
    }
  }
  const fy = bottom - 150;
  const fx = x + w / 2;
  const spin = (frame * 2.4 + seed * 37) % 360;
  return (
    <g key={key}>
      <rect x={x} y={top} width={w} height={bottom - top} rx={12} fill="url(#mk-gen-dc-rack)" stroke={INK} strokeWidth={6} />
      <rect x={x + 10} y={top + 14} width={14} height={bottom - top - 40} rx={6} fill="#7d8ea6" opacity={0.45} />
      {slots}
      {leds}
      <circle cx={fx} cy={fy} r={58} fill="#151c27" stroke={INK} strokeWidth={5} />
      <g transform={`rotate(${spin.toFixed(1)} ${fx} ${fy})`}>
        {[0, 90, 180, 270].map((a) => (
          <ellipse key={`${key}b${a}`} cx={fx} cy={fy - 26} rx={13} ry={26} fill={PALETTE.metal} transform={`rotate(${a} ${fx} ${fy})`} />
        ))}
      </g>
      <circle cx={fx} cy={fy} r={11} fill={PALETTE.metalDark} stroke={INK} strokeWidth={3} />
    </g>
  );
}

const RACKS = [
  { x: -430, w: 200, s: 1 },
  { x: -215, w: 200, s: 2 },
  { x: 0, w: 205, s: 3 },
  { x: 875, w: 205, s: 4 },
  { x: 1095, w: 200, s: 5 },
  { x: 1310, w: 200, s: 6 },
];

/** Lớp giữa: sàn bóng phản chiếu, vạch gạch hội tụ, hai dãy tủ máy chủ cao hai bên. */
const Component: FC<BackgroundProps> = ({ frame }) => {
  const lines: ReactNode[] = [];
  for (let i = -6; i <= 6; i++) {
    lines.push(<line key={`g${i}`} x1={540 + i * 40} y1={1500} x2={540 + i * 330} y2={2615} stroke="#5a6e88" strokeWidth={3} opacity={0.45} />);
  }
  [1620, 1760, 1960, 2250].forEach((y) => {
    lines.push(<line key={`h${y}`} x1={X0} y1={y} x2={1520} y2={y} stroke="#5a6e88" strokeWidth={3} opacity={0.4} />);
  });
  const glows = RACKS.map((r, i) => {
    const flick = 0.75 + 0.25 * wobble(frame, 20 + i, 50);
    return (
      <g key={`rf${i}`}>
        <rect x={r.x + 10} y={1570} width={r.w - 20} height={420} fill="url(#mk-gen-dc-refl)" />
        <rect x={r.x + 40} y={1590} width={10} height={260} rx={5} fill={i % 2 ? BLUE : GREEN} opacity={0.22 * flick} />
        <rect x={r.x + 72} y={1590} width={8} height={200} rx={4} fill={i % 2 ? GREEN : BLUE} opacity={0.18 * flick} />
      </g>
    );
  });
  return (
    <g>
      <Defs />
      <rect x={X0} y={1500} width={WIDTH} height={1115} fill="url(#mk-gen-dc-floor)" />
      <path d="M 440 1500 L 640 1500 L 760 2615 L 320 2615 Z" fill="#cfe9ff" opacity={0.1 + 0.03 * wobble(frame, 9, 110)} />
      {lines}
      {glows}
      {RACKS.map((r) => rack(`r${r.s}`, r.x, r.w, r.s, frame))}
      <rect x={X0} y={1556} width={WIDTH} height={14} fill="#1a2230" opacity={0.6} />
    </g>
  );
};

/** Tiền cảnh: góc tủ tối và bó cáp ở hai góc dưới, khẽ đung đưa. */
const Near: FC<BackgroundProps> = ({ frame }) => {
  const sway = wobble(frame, 5, 140) * 10;
  return (
    <g>
      <rect x={-440} y={1700} width={230} height={420} rx={20} fill="#0e1520" />
      <path d={`M -200 2100 Q -120 ${1880 + sway} ${-20 + sway} 1760 Q 40 1720 110 1780 Q 30 1820 -60 2100 Z`} fill="#141d2a" />
      <path d={`M -120 2100 Q -40 ${1920 - sway} ${60 - sway} 1840 Q 120 1830 150 1880 Q 60 1940 0 2100 Z`} fill="#0b111a" />
      <rect x={1250} y={1680} width={240} height={440} rx={20} fill="#0e1520" />
      <path d={`M 1260 2100 Q 1150 ${1900 - sway} ${1040 - sway} 1780 Q 980 1740 930 1800 Q 1030 1850 1140 2100 Z`} fill="#141d2a" />
    </g>
  );
};

/** Hành lang trung tâm dữ liệu ba lớp: lớp xa, lớp giữa, tiền cảnh. */
export const asset: BackgroundAsset = {
  stage: GENERATED_WIDE_BACKGROUND_STAGE,
  Far,
  Component,
  Near,
};
