import type { FC, ReactNode } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble } from "../../../rig/math.js";
import { GENERATED_WIDE_BACKGROUND_STAGE } from "../../../stage/generated-stage.js";
import type { BackgroundAsset, BackgroundProps } from "../../../stage/types.js";

const INK = PALETTE.ink;
/** Vùng vẽ: rộng hơn khung dọc 440 mỗi bên cho khung ngang 16:9. */
const X0 = -440;
const WIDTH = 1960;

const Defs: FC = () => (
  <defs>
    <linearGradient id="mk-gen-wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#dbe8f2" />
      <stop offset="0.7" stopColor="#c9dbe8" />
      <stop offset="1" stopColor="#b7cad9" />
    </linearGradient>
    <linearGradient id="mk-gen-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#8fc6ea" />
      <stop offset="1" stopColor="#d8eefa" />
    </linearGradient>
    <linearGradient id="mk-gen-floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#a9b9c6" />
      <stop offset="1" stopColor="#7f92a3" />
    </linearGradient>
    <linearGradient id="mk-gen-crt" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#5f9fb8" />
      <stop offset="1" stopColor="#24485c" />
    </linearGradient>
    <linearGradient id="mk-gen-shaft" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#e9f6ff" stopOpacity="0.55" />
      <stop offset="1" stopColor="#e9f6ff" stopOpacity="0" />
    </linearGradient>
    <clipPath id="mk-gen-win">
      <rect x={316} y={396} width={448} height={688} />
    </clipPath>
  </defs>
);

/** Đám mây nhỏ trôi qua khung cửa sổ, lặp lại trong bề ngang ô kính. */
function cloud(key: string, x: number, y: number, s: number, frame: number, speed: number): ReactNode {
  const cx = 220 + ((x + frame * speed) % 660);
  return (
    <g key={key} transform={`translate(${cx.toFixed(1)} ${y}) scale(${s})`} opacity={0.9}>
      <ellipse cx={0} cy={0} rx={90} ry={30} fill="#ffffff" />
      <ellipse cx={-30} cy={-22} rx={46} ry={32} fill="#ffffff" />
      <ellipse cx={26} cy={-28} rx={54} ry={38} fill="#f4fbff" />
    </g>
  );
}

