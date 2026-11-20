import type { FC, ReactNode } from "react";
import { PALETTE } from "../../../palette.js";
import { GENERATED_WIDE_BACKGROUND_STAGE } from "../../../stage/generated-stage.js";
import type { BackgroundAsset, BackgroundProps } from "../../../stage/types.js";

const INK = PALETTE.ink;
/** Vùng vẽ: rộng hơn khung dọc 440 mỗi bên cho khung ngang 16:9. */
const X0 = -440;
const X1 = 1520;
const WIDTH = 1960;
const H = 2615;
const HORIZON = 1150;

const Defs: FC = () => (
  <defs>
    <linearGradient id="mk-gen-tbh-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#6fbcec" />
      <stop offset="0.7" stopColor="#bfe4fb" />
      <stop offset="1" stopColor="#e8f6ff" />
    </linearGradient>
    <radialGradient id="mk-gen-tbh-sun" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor="#fff6c9" stopOpacity="0.95" />
      <stop offset="1" stopColor="#fff6c9" stopOpacity="0" />
    </radialGradient>
    <linearGradient id="mk-gen-tbh-sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#9fd3e8" />
      <stop offset="0.25" stopColor="#4fa6cf" />
      <stop offset="1" stopColor="#1f6f9e" />
    </linearGradient>
    <linearGradient id="mk-gen-tbh-near-sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#3d93c2" />
      <stop offset="1" stopColor="#1a5f8a" />
    </linearGradient>
    <linearGradient id="mk-gen-tbh-deck" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#c3ccd4" />
      <stop offset="0.5" stopColor="#a7b2bc" />
      <stop offset="1" stopColor="#8a96a2" />
    </linearGradient>
  </defs>
);

/** Đường sóng lượn ngang toàn vùng vẽ, pha dịch theo frame. */
function wavePath(y: number, amp: number, len: number, shift: number): string {
  let d = `M ${X0 - len} ${y}`;
  for (let x = X0 - len; x < X1 + len; x += len) {
    const sx = x + shift;
    d += ` Q ${(sx + len * 0.25).toFixed(1)} ${(y - amp).toFixed(1)} ${(sx + len * 0.5).toFixed(1)} ${y} T ${(sx + len).toFixed(1)} ${y}`;
  }
  return d;
}

/** Một đám mây ba múi, trôi chậm và lặp lại trong vùng vẽ. */
function cloud(key: string, x: number, y: number, size: number, frame: number, speed: number): ReactNode {
  const cx = X0 + ((x - X0 + frame * speed) % WIDTH);
  return (
    <g key={key} transform={`translate(${cx.toFixed(1)} ${y}) scale(${size})`} opacity={0.92}>
      <ellipse cx={0} cy={0} rx={120} ry={44} fill="#ffffff" />
      <ellipse cx={-58} cy={-26} rx={60} ry={42} fill="#ffffff" />
      <ellipse cx={32} cy={-38} rx={72} ry={50} fill="#ffffff" />
      <ellipse cx={10} cy={14} rx={108} ry={24} fill="#dcefff" />
    </g>
  );
}

