import type { FC, ReactNode } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, clamp, rnd, wobble } from "../../../rig/math.js";
import { GENERATED_WIDE_BACKGROUND_STAGE } from "../../../stage/generated-stage.js";
import type { BackgroundAsset, BackgroundProps } from "../../../stage/types.js";

const INK = PALETTE.ink;
/** Vùng vẽ: rộng hơn khung dọc 440 mỗi bên cho khung ngang 16:9. */
const X0 = -440;
const WIDTH = 1960;
const HEIGHT = 2615;

const Defs: FC = () => (
  <defs>
    <linearGradient id="mk-gen-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#0d1b3d" />
      <stop offset="0.35" stopColor="#1b305e" />
      <stop offset="0.5" stopColor="#3a5687" />
      <stop offset="1" stopColor="#3a5687" />
    </linearGradient>
    <radialGradient id="mk-gen-moonglow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor="#fdf6d8" stopOpacity="0.55" />
      <stop offset="1" stopColor="#fdf6d8" stopOpacity="0" />
    </radialGradient>
    <linearGradient id="mk-gen-farsea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#4a6797" />
      <stop offset="1" stopColor="#25406f" />
    </linearGradient>
    <linearGradient id="mk-gen-sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#2a4777" />
      <stop offset="1" stopColor="#12264c" />
    </linearGradient>
    <linearGradient id="mk-gen-deck" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#6c7a90" />
      <stop offset="1" stopColor="#8a97aa" />
    </linearGradient>
    <radialGradient id="mk-gen-redglow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor="#ff5a5a" stopOpacity="0.8" />
      <stop offset="1" stopColor="#ff5a5a" stopOpacity="0" />
    </radialGradient>
  </defs>
);

/** Lớp xa: trời đêm, trăng, sao lấp lánh, biển xa với vệt trăng và một con tàu nhỏ ở chân trời. */
const Far: FC<BackgroundProps> = ({ frame }) => {
  const stars: ReactNode[] = [];
  for (let i = 0; i < 30; i++) {
    const x = X0 + rnd(7, i) * WIDTH;
    const y = 40 + rnd(11, i) * 1150;
    const r = 3 + rnd(13, i) * 5;
    const tw = 0.5 + 0.5 * Math.sin(frame / 14 + i * 1.7);
    stars.push(
      <circle key={`s${i}`} cx={x.toFixed(1)} cy={y.toFixed(1)} r={(r * (0.8 + tw * 0.3)).toFixed(2)} fill="#fff8dc" opacity={(0.35 + tw * 0.65).toFixed(2)} />,
    );
  }
  const streaks: ReactNode[] = [];
  for (let i = 0; i < 6; i++) {
    const w = 70 - i * 6 + wobble(frame, 30 + i, 50) * 22;
    const sx = 230 + wobble(frame, 50 + i, 70) * 14;
    streaks.push(
      <ellipse key={`m${i}`} cx={sx.toFixed(1)} cy={1330 + i * 32} rx={w.toFixed(1)} ry={5} fill="#fdf1c4" opacity={0.55 - i * 0.06} />,
    );
  }
  const shipLight = 0.5 + 0.5 * Math.sin(frame / 20);
  return (
    <g>
      <Defs />
      <rect x={X0} y={0} width={WIDTH} height={HEIGHT} fill="url(#mk-gen-sky)" />
      {stars}
      <circle cx={230} cy={360} r={260} fill="url(#mk-gen-moonglow)" />
      <circle cx={230} cy={360} r={92} fill="#fdf3cf" />
      <circle cx={265} cy={390} r={92} fill="#efe0b0" opacity={0.5} />
      <circle cx={200} cy={330} r={18} fill="#e4d3a0" />
      <circle cx={260} cy={400} r={12} fill="#e4d3a0" />
      <rect x={X0} y={1300} width={WIDTH} height={HEIGHT - 1300} fill="url(#mk-gen-farsea)" />
      <rect x={X0} y={1298} width={WIDTH} height={6} fill="#7d98c4" opacity={0.6} />
      {streaks}
      <g transform="translate(1260 1300)">
        <path d="M -70 0 L -56 -22 L 60 -22 L 74 0 Z" fill="#2c3e60" />
        <rect x={-20} y={-46} width={44} height={24} fill="#2c3e60" />
        <circle cx={2} cy={-52} r={5} fill="#ffd166" opacity={(0.4 + shipLight * 0.6).toFixed(2)} />
      </g>
    </g>
  );
};

/** Nhịp nhấp nháy của đèn đỏ: bật nhanh, tắt dần. */
function blink(frame: number, offset: number): number {
  const p = ((frame + offset) % 48) / 48;
  if (p < 0.2) return easing.out(p / 0.2);
  return 1 - easing.inOut(clamp((p - 0.2) / 0.5, 0, 1));
}

function redLight(key: string, x: number, y: number, s: number, frame: number, offset: number): ReactNode {
  const b = blink(frame, offset);
  return (
    <g key={key} transform={`translate(${x} ${y}) scale(${s})`}>
      <circle cx={0} cy={-46} r={70} fill="url(#mk-gen-redglow)" opacity={b.toFixed(2)} />
      <rect x={-12} y={-36} width={24} height={36} rx={4} fill={PALETTE.metalDark} stroke={INK} strokeWidth={5} />
      <circle cx={0} cy={-44} r={16} fill={b > 0.4 ? "#ff4b4b" : "#8a2a2a"} stroke={INK} strokeWidth={5} />
      <circle cx={-5} cy={-49} r={5} fill="#ffd0d0" opacity={(0.3 + b * 0.7).toFixed(2)} />
    </g>
  );
}

