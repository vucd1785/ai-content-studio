import type { FC, ReactNode } from "react";
import { PALETTE } from "../../../palette.js";
import { easing } from "../../../rig/math.js";
import { GENERATED_WIDE_BACKGROUND_STAGE } from "../../../stage/generated-stage.js";
import type { BackgroundAsset, BackgroundProps } from "../../../stage/types.js";

const INK = PALETTE.ink;
/** Vùng vẽ: rộng hơn khung dọc 440 mỗi bên cho khung ngang 16:9. */
const X0 = -440;
const X1 = 1520;
const WIDTH = 1960;
const H = 2615;

const Defs: FC = () => (
  <defs>
    <linearGradient id="mk-gen-barge-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#6fbce8" />
      <stop offset="0.7" stopColor="#bfe5fa" />
      <stop offset="1" stopColor="#e8f6fd" />
    </linearGradient>
    <radialGradient id="mk-gen-barge-sun" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor="#fff6c9" stopOpacity="0.95" />
      <stop offset="1" stopColor="#fff6c9" stopOpacity="0" />
    </radialGradient>
    <linearGradient id="mk-gen-barge-sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#9fd3ea" />
      <stop offset="0.25" stopColor="#5fb0d8" />
      <stop offset="1" stopColor="#2d7fb3" />
    </linearGradient>
    <linearGradient id="mk-gen-barge-deck" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#b9c3cc" />
      <stop offset="1" stopColor="#8e9aa6" />
    </linearGradient>
    <linearGradient id="mk-gen-barge-hull" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#4d5b6a" />
      <stop offset="1" stopColor="#2f3a47" />
    </linearGradient>
    <linearGradient id="mk-gen-barge-water" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#3a90c4" />
      <stop offset="1" stopColor="#1f5f8f" />
    </linearGradient>
  </defs>
);

/** Đường sóng mượt chạy ngang toàn vùng vẽ, khép xuống đáy. */
function wavePath(base: number, amp: number, len: number, phase: number, bottom: number): string {
  let d = `M ${X0} ${bottom} L ${X0} ${(base + amp * Math.sin(phase)).toFixed(1)}`;
  for (let x = X0 + 40; x <= X1; x += 40) {
    const y = base + amp * Math.sin(((x - X0) / len) * Math.PI * 2 + phase);
    d += ` L ${x} ${y.toFixed(1)}`;
  }
  return `${d} L ${X1} ${bottom} Z`;
}

/** Một đám mây ba múi, trôi chậm và lặp lại trong vùng vẽ. */
function cloud(key: string, x: number, y: number, size: number, frame: number, speed: number) {
  const cx = X0 + ((((x - X0 + frame * speed) % WIDTH) + WIDTH) % WIDTH);
  return (
    <g key={key} transform={`translate(${cx.toFixed(1)} ${y}) scale(${size})`} opacity={0.92}>
      <ellipse cx={0} cy={0} rx={120} ry={44} fill="#ffffff" />
      <ellipse cx={-60} cy={-26} rx={62} ry={42} fill="#ffffff" />
      <ellipse cx={30} cy={-38} rx={74} ry={50} fill="#ffffff" />
      <ellipse cx={10} cy={14} rx={110} ry={24} fill="#dcefff" />
    </g>
  );
}

