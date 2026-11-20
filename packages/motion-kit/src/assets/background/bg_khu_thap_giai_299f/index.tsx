import type { FC, ReactNode } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble, clamp } from "../../../rig/math.js";
import { GENERATED_WIDE_BACKGROUND_STAGE } from "../../../stage/generated-stage.js";
import type { BackgroundAsset, BackgroundProps } from "../../../stage/types.js";

const INK = PALETTE.ink;
/** Vùng vẽ: rộng hơn khung dọc 440 mỗi bên cho khung ngang 16:9. */
const X0 = -440;
const WIDTH = 1960;
const H = 2615;

const Defs: FC = () => (
  <defs>
    <linearGradient id="mk-gen-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#6fb8ec" />
      <stop offset="0.5" stopColor="#bfe4fb" />
      <stop offset="1" stopColor="#eef8f2" />
    </linearGradient>
    <radialGradient id="mk-gen-sun" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor="#fff6c9" stopOpacity="0.95" />
      <stop offset="1" stopColor="#fff6c9" stopOpacity="0" />
    </radialGradient>
    <linearGradient id="mk-gen-ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#b5d697" />
      <stop offset="1" stopColor="#7fae68" />
    </linearGradient>
    <linearGradient id="mk-gen-pad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#e2ded3" />
      <stop offset="1" stopColor="#c4bfb2" />
    </linearGradient>
    <linearGradient id="mk-gen-tower" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stopColor="#e8ecef" />
      <stop offset="0.45" stopColor="#c3cad0" />
      <stop offset="1" stopColor="#8d979f" />
    </linearGradient>
    <linearGradient id="mk-gen-pipe" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#a9d3ee" />
      <stop offset="0.5" stopColor="#6fa9d1" />
      <stop offset="1" stopColor="#4d84ad" />
    </linearGradient>
  </defs>
);

/** Đám mây ba múi trôi chậm, lặp trong vùng vẽ. */
function cloud(key: string, x: number, y: number, size: number, frame: number, speed: number) {
  const cx = X0 + ((x - X0 + frame * speed) % WIDTH);
  return (
    <g key={key} transform={`translate(${cx.toFixed(1)} ${y}) scale(${size})`} opacity={0.9}>
      <ellipse cx={0} cy={0} rx={120} ry={44} fill="#ffffff" />
      <ellipse cx={-58} cy={-26} rx={60} ry={42} fill="#ffffff" />
      <ellipse cx={32} cy={-40} rx={72} ry={50} fill="#ffffff" />
      <ellipse cx={10} cy={14} rx={108} ry={24} fill="#dcefff" />
    </g>
  );
}

/** Hơi nước: các cụm bông trắng bay lên, phồng to, lệch theo gió rồi tan. */
function steam(key: string, seed: number, frame: number, scale: number, topY: number) {
  const puffs: ReactNode[] = [];
  for (let i = 0; i < 5; i++) {
    const p = (frame / 110 + i / 5) % 1;
    const e = easing.out(p);
    const y = topY - e * 430;
    const x = wobble(frame + i * 23, seed + i, 90) * 26 * e + e * 70;
    const r = 70 + e * 95;
    const op = 0.9 * (1 - p) * clamp(p * 6, 0, 1);
    puffs.push(
      <g key={`${key}-${i}`} opacity={op.toFixed(3)}>
        <ellipse cx={x.toFixed(1)} cy={y.toFixed(1)} rx={(r * 1.1).toFixed(1)} ry={(r * 0.8).toFixed(1)} fill="#ffffff" />
        <ellipse cx={(x + r * 0.25).toFixed(1)} cy={(y + r * 0.3).toFixed(1)} rx={(r * 0.8).toFixed(1)} ry={(r * 0.35).toFixed(1)} fill="#e3eef5" />
      </g>,
    );
  }
  return <g key={key} transform={`scale(${scale})`}>{puffs}</g>;
}

