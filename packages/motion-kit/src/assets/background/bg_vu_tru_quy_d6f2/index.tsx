import type { FC, ReactNode } from "react";
import { PALETTE } from "../../../palette.js";
import { rnd } from "../../../rig/math.js";
import { GENERATED_WIDE_BACKGROUND_STAGE } from "../../../stage/generated-stage.js";
import type { BackgroundAsset, BackgroundProps } from "../../../stage/types.js";

const INK = PALETTE.ink;
/** Vùng vẽ: rộng hơn khung dọc 440 mỗi bên cho khung ngang 16:9. */
const X0 = -440;
const WIDTH = 1960;
const HEIGHT = 2615;
/** Trái Đất: một vòng tròn rất lớn, đỉnh cong chạm y=1500. */
const EX = 540;
const EY = 5300;
const ER = 3800;

const Defs: FC = () => (
  <defs>
    <linearGradient id="mk-gen-space" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#0a0f2c" />
      <stop offset="0.55" stopColor="#141c46" />
      <stop offset="1" stopColor="#24346a" />
    </linearGradient>
    <radialGradient id="mk-gen-sunglow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor="#fff4c4" stopOpacity="0.9" />
      <stop offset="0.35" stopColor="#ffe58a" stopOpacity="0.35" />
      <stop offset="1" stopColor="#ffe58a" stopOpacity="0" />
    </radialGradient>
    <radialGradient id="mk-gen-atmo" gradientUnits="userSpaceOnUse" cx={EX} cy={EY} r={ER + 220}>
      <stop offset="0.94" stopColor="#8fd8ff" stopOpacity="0.75" />
      <stop offset="0.97" stopColor="#6fb8f0" stopOpacity="0.3" />
      <stop offset="1" stopColor="#6fb8f0" stopOpacity="0" />
    </radialGradient>
    <radialGradient id="mk-gen-ocean" gradientUnits="userSpaceOnUse" cx={60} cy={1450} r={2600}>
      <stop offset="0" stopColor="#6cc4f2" />
      <stop offset="0.45" stopColor="#3a8fd6" />
      <stop offset="1" stopColor="#1f5fa8" />
    </radialGradient>
    <linearGradient id="mk-gen-rim" gradientUnits="userSpaceOnUse" x1={X0} y1="0" x2="1520" y2="0">
      <stop offset="0" stopColor="#fff7d6" stopOpacity="1" />
      <stop offset="0.45" stopColor="#c8ecff" stopOpacity="0.75" />
      <stop offset="1" stopColor="#a8dcff" stopOpacity="0.15" />
    </linearGradient>
    <linearGradient id="mk-gen-night" gradientUnits="userSpaceOnUse" x1="600" y1="0" x2="1520" y2="0">
      <stop offset="0" stopColor="#0a0f2c" stopOpacity="0" />
      <stop offset="1" stopColor="#0a0f2c" stopOpacity="0.38" />
    </linearGradient>
    <clipPath id="mk-gen-earth-clip">
      <circle cx={EX} cy={EY} r={ER} />
    </clipPath>
  </defs>
);

/** Ngôi sao bốn cánh lấp lánh, phồng xẹp nhẹ nhàng. */
function sparkle(key: string, x: number, y: number, s: number, frame: number, phase: number): ReactNode {
  const k = 0.75 + 0.25 * Math.sin(frame / 16 + phase);
  const r = s * k;
  return (
    <g key={key} transform={`translate(${x} ${y}) rotate(${(Math.sin(frame / 40 + phase) * 8).toFixed(2)})`}>
      <path
        d={`M 0 ${-r} Q 0 0 ${r} 0 Q 0 0 0 ${r} Q 0 0 ${-r} 0 Q 0 0 0 ${-r} Z`}
        fill="#fffbe6"
        opacity={0.6 + 0.4 * k}
      />
      <circle cx={0} cy={0} r={s * 0.18} fill="#ffffff" />
    </g>
  );
}