/** Lớp xa: trời, mặt trời, mây, đảo mờ ở chân trời, biển xa lấp lánh. */
const Far: FC<BackgroundProps> = ({ frame }) => {
  const glints: ReactNode[] = [];
  for (let i = 0; i < 7; i++) {
    const gx = -300 + i * 270 + (i % 2) * 60;
    const gy = 1200 + (i % 3) * 60;
    const op = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(frame / 14 + i * 1.9));
    glints.push(<ellipse key={`g${i}`} cx={gx} cy={gy} rx={46} ry={5} fill="#ffffff" opacity={op.toFixed(2)} />);
  }
  return (
    <g>
      <Defs />
      <rect x={X0} y={0} width={WIDTH} height={H} fill="url(#mk-gen-barge-sky)" />
      <circle cx={130} cy={320} r={320} fill="url(#mk-gen-barge-sun)" />
      <circle cx={130} cy={320} r={72} fill="#fff1a8" />
      {cloud("c1", 640, 430, 1, frame, 0.3)}
      {cloud("c2", -150, 680, 0.7, frame, 0.2)}
      {cloud("c3", 1200, 820, 0.85, frame, 0.25)}
      <path d="M -440 1150 Q -300 1070 -140 1120 Q -60 1100 20 1150 Z" fill="#a9cbd8" />
      <path d="M 1150 1150 Q 1260 1090 1360 1110 Q 1450 1080 1520 1130 L 1520 1150 Z" fill="#b5d3df" />
      <g transform={`translate(${(820 + Math.sin(frame / 90) * 6).toFixed(1)} 1146)`} fill="#8fb2c4">
        <path d="M -40 0 L 40 0 L 30 -14 L -30 -14 Z" />
        <rect x={-12} y={-30} width={22} height={16} />
      </g>
      <rect x={X0} y={1150} width={WIDTH} height={H - 1150} fill="url(#mk-gen-barge-sea)" />
      <path d={wavePath(1320, 6, 260, frame / 30, H)} fill="#4f9fcf" opacity={0.5} />
      {glints}
    </g>
  );
};

const STRIPES: number[] = [];
for (let x = -320; x <= 1380; x += 80) STRIPES.push(x);
const POSTS: number[] = [];
for (let x = -160; x <= 1240; x += 140) POSTS.push(x);

/** Lớp giữa: sà lan bập bềnh (mặt sàn, vòng đánh dấu, mép sọc, khối thiết bị hai đầu) và sóng phía trước. */
const Barge: FC<BackgroundProps> = ({ frame }) => {
  const bob = Math.sin(frame / 38) * 7;
  const tilt = Math.sin(frame / 55 + 0.6) * 0.5;
  const blink = easing.inOut(0.5 + 0.5 * Math.sin(frame / 10));
  return (
    <g>
      <Defs />
      <g transform={`translate(0 ${bob.toFixed(2)}) rotate(${tilt.toFixed(3)} 540 1800)`}>
        {/* Khối thiết bị hai đầu sà lan */}
        <rect x={-260} y={1290} width={200} height={210} rx={14} fill="#9aa6b1" stroke={INK} strokeWidth={6} />
        <rect x={-240} y={1310} width={60} height={170} rx={8} fill="#c4ccd4" opacity={0.7} />
        <rect x={1130} y={1310} width={190} height={190} rx={14} fill="#8693a0" stroke={INK} strokeWidth={6} />
        <line x1={1270} y1={1310} x2={1270} y2={1150} stroke={INK} strokeWidth={8} />
        <circle cx={1270} cy={1140} r={14} fill={PALETTE.alert} stroke={INK} strokeWidth={4} opacity={(0.45 + 0.55 * blink).toFixed(2)} />
        {/* Lan can mép sau */}
        <line x1={-200} y1={1440} x2={1280} y2={1440} stroke={PALETTE.metalDark} strokeWidth={6} />
        {POSTS.map((x) => (
          <line key={`p${x}`} x1={x} y1={1440} x2={x} y2={1474} stroke={PALETTE.metalDark} strokeWidth={6} />
        ))}
        {/* Mặt sàn */}
        <path d="M -200 1470 L 1280 1470 L 1420 1960 L -340 1960 Z" fill="url(#mk-gen-barge-deck)" stroke={INK} strokeWidth={7} strokeLinejoin="round" />
        <path d="M -200 1470 L 1280 1470 L 1296 1526 L -216 1526 Z" fill="#cfd7de" opacity={0.6} />
        {/* Vòng tròn đánh dấu bãi đáp */}
        <ellipse cx={540} cy={1730} rx={430} ry={170} fill="none" stroke="#f4f6f8" strokeWidth={18} opacity={0.85} />
        <ellipse cx={540} cy={1730} rx={300} ry={116} fill="none" stroke="#f4f6f8" strokeWidth={8} opacity={0.6} />
        <ellipse cx={540} cy={1730} rx={70} ry={27} fill="#e9edf0" opacity={0.7} />
        {/* Thân sà lan phía trước */}
        <path d="M -340 1960 L 1420 1960 L 1380 2110 L -300 2110 Z" fill="url(#mk-gen-barge-hull)" stroke={INK} strokeWidth={7} strokeLinejoin="round" />
        <rect x={-336} y={1966} width={1752} height={40} fill={PALETTE.warn} />
        {STRIPES.map((x) => (
          <path key={`s${x}`} d={`M ${x} 2006 L ${x + 30} 1966 L ${x + 62} 1966 L ${x + 32} 2006 Z`} fill={INK} />
        ))}
        <line x1={-336} y1={2006} x2={1416} y2={2006} stroke={INK} strokeWidth={5} />
      </g>
      {/* Sóng phía trước che đáy sà lan */}
      <path d={wavePath(2060, 14, 300, frame / 16, H)} fill="url(#mk-gen-barge-water)" stroke={INK} strokeWidth={6} />
      <path d={wavePath(2072, 8, 300, frame / 16 + 0.5, 2090)} fill="#bfe6f5" opacity={0.55} />
      <path d={wavePath(2300, 18, 420, -frame / 22, H)} fill="#2a6f9f" opacity={0.7} />
    </g>
  );
};