/** Lớp giữa: mặt biển gợn sóng và sà lan phẳng có vòng tròn đích, đèn đỏ ở bốn góc. */
const Barge: FC<BackgroundProps> = ({ frame }) => {
  const ripples: ReactNode[] = [];
  for (let i = 0; i < 18; i++) {
    const baseX = X0 + rnd(21, i) * WIDTH;
    const y = 1490 + rnd(23, i) * 1100;
    const x = baseX + wobble(frame, 40 + i, 90) * 30;
    const w = 30 + (y - 1490) / 18;
    ripples.push(
      <path
        key={`r${i}`}
        d={`M ${(x - w).toFixed(1)} ${y.toFixed(1)} Q ${x.toFixed(1)} ${(y - 10).toFixed(1)} ${(x + w).toFixed(1)} ${y.toFixed(1)}`}
        fill="none"
        stroke="#7f9cc9"
        strokeWidth={5}
        strokeLinecap="round"
        opacity={(0.35 + 0.3 * (0.5 + 0.5 * Math.sin(frame / 16 + i))).toFixed(2)}
      />,
    );
  }
  const foam = wobble(frame, 9, 60) * 10;
  return (
    <g>
      <Defs />
      <path
        d={`M ${X0} 1470 Q 0 1455 540 1468 Q 1080 1480 1520 1462 L 1520 ${HEIGHT} L ${X0} ${HEIGHT} Z`}
        fill="url(#mk-gen-sea)"
      />
      {ripples}
      <path d="M -390 2080 L 1470 2080 L 1420 2230 L -340 2230 Z" fill={PALETTE.metalDark} stroke={INK} strokeWidth={7} />
      <path d="M -380 2095 L 1460 2095 L 1452 2122 L -372 2122 Z" fill="#ffd166" opacity={0.85} />
      <path d="M -150 1480 L 1230 1480 L 1460 2080 L -380 2080 Z" fill="url(#mk-gen-deck)" stroke={INK} strokeWidth={7} />
      <path d="M -150 1480 L 1230 1480 L 1238 1500 L -158 1500 Z" fill="#a8b4c6" opacity={0.7} />
      <path d="M 300 1480 L 210 2080 M 780 1480 L 870 2080 M -80 1680 L 1300 1680" stroke="#5a677c" strokeWidth={4} opacity={0.5} fill="none" />
      <ellipse cx={540} cy={1830} rx={400} ry={170} fill="#5d6a80" opacity={0.35} />
      <ellipse cx={540} cy={1830} rx={400} ry={170} fill="none" stroke="#f2f4f7" strokeWidth={22} opacity={0.9} />
      <ellipse cx={540} cy={1830} rx={230} ry={96} fill="none" stroke="#ffd166" strokeWidth={18} opacity={0.9} />
      <path d="M 450 1792 L 630 1868 M 630 1792 L 450 1868" stroke="#f2f4f7" strokeWidth={20} strokeLinecap="round" opacity={0.9} />
      <path
        d={`M -360 2236 Q -100 ${(2256 + foam).toFixed(1)} 540 2240 Q 1180 ${(2256 - foam).toFixed(1)} 1430 2236`}
        fill="none"
        stroke="#c9dbf2"
        strokeWidth={8}
        strokeLinecap="round"
        opacity={0.6}
      />
      {redLight("l1", -130, 1482, 0.8, frame, 0)}
      {redLight("l2", 1210, 1482, 0.8, frame, 24)}
      {redLight("l3", -340, 2080, 1.1, frame, 12)}
      {redLight("l4", 1420, 2080, 1.1, frame, 36)}
    </g>
  );
};

/** Tiền cảnh: những ngọn sóng tối lớn ở hai góc dưới, nhấp nhô chậm. */
const Near: FC<BackgroundProps> = ({ frame }) => {
  const a = easing.inOut(0.5 + 0.5 * Math.sin(frame / 30)) * 24;
  const b = easing.inOut(0.5 + 0.5 * Math.sin(frame / 34 + 2)) * 24;
  return (
    <g>
      <path d={`M -440 2100 Q -380 ${(1700 + a).toFixed(1)} -220 ${(1690 + a).toFixed(1)} Q -120 1700 -60 1800 Q -140 1760 -170 1840 Q 0 1860 150 2100 Z`} fill="#0a1630" />
      <path d={`M -420 2140 Q -260 ${(1820 - a).toFixed(1)} -40 ${(1880 - a).toFixed(1)} Q 60 1950 120 2140 Z`} fill="#13244a" />
      <path d={`M 1520 2100 Q 1460 ${(1710 + b).toFixed(1)} 1300 ${(1700 + b).toFixed(1)} Q 1200 1710 1140 1810 Q 1220 1770 1250 1850 Q 1080 1870 930 2100 Z`} fill="#0a1630" />
      <path d={`M 1500 2140 Q 1340 ${(1830 - b).toFixed(1)} 1120 ${(1890 - b).toFixed(1)} Q 1010 1960 960 2140 Z`} fill="#13244a" />
      <ellipse cx={-210} cy={(1700 + a).toFixed(1)} rx={60} ry={10} fill="#2a3f6a" opacity={0.7} />
    </g>
  );
};

/** Sà lan hạ cánh tên lửa giữa biển đêm, bối cảnh ba lớp: xa, giữa, tiền cảnh. */
export const asset: BackgroundAsset = {
  stage: GENERATED_WIDE_BACKGROUND_STAGE,
  Far,
  Component: Barge,
  Near,
};