/** Lớp xa: bầu trời vũ trụ, sao lấp lánh, Mặt Trời sáng góc trái và Mặt Trăng nhỏ ở xa. */
const Far: FC<BackgroundProps> = ({ frame }) => {
  const stars: ReactNode[] = [];
  for (let i = 0; i < 46; i++) {
    const x = X0 + rnd(7, i) * WIDTH;
    const y = 30 + rnd(13, i) * 1580;
    const r = 2 + rnd(21, i) * 3.5;
    const tw = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(frame / (14 + rnd(3, i) * 18) + i * 1.3));
    stars.push(
      <circle key={`s${i}`} cx={x.toFixed(1)} cy={y.toFixed(1)} r={r.toFixed(1)} fill={i % 5 === 0 ? "#ffe9b0" : "#e8f2ff"} opacity={tw.toFixed(2)} />,
    );
  }
  const moonBob = Math.sin(frame / 90) * 6;
  return (
    <g>
      <Defs />
      <rect x={X0} y={0} width={WIDTH} height={HEIGHT} fill="url(#mk-gen-space)" />
      <ellipse cx={700} cy={700} rx={1300} ry={260} fill="#4a4f9a" opacity={0.12} transform="rotate(-18 700 700)" />
      {stars}
      {sparkle("k1", 860, 260, 26, frame, 0)}
      {sparkle("k2", 420, 620, 18, frame, 1.7)}
      {sparkle("k3", -260, 900, 22, frame, 3.1)}
      {sparkle("k4", 1330, 420, 24, frame, 4.4)}
      {sparkle("k5", 1010, 1050, 16, frame, 2.2)}
      <circle cx={120} cy={300} r={360} fill="url(#mk-gen-sunglow)" opacity={0.9 + 0.1 * Math.sin(frame / 30)} />
      <circle cx={120} cy={300} r={82} fill="#fff2b0" stroke={INK} strokeWidth={6} />
      <circle cx={96} cy={276} r={36} fill="#fffbe2" />
      <g transform={`translate(0 ${moonBob.toFixed(2)})`}>
        <circle cx={1180} cy={760} r={64} fill="#d7dae6" stroke={INK} strokeWidth={5} />
        <path d="M 1210 706 A 64 64 0 0 1 1210 814 A 52 60 0 0 0 1210 706 Z" fill="#a9aec4" />
        <circle cx={1160} cy={740} r={12} fill="#b9bdd0" />
        <circle cx={1192} cy={786} r={8} fill="#b9bdd0" />
        <circle cx={1160} cy={736} r={5} fill="#eef0f7" />
      </g>
    </g>
  );
};

/** Đám mây trên mặt đất, trôi chậm và lặp lại. */
function earthCloud(key: string, x: number, y: number, w: number, frame: number, speed: number): ReactNode {
  const cx = X0 + ((((x - X0 + frame * speed) % WIDTH) + WIDTH) % WIDTH);
  const flat = 0.22 + (y - 1500) / 2400;
  return (
    <g key={key} transform={`translate(${cx.toFixed(1)} ${y})`} opacity={0.85}>
      <ellipse cx={0} cy={0} rx={w} ry={w * flat} fill="#ffffff" />
      <ellipse cx={w * 0.45} cy={-w * flat * 0.4} rx={w * 0.55} ry={w * flat * 0.8} fill="#ffffff" />
      <ellipse cx={-w * 0.1} cy={w * flat * 0.45} rx={w * 0.8} ry={w * flat * 0.4} fill="#dcecff" />
    </g>
  );
}