/** Tiền cảnh: ngọn sóng lớn tối màu và một phao nổi ở hai góc dưới. */
const Near: FC<BackgroundProps> = ({ frame }) => {
  const s1 = Math.sin(frame / 24) * 18;
  const s2 = Math.sin(frame / 24 + 2) * 18;
  const buoy = Math.sin(frame / 20 + 1) * 10;
  return (
    <g>
      <path
        d={`M -440 2140 L -440 1780 Q -320 ${(1700 + s1).toFixed(1)} -200 1760 Q -60 1830 40 ${(1880 + s1 * 0.5).toFixed(1)} Q 120 1960 150 2140 Z`}
        fill="#123a5c"
      />
      <path
        d={`M -440 2140 L -420 1920 Q -280 ${(1860 + s2 * 0.6).toFixed(1)} -150 1930 Q -40 2000 60 2140 Z`}
        fill="#1a4a72"
      />
      <path
        d={`M 1520 2140 L 1520 1760 Q 1400 ${(1690 + s2).toFixed(1)} 1270 1760 Q 1120 1840 1010 ${(1900 + s2 * 0.5).toFixed(1)} Q 940 1990 930 2140 Z`}
        fill="#123a5c"
      />
      <g transform={`translate(1220 ${(1880 + buoy).toFixed(1)}) rotate(${(buoy * 0.6).toFixed(2)})`}>
        <path d="M -50 0 Q 0 -110 50 0 Z" fill="#0f2f4a" />
        <rect x={-6} y={-150} width={12} height={60} fill="#0f2f4a" />
      </g>
      <path
        d={`M 1520 2140 L 1500 1940 Q 1380 ${(1880 + s1 * 0.6).toFixed(1)} 1260 1950 Q 1140 2020 1060 2140 Z`}
        fill="#1a4a72"
      />
    </g>
  );
};

/** Sà lan hạ cánh giữa biển ban ngày, bối cảnh ba lớp: lớp xa, lớp giữa, tiền cảnh. */
export const asset: BackgroundAsset = {
  stage: GENERATED_WIDE_BACKGROUND_STAGE,
  Far,
  Component: Barge,
  Near,
};