/** Lớp xa: trời, mặt trời, mây trôi, đảo mờ ở chân trời, biển rộng với các vệt sóng lấp lánh. */
const Far: FC<BackgroundProps> = ({ frame }) => {
  const rows: ReactNode[] = [];
  for (let i = 0; i < 6; i++) {
    const y = HORIZON + 40 + i * i * 14 + i * 30;
    const shift = Math.sin(frame / 34 + i * 1.3) * (10 + i * 6);
    rows.push(
      <path
        key={`w${i}`}
        d={wavePath(y, 4 + i * 2, 110 + i * 30, shift)}
        fill="none"
        stroke="#e9f7ff"
        strokeWidth={2 + i}
        strokeLinecap="round"
        opacity={0.35 + i * 0.06}
      />,
    );
  }
  const bob = Math.sin(frame / 26) * 3;
  return (
    <g>
      <Defs />
      <rect x={X0} y={0} width={WIDTH} height={H} fill="url(#mk-gen-tbh-sky)" />
      <circle cx={140} cy={320} r={320} fill="url(#mk-gen-tbh-sun)" />
      <circle cx={140} cy={320} r={72} fill="#fff1a8" />
      {cloud("c1", 650, 420, 1, frame, 0.3)}
      {cloud("c2", -180, 660, 0.7, frame, 0.2)}
      {cloud("c3", 1200, 820, 0.85, frame, 0.25)}
      {cloud("c4", 300, 960, 0.5, frame, 0.15)}
      <path
        d={`M -380 ${HORIZON} Q -300 1100 -200 1115 Q -120 1085 -40 1120 Q 20 1130 60 ${HORIZON} Z`}
        fill="#b7d3e2"
      />
      <path d={`M 1180 ${HORIZON} Q 1260 1112 1340 1122 Q 1420 1100 1500 ${HORIZON} Z`} fill="#c4dcea" />
      <rect x={X0} y={HORIZON} width={WIDTH} height={H - HORIZON} fill="url(#mk-gen-tbh-sea)" />
      <rect x={X0} y={HORIZON} width={WIDTH} height={6} fill="#e3f3fb" opacity={0.7} />
      <g transform={`translate(980 ${(HORIZON + 22 + bob).toFixed(1)})`} opacity={0.75}>
        <path d="M -60 0 L 60 0 L 46 18 L -48 18 Z" fill="#7d93a6" />
        <rect x={-24} y={-26} width={40} height={26} rx={4} fill="#93a8b9" />
        <rect x={-6} y={-44} width={6} height={18} fill="#93a8b9" />
      </g>
      {rows}
    </g>
  );
};

/** Lớp giữa: biển gần, sàn tàu thép phẳng với vòng tròn đích, khoang máy hai bên và đèn báo. */
const Deck: FC<BackgroundProps> = ({ frame }) => {
  const blink = 0.35 + 0.65 * Math.max(0, Math.sin(frame / 9));
  const blink2 = 0.35 + 0.65 * Math.max(0, Math.sin(frame / 9 + Math.PI));
  const swell = Math.sin(frame / 30) * 6;
  const shimmer = 0.25 + 0.15 * Math.sin(frame / 20);
  const splashL = Math.sin(frame / 22) * 10;
  const splashR = Math.sin(frame / 22 + 1.7) * 10;
  const posts: ReactNode[] = [];
  for (let i = 0; i < 9; i++) {
    const px = -220 + i * 215;
    if (px > 180 && px < 900) continue;
    posts.push(
      <rect key={`p${i}`} x={px - 9} y={1462} width={18} height={40} rx={6} fill={PALETTE.metalDark} stroke={INK} strokeWidth={5} />,
    );
  }
  return (
    <g>
      <Defs />
      <path
        d={`${wavePath(1470 + swell, 10, 180, Math.sin(frame / 40) * 30)} L ${X1 + 200} ${H} L ${X0 - 200} ${H} Z`}
        fill="url(#mk-gen-tbh-near-sea)"
      />
      <path
        d={`M -340 1500 L 1420 1500 L 1700 ${H} L -620 ${H} Z`}
        fill="url(#mk-gen-tbh-deck)"
        stroke={INK}
        strokeWidth={7}
      />
      <path d="M -340 1500 L 1420 1500 L 1424 1524 L -344 1524 Z" fill={PALETTE.metalDark} opacity={0.6} />
      <path d="M -344 1524 L -350 1546 L 1430 1546 L 1424 1524 Z" fill="#f2c14e" opacity={0.75} />
      <line x1={-340} y1={1500} x2={1420} y2={1500} stroke={INK} strokeWidth={6} />
      {posts}
      <line x1={-400} y1={1700} x2={1480} y2={1700} stroke="#7f8b97" strokeWidth={4} opacity={0.45} />
      <line x1={-470} y1={1900} x2={1550} y2={1900} stroke="#7f8b97" strokeWidth={4} opacity={0.45} />
      <line x1={-540} y1={2250} x2={1620} y2={2250} stroke="#7f8b97" strokeWidth={4} opacity={0.45} />
      <ellipse cx={540} cy={2080} rx={580} ry={220} fill="none" stroke="#f4f7f9" strokeWidth={30} />
      <ellipse cx={540} cy={2080} rx={380} ry={140} fill="none" stroke="#f2c14e" strokeWidth={22} />
      <ellipse cx={540} cy={2080} rx={170} ry={62} fill="#f4f7f9" opacity={0.85} />
      <ellipse cx={500} cy={2066} rx={70} ry={20} fill="#ffffff" opacity={0.6} />
      <ellipse cx={170} cy={2330} rx={150} ry={28} fill="#d8f0ff" opacity={shimmer} />
      <ellipse cx={940} cy={1780} rx={110} ry={18} fill="#d8f0ff" opacity={shimmer * 0.8} />
      <g>
        <path d="M -300 1500 L -300 1360 L -120 1360 L -120 1500 Z" fill={PALETTE.metal} stroke={INK} strokeWidth={6} />
        <path d="M -150 1360 L -120 1360 L -120 1500 L -150 1500 Z" fill={PALETTE.metalDark} opacity={0.5} />
        <rect x={-282} y={1376} width={70} height={10} rx={4} fill="#ffffff" opacity={0.5} />
        <rect x={-300} y={1440} width={180} height={18} fill="#f2c14e" stroke={INK} strokeWidth={4} />
        <circle cx={-210} cy={1340} r={14} fill={PALETTE.alert} opacity={blink} stroke={INK} strokeWidth={4} />
      </g>
      <g>
        <path d="M 1200 1500 L 1200 1360 L 1380 1360 L 1380 1500 Z" fill={PALETTE.metal} stroke={INK} strokeWidth={6} />
        <path d="M 1350 1360 L 1380 1360 L 1380 1500 L 1350 1500 Z" fill={PALETTE.metalDark} opacity={0.5} />
        <rect x={1218} y={1376} width={70} height={10} rx={4} fill="#ffffff" opacity={0.5} />
        <rect x={1200} y={1440} width={180} height={18} fill="#f2c14e" stroke={INK} strokeWidth={4} />
        <circle cx={1290} cy={1340} r={14} fill={PALETTE.ok} opacity={blink2} stroke={INK} strokeWidth={4} />
      </g>
      <path
        d={`M -440 ${(1560 + splashL).toFixed(1)} Q -400 ${(1530 + splashL).toFixed(1)} -360 1560 Q -380 1600 -440 1610 Z`}
        fill="#ffffff"
        opacity={0.7}
      />
      <path
        d={`M 1440 1560 Q 1480 ${(1528 + splashR).toFixed(1)} 1520 ${(1556 + splashR).toFixed(1)} L 1520 1610 Q 1460 1600 1440 1560 Z`}
        fill="#ffffff"
        opacity={0.7}
      />
    </g>
  );
};