/** Lớp xa: tường xanh nhạt, cửa sổ kính nhìn ra phố, bảng trắng vẽ sơ đồ, kệ hồ sơ và tranh chip. */
const Far: FC<BackgroundProps> = ({ frame }) => (
  <g>
    <Defs />
    <rect x={X0} y={0} width={WIDTH} height={2615} fill="url(#mk-gen-wall)" />
    {/* Cửa sổ */}
    <rect x={316} y={396} width={448} height={688} fill="url(#mk-gen-sky)" />
    <g clipPath="url(#mk-gen-win)">
      {cloud("c1", 40, 500, 1, frame, 0.3)}
      {cloud("c2", 380, 620, 0.7, frame, 0.2)}
      <path
        d="M 316 1084 L 316 900 L 380 900 L 380 840 L 450 840 L 450 930 L 520 930 L 520 790 L 600 790 L 600 880 L 660 880 L 660 820 L 764 820 L 764 1084 Z"
        fill="#b8d3e4"
      />
      <path d="M 316 1084 L 316 980 L 420 980 L 420 950 L 560 950 L 560 1000 L 700 1000 L 700 960 L 764 960 L 764 1084 Z" fill="#9dbfd4" />
    </g>
    <rect x={316} y={396} width={448} height={688} fill="none" stroke={PALETTE.metal} strokeWidth={22} />
    <line x1={540} y1={396} x2={540} y2={1084} stroke={PALETTE.metal} strokeWidth={14} />
    <line x1={316} y1={740} x2={764} y2={740} stroke={PALETTE.metal} strokeWidth={14} />
    <rect x={296} y={376} width={488} height={728} fill="none" stroke={INK} strokeWidth={7} rx={8} />
    <path d="M 350 430 L 420 430 L 350 520 Z" fill="#ffffff" opacity={0.45} />
    <rect x={286} y={1100} width={508} height={30} rx={8} fill={PALETTE.paper} stroke={INK} strokeWidth={6} />
    {/* Bảng trắng */}
    <rect x={-340} y={560} width={520} height={400} rx={14} fill="#fbfdff" stroke={INK} strokeWidth={7} />
    <rect x={-322} y={578} width={60} height={364} fill="#ffffff" opacity={0.7} />
    <rect x={-240} y={640} width={130} height={130} rx={10} fill="none" stroke="#4f86c6" strokeWidth={6} />
    <rect x={-210} y={670} width={70} height={70} rx={6} fill="#cfe2f5" />
    <path d="M -100 705 L 10 705 M -10 690 L 10 705 L -10 720" fill="none" stroke="#e0706a" strokeWidth={6} strokeLinecap="round" />
    <path d="M 30 820 L 70 770 L 110 790 L 150 690" fill="none" stroke="#5aa86a" strokeWidth={6} strokeLinecap="round" />
    <rect x={-300} y={958} width={440} height={18} rx={6} fill={PALETTE.metal} stroke={INK} strokeWidth={5} />
    {/* Kệ hồ sơ bên phải */}
    <rect x={930} y={820} width={460} height={22} rx={4} fill={PALETTE.wood} stroke={INK} strokeWidth={6} />
    {[0, 1, 2, 3, 4].map((i) => (
      <rect
        key={`bk${i}`}
        x={960 + i * 52}
        y={700 - (i % 2) * 18}
        width={40}
        height={120 + (i % 2) * 18}
        rx={5}
        fill={["#6f9fd0", "#e8b35a", "#7fbf8a", "#d98a7c", "#9aa8c4"][i]}
        stroke={INK}
        strokeWidth={5}
      />
    ))}
    <rect x={1240} y={740} width={110} height={80} rx={8} fill={PALETTE.wood} stroke={INK} strokeWidth={5} />
    {/* Tranh con chip */}
    <rect x={1000} y={400} width={300} height={220} rx={10} fill="#eef5fa" stroke={INK} strokeWidth={6} />
    <rect x={1100} y={460} width={100} height={100} rx={10} fill="#7fbf8a" stroke={INK} strokeWidth={5} />
    <path d="M 1080 480 L 1100 480 M 1080 510 L 1100 510 M 1080 540 L 1100 540 M 1200 480 L 1220 480 M 1200 510 L 1220 510 M 1200 540 L 1220 540" stroke={INK} strokeWidth={5} />
    {/* Ánh sáng xanh dịu toả từ cửa sổ */}
    <ellipse cx={540} cy={740} rx={420} ry={460} fill="#e9f6ff" opacity={0.18 + 0.04 * wobble(frame, 3, 140)} />
  </g>
);

/** Bàn làm việc với máy tính CRT cũ, màn hình nhấp nháy dòng mã. */
function desk(key: string, x: number, flip: number, frame: number, seed: number): ReactNode {
  const glow = 0.85 + 0.12 * wobble(frame, seed, 50);
  const scroll = (frame * 0.6) % 24;
  return (
    <g key={key} transform={`translate(${x} 1380) scale(${flip} 1)`}>
      <ellipse cx={0} cy={210} rx={300} ry={26} fill="#000" opacity={0.15} />
      <rect x={-250} y={40} width={22} height={170} fill={PALETTE.woodDark} stroke={INK} strokeWidth={6} />
      <rect x={228} y={40} width={22} height={170} fill={PALETTE.woodDark} stroke={INK} strokeWidth={6} />
      <rect x={120} y={40} width={110} height={130} fill={PALETTE.wood} stroke={INK} strokeWidth={6} />
      <rect x={-280} y={10} width={560} height={36} rx={8} fill={PALETTE.wood} stroke={INK} strokeWidth={7} />
      <rect x={-270} y={14} width={540} height={8} rx={4} fill="#ffffff" opacity={0.3} />
      {/* CRT */}
      <path d="M -150 10 L -130 -40 L 30 -40 L 50 10 Z" fill={PALETTE.metalDark} stroke={INK} strokeWidth={6} />
      <rect x={-180} y={-230} width={250} height={200} rx={22} fill="#e8e2d0" stroke={INK} strokeWidth={7} />
      <rect x={-160} y={-212} width={210} height={150} rx={14} fill="url(#mk-gen-crt)" opacity={glow} stroke={INK} strokeWidth={5} />
      {[0, 1, 2, 3, 4].map((i) => {
        const y = -196 + ((i * 24 + scroll) % 120);
        return <rect key={`l${i}`} x={-144} y={y} width={60 + ((i * 37) % 90)} height={8} rx={4} fill="#a6f0b8" opacity={0.75} />;
      })}
      <circle cx={40} cy={-48} r={6} fill={PALETTE.ok} />
      {/* Bàn phím */}
      <rect x={-170} y={-10} width={200} height={22} rx={6} fill="#d8d2c0" stroke={INK} strokeWidth={5} />
      {/* Cốc cà phê */}
      <rect x={110} y={-50} width={50} height={60} rx={8} fill="#ffffff" stroke={INK} strokeWidth={5} />
      <path d="M 160 -38 Q 182 -30 160 -10" fill="none" stroke={INK} strokeWidth={5} />
      <path
        d={`M 135 -60 Q ${120 + 10 * wobble(frame, seed + 7, 40)} -90 135 -120`}
        fill="none"
        stroke="#ffffff"
        strokeWidth={6}
        strokeLinecap="round"
        opacity={0.6}
      />
    </g>
  );
}