/** Tháp giải nhiệt dáng eo thon, sáng bên trái, tối bên phải, hơi nước bốc lên. */
function tower(key: string, cx: number, base: number, s: number, frame: number, line: string, sw: number) {
  return (
    <g key={key} transform={`translate(${cx} ${base}) scale(${s})`}>
      <ellipse cx={0} cy={4} rx={200} ry={22} fill="#000" opacity={0.15} />
      <path
        d="M -170 0 Q -92 -360 -120 -620 L 120 -620 Q 92 -360 170 0 Z"
        fill="url(#mk-gen-tower)"
        stroke={line}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
      <path d="M -128 -40 Q -78 -340 -98 -590" fill="none" stroke="#ffffff" strokeWidth={14} strokeLinecap="round" opacity={0.5} />
      <path d="M -150 -70 Q 0 -50 150 -70" fill="none" stroke={line} strokeWidth={4} opacity={0.35} />
      <path d="M -112 -560 Q 0 -540 112 -560" fill="none" stroke={line} strokeWidth={4} opacity={0.35} />
      <rect x={-172} y={-34} width={344} height={34} fill="#7d868d" stroke={line} strokeWidth={sw * 0.8} />
      <ellipse cx={0} cy={-620} rx={120} ry={22} fill="#6f787f" stroke={line} strokeWidth={sw} />
      <ellipse cx={0} cy={-616} rx={96} ry={13} fill="#4c545a" />
      {steam(`${key}-st`, cx, frame, 1, -650)}
    </g>
  );
}

/** Lớp xa: trời, mặt trời, mây, đồi nhạt, tòa nhà trung tâm dữ liệu và tháp xa mờ. */
const Far: FC<BackgroundProps> = ({ frame }) => {
  const leds: ReactNode[] = [];
  for (let i = 0; i < 14; i++) {
    const on = Math.sin(frame / 9 + i * 1.9) > 0.1;
    leds.push(
      <rect
        key={`led${i}`}
        x={300 + i * 38}
        y={1300 + (i % 2) * 60}
        width={20}
        height={10}
        rx={3}
        fill={on ? (i % 3 === 0 ? PALETTE.ok : "#8fd3ff") : "#9fb0bf"}
      />,
    );
  }
  return (
    <g>
      <Defs />
      <rect x={X0} y={0} width={WIDTH} height={H} fill="url(#mk-gen-sky)" />
      <circle cx={140} cy={300} r={300} fill="url(#mk-gen-sun)" />
      <circle cx={140} cy={300} r={70} fill="#fff1a8" />
      {cloud("c1", 700, 380, 1, frame, 0.3)}
      {cloud("c2", -150, 600, 0.7, frame, 0.2)}
      {cloud("c3", 1250, 720, 0.85, frame, 0.25)}
      <path
        d={`M ${X0} 1330 Q -120 1180 220 1290 Q 520 1150 820 1280 Q 1120 1170 1380 1270 Q 1460 1250 1520 1270 L 1520 ${H} L ${X0} ${H} Z`}
        fill="#d3e6d8"
      />
      <g opacity={0.75}>{tower("ft1", -240, 1440, 0.5, frame, "#8a98a4", 5)}</g>
      <g opacity={0.75}>{tower("ft2", 1280, 1440, 0.55, frame, "#8a98a4", 5)}</g>
      <rect x={270} y={1220} width={560} height={260} rx={8} fill="#cfd8e0" stroke="#7d8a96" strokeWidth={5} />
      <rect x={270} y={1220} width={560} height={30} fill="#b3c0cb" stroke="#7d8a96" strokeWidth={5} />
      <rect x={330} y={1180} width={90} height={40} rx={4} fill="#bcc7d0" stroke="#7d8a96" strokeWidth={4} />
      <rect x={660} y={1180} width={110} height={40} rx={4} fill="#bcc7d0" stroke="#7d8a96" strokeWidth={4} />
      <rect x={290} y={1285} width={520} height={90} rx={6} fill="#a9bccb" opacity={0.6} />
      {leds}
      <path
        d={`M ${X0} 1450 Q 0 1400 540 1440 Q 1080 1400 1520 1450 L 1520 ${H} L ${X0} ${H} Z`}
        fill="#bcdcb0"
      />
    </g>
  );
};