/** Tiền cảnh: cọc buộc dây, xích và cuộn dây thừng tối màu ở hai góc dưới; kit làm mờ lớp này. */
const Near: FC<BackgroundProps> = ({ frame }) => {
  const sway = Math.sin(frame / 32) * 4;
  return (
    <g>
      <path d="M -400 2100 L -400 1760 Q -400 1700 -330 1700 L -230 1700 Q -170 1700 -170 1760 L -170 2100 Z" fill="#253546" />
      <ellipse cx={-285} cy={1700} rx={150} ry={46} fill="#2e4256" />
      <path
        d={`M -170 1820 Q -20 ${(1900 + sway).toFixed(1)} 120 ${(2080 + sway).toFixed(1)} L 90 2110 Q -40 ${(1950 + sway).toFixed(1)} -180 1860 Z`}
        fill="#1f2d3b"
      />
      <ellipse cx={1250} cy={2010} rx={230} ry={90} fill="#2b3b4c" />
      <ellipse cx={1250} cy={1980} rx={160} ry={56} fill="#1f2d3b" />
      <ellipse cx={1250} cy={1965} rx={70} ry={24} fill="#2b3b4c" />
      <path d="M 960 2100 L 990 1720 L 1030 1720 L 1060 2100 Z" fill="#22303f" />
    </g>
  );
};

/** Tàu bệ hạ cánh giữa biển ban ngày, bối cảnh ba lớp: lớp xa, lớp giữa, tiền cảnh. */
export const asset: BackgroundAsset = {
  stage: GENERATED_WIDE_BACKGROUND_STAGE,
  Far,
  Component: Deck,
  Near,
};