/** Lớp giữa: sàn xám xanh, vệt nắng cửa sổ, hai bàn máy tính cũ ở hai bên dải đứng của nhân vật. */
const Component: FC<BackgroundProps> = ({ frame }) => (
  <g>
    <Defs />
    <rect x={X0} y={1490} width={WIDTH} height={1125} fill="url(#mk-gen-floor)" />
    <rect x={X0} y={1480} width={WIDTH} height={24} fill="#8fa3b4" stroke={INK} strokeWidth={6} />
    <path d="M -440 1760 L 1520 1760 M -440 2080 L 1520 2080 M 540 1504 L 540 2615 M 160 1504 L -200 2615 M 920 1504 L 1280 2615" stroke="#6f8496" strokeWidth={4} opacity={0.5} />
    <path
      d="M 330 1504 L 750 1504 L 900 2000 L 180 2000 Z"
      fill="url(#mk-gen-shaft)"
      opacity={0.7 + 0.2 * wobble(frame, 11, 160)}
    />
    {desk("d1", -100, 1, frame, 1)}
    {desk("d2", 1200, -1, frame, 5)}
  </g>
);

/** Tiền cảnh: góc bàn, ghế và chậu cây tối màu ở hai góc dưới, lá khẽ đung đưa. */
const Near: FC<BackgroundProps> = ({ frame }) => {
  const sway = 4 * wobble(frame, 21, 90);
  return (
    <g>
      <path d="M -440 1700 L 120 1700 L 120 1760 L -440 1760 Z" fill="#2c3a4a" />
      <rect x={60} y={1760} width={40} height={360} fill="#243140" />
      <path d="M -300 1820 Q -260 1660 -160 1680 Q -120 1760 -150 2100 L -300 2100 Z" fill="#33465a" />
      <rect x={1080} y={1960} width={170} height={150} rx={18} fill="#2c3a4a" />
      <g transform={`rotate(${sway.toFixed(2)} 1165 1960)`}>
        <path d="M 1165 1960 Q 1040 1800 1000 1680 Q 1110 1760 1165 1960 Z" fill="#2f5a40" />
        <path d="M 1165 1960 Q 1180 1780 1150 1660 Q 1230 1780 1165 1960 Z" fill="#3a6b4a" />
        <path d="M 1165 1960 Q 1300 1820 1380 1700 Q 1320 1860 1165 1960 Z" fill="#2f5a40" />
      </g>
      <path d="M 1400 2100 L 1400 1720 Q 1450 1690 1520 1700 L 1520 2100 Z" fill="#243140" />
    </g>
  );
};

/** Văn phòng công nghệ nhỏ thời đầu, bối cảnh ba lớp. */
export const asset: BackgroundAsset = {
  stage: GENERATED_WIDE_BACKGROUND_STAGE,
  Far,
  Component,
  Near,
};