/** Lớp giữa: bãi đất, sân bê tông, tháp giải nhiệt lớn và ống nước có dòng nước lấp lánh. */
const Yard: FC<BackgroundProps> = ({ frame }) => {
  const flow = (-frame * 4).toFixed(1);
  const posts: ReactNode[] = [];
  for (let x = -400; x <= 1500; x += 220) {
    posts.push(
      <g key={`p${x}`}>
        <rect x={x - 10} y={1478} width={20} height={34} fill={PALETTE.metalDark} stroke={INK} strokeWidth={4} />
        <rect x={x + 100} y={1440} width={18} height={60} rx={4} fill="#5f93ba" stroke={INK} strokeWidth={4} />
      </g>,
    );
  }
  const bushSway = wobble(frame, 7, 70) * 3;
  return (
    <g>
      <Defs />
      <path
        d={`M ${X0} 1505 Q 60 1485 540 1500 Q 1020 1485 1520 1505 L 1520 ${H} L ${X0} ${H} Z`}
        fill="url(#mk-gen-ground)"
        stroke={INK}
        strokeWidth={6}
      />
      <path
        d="M 180 1530 L 900 1530 Q 1050 2000 1120 2615 L -40 2615 Q 30 2000 180 1530 Z"
        fill="url(#mk-gen-pad)"
        opacity={0.9}
      />
      <path d="M 540 1560 L 540 2615" stroke="#b3ad9f" strokeWidth={6} strokeDasharray="60 50" opacity={0.6} />
      {tower("t1", -330, 1515, 0.85, frame, INK, 6)}
      {tower("t2", 1370, 1515, 0.85, frame, INK, 6)}
      {tower("t3", 70, 1515, 1, frame, INK, 6)}
      {tower("t4", 1010, 1515, 1.05, frame, INK, 6)}
      <path d="M 250 1470 L 250 1180 Q 250 1150 220 1150 L 160 1150" fill="none" stroke={INK} strokeWidth={42} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M 250 1470 L 250 1180 Q 250 1150 220 1150 L 160 1150" fill="none" stroke="#6fa9d1" strokeWidth={30} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M 830 1470 L 830 1200 Q 830 1170 860 1170 L 920 1170" fill="none" stroke={INK} strokeWidth={42} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M 830 1470 L 830 1200 Q 830 1170 860 1170 L 920 1170" fill="none" stroke="#6fa9d1" strokeWidth={30} strokeLinecap="round" strokeLinejoin="round" />
      {posts}
      <rect x={X0} y={1452} width={WIDTH} height={36} fill="url(#mk-gen-pipe)" stroke={INK} strokeWidth={6} />
      <line x1={X0} y1={1462} x2={1520} y2={1462} stroke="#ffffff" strokeWidth={5} strokeDasharray="40 90" strokeDashoffset={flow} strokeLinecap="round" opacity={0.75} />
      <g transform={`rotate(${bushSway.toFixed(2)} -150 1540)`}>
        <ellipse cx={-150} cy={1540} rx={120} ry={58} fill="#5fae52" stroke={INK} strokeWidth={6} />
        <ellipse cx={-180} cy={1522} rx={50} ry={22} fill="#8fd16a" opacity={0.7} />
      </g>
      <g transform={`rotate(${(-bushSway).toFixed(2)} 1240 1545)`}>
        <ellipse cx={1240} cy={1545} rx={130} ry={60} fill="#4f9a45" stroke={INK} strokeWidth={6} />
        <ellipse cx={1205} cy={1525} rx={55} ry={22} fill="#8fd16a" opacity={0.6} />
      </g>
    </g>
  );
};

const CLUMPS = [
  { x: -280, lean: 1 },
  { x: 60, lean: 1 },
  { x: 1030, lean: -1 },
  { x: 1340, lean: -1 },
];

/** Tiền cảnh: hòn đá và bụi cỏ tối ở hai góc dưới, khẽ đung đưa. */
const Near: FC<BackgroundProps> = ({ frame }) => {
  const blades: ReactNode[] = [];
  for (const c of CLUMPS) {
    for (let i = 0; i < 5; i++) {
      const bx = c.x + (i - 2) * 44;
      const tip = 300 + ((i * 53) % 120);
      const bend = Math.sin(frame / 24 + c.x / 300 + i * 0.8) * 14 + c.lean * 38 + (i - 2) * 20;
      blades.push(
        <path
          key={`b${c.x}-${i}`}
          d={`M ${bx - 24} 2100 Q ${bx} ${(2100 - tip * 0.6).toFixed(1)} ${(bx + bend).toFixed(1)} ${2100 - tip} Q ${bx + 14} ${(2100 - tip * 0.5).toFixed(1)} ${bx + 24} 2100 Z`}
          fill={i % 2 === 0 ? "#2f6b3a" : "#3b7d42"}
        />,
      );
    }
  }
  return (
    <g>
      <path d="M -420 2120 Q -400 1900 -250 1880 Q -120 1870 -90 2000 L -70 2120 Z" fill="#4a5258" />
      <path d="M 1180 2120 Q 1200 1940 1310 1920 Q 1440 1910 1470 2120 Z" fill="#3f474d" />
      {blades}
    </g>
  );
};

/** Khu tháp giải nhiệt ngoài trời cạnh trung tâm dữ liệu, ba lớp: xa, giữa, tiền cảnh. */
export const asset: BackgroundAsset = {
  stage: GENERATED_WIDE_BACKGROUND_STAGE,
  Far,
  Component: Yard,
  Near,
};