/** Lớp giữa: Trái Đất cong lớn với lục địa, mây trôi, viền khí quyển sáng phía mặt trời. Phía trên để trống. */
const Earth: FC<BackgroundProps> = ({ frame }) => {
  const shimmer = 0.85 + 0.15 * Math.sin(frame / 24);
  return (
    <g>
      <Defs />
      <circle cx={EX} cy={EY} r={ER + 220} fill="url(#mk-gen-atmo)" opacity={shimmer.toFixed(3)} />
      <circle cx={EX} cy={EY} r={ER} fill="url(#mk-gen-ocean)" stroke={INK} strokeWidth={7} />
      <g clipPath="url(#mk-gen-earth-clip)">
        <path
          d="M -440 1600 Q -250 1560 -60 1610 Q 120 1650 160 1760 Q 120 1880 -40 1900 Q -200 1990 -440 1950 Z"
          fill="#7fbf6c"
          stroke={INK}
          strokeWidth={5}
        />
        <path d="M -380 1640 Q -220 1610 -80 1650 Q -160 1700 -360 1700 Z" fill="#a8d88a" opacity={0.7} />
        <path
          d="M 930 1620 Q 1120 1580 1330 1620 Q 1520 1640 1520 1700 L 1520 2080 Q 1360 2040 1240 1960 Q 1080 1900 980 1780 Q 900 1700 930 1620 Z"
          fill="#86b866"
          stroke={INK}
          strokeWidth={5}
        />
        <path d="M 1100 1700 Q 1220 1680 1300 1760 Q 1220 1820 1120 1780 Z" fill="#d9c98e" />
        <path
          d="M 260 2160 Q 420 2080 600 2120 Q 820 2170 840 2320 Q 800 2480 600 2520 Q 380 2560 280 2420 Q 200 2290 260 2160 Z"
          fill="#7fbf6c"
          stroke={INK}
          strokeWidth={5}
        />
        <path d="M 330 2200 Q 450 2150 580 2180 Q 480 2250 350 2260 Z" fill="#a8d88a" opacity={0.7} />
        <ellipse cx={-180} cy={2350} rx={160} ry={70} fill="#eef6ff" stroke={INK} strokeWidth={5} />
        {earthCloud("e1", 200, 1560, 150, frame, 0.25)}
        {earthCloud("e2", 820, 1640, 190, frame, 0.18)}
        {earthCloud("e3", -260, 1780, 160, frame, 0.3)}
        {earthCloud("e4", 1240, 1880, 200, frame, 0.22)}
        {earthCloud("e5", 520, 1980, 230, frame, 0.15)}
        {earthCloud("e6", 60, 2240, 210, frame, 0.2)}
        <rect x={X0} y={1400} width={WIDTH} height={1300} fill="url(#mk-gen-night)" />
      </g>
      <circle cx={EX} cy={EY} r={ER - 10} fill="none" stroke="url(#mk-gen-rim)" strokeWidth={16} opacity={shimmer.toFixed(3)} />
    </g>
  );
};

const ROCKS = [
  { x: -280, y: 1960, s: 1.25, c: "#1c2236", ph: 0 },
  { x: 60, y: 2060, s: 0.8, c: "#252c44", ph: 1.4 },
  { x: 1060, y: 2050, s: 0.85, c: "#252c44", ph: 2.6 },
  { x: 1340, y: 1950, s: 1.3, c: "#1c2236", ph: 3.9 },
];

/** Tiền cảnh: vài khối thiên thạch tối trôi lơ lửng, xoay rất chậm ở hai góc dưới. */
const Near: FC<BackgroundProps> = ({ frame }) => (
  <g>
    {ROCKS.map((r, i) => {
      const bob = Math.sin(frame / 50 + r.ph) * 10;
      const spin = Math.sin(frame / 120 + r.ph) * 6;
      return (
        <g key={`r${i}`} transform={`translate(${r.x} ${(r.y + bob).toFixed(2)}) rotate(${spin.toFixed(2)}) scale(${r.s})`}>
          <path
            d="M -150 30 Q -170 -80 -70 -140 Q 30 -190 120 -120 Q 190 -50 150 50 Q 100 140 -10 130 Q -120 120 -150 30 Z"
            fill={r.c}
          />
          <path d="M -110 -40 Q -80 -110 -10 -130 Q -60 -80 -80 -20 Z" fill="#3a4466" opacity={0.8} />
          <ellipse cx={50} cy={20} rx={34} ry={24} fill="#141a2b" />
        </g>
      );
    })}
  </g>
);

/** Vũ trụ quỹ đạo: bầu trời sao, Trái Đất cong phía dưới, thiên thạch tiền cảnh. */
export const asset: BackgroundAsset = {
  stage: GENERATED_WIDE_BACKGROUND_STAGE,
  Far,
  Component: Earth,
  Near,
};
