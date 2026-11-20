import type { FC, ReactNode } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, clamp, wobble } from "../../../rig/math.js";
import { GENERATED_WIDE_BACKGROUND_STAGE } from "../../../stage/generated-stage.js";
import type { BackgroundAsset, BackgroundProps } from "../../../stage/types.js";

const INK = PALETTE.ink;
/** Vùng vẽ: rộng hơn khung dọc 440 mỗi bên cho khung ngang 16:9. */
const X0 = -440;
const WIDTH = 1960;
const HEIGHT = 2615;

const FarDefs: FC = () => (
  <defs>
    <linearGradient id="mk-gen-wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#7f8cc0" />
      <stop offset="0.6" stopColor="#a3abd6" />
      <stop offset="1" stopColor="#b9bce0" />
    </linearGradient>
    <linearGradient id="mk-gen-night" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#1f2c5e" />
      <stop offset="1" stopColor="#4a5c9a" />
    </linearGradient>
    <radialGradient id="mk-gen-moonglow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor="#fff6cf" stopOpacity="0.7" />
      <stop offset="1" stopColor="#fff6cf" stopOpacity="0" />
    </radialGradient>
    <clipPath id="mk-gen-win">
      <rect x={380} y={540} width={320} height={520} rx={18} />
    </clipPath>
  </defs>
);

const STARS = [
  { x: 420, y: 600, r: 6 },
  { x: 470, y: 760, r: 5 },
  { x: 540, y: 620, r: 7 },
  { x: 660, y: 820, r: 5 },
  { x: 430, y: 930, r: 6 },
  { x: 590, y: 980, r: 5 },
  { x: 680, y: 580, r: 4 },
];

/** Một bức rèm treo, mép dưới khẽ lay theo gió. */
function curtain(key: string, x: number, dir: number, frame: number): ReactNode {
  const sway = wobble(frame, dir > 0 ? 3 : 7, 90) * 14;
  const hem = x + dir * (110 + sway);
  return (
    <g key={key}>
      <path
        d={`M ${x} 500 L ${x + dir * 130} 500 Q ${x + dir * 95} 800 ${hem.toFixed(1)} 1110 L ${x - dir * 10} 1110 Z`}
        fill="#e8a3a8"
        stroke={INK}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <path
        d={`M ${x + dir * 45} 510 Q ${x + dir * 40} 800 ${(x + dir * 40 + sway * 0.4).toFixed(1)} 1100`}
        fill="none"
        stroke="#c97e86"
        strokeWidth={6}
        strokeLinecap="round"
      />
      <path
        d={`M ${x + dir * 14} 510 L ${x + dir * 14} 1100`}
        fill="none"
        stroke="#f6c8cb"
        strokeWidth={8}
        strokeLinecap="round"
        opacity={dir < 0 ? 0.8 : 0.4}
      />
    </g>
  );
}

/** Lớp xa: tường phòng ngủ, cửa sổ có trăng và sao, rèm, kệ sách và tranh treo. */
const Far: FC<BackgroundProps> = ({ frame }) => {
  const cloudX = 300 + ((frame * 0.4) % 520);
  return (
    <g>
      <FarDefs />
      <rect x={X0} y={0} width={WIDTH} height={HEIGHT} fill="url(#mk-gen-wall)" />
      <rect x={X0} y={1230} width={WIDTH} height={330} fill="#c4c4e2" opacity={0.75} />
      <rect x={X0} y={1222} width={WIDTH} height={16} fill="#e1dff2" stroke={INK} strokeWidth={5} />
      <rect x={X0} y={1500} width={WIDTH} height={70} fill="#ece8f6" stroke={INK} strokeWidth={5} />
      <rect x={X0} y={HEIGHT - 1000} width={WIDTH} height={1000} fill="#b9bce0" />

      {/* Cửa sổ */}
      <rect x={364} y={524} width={352} height={552} rx={24} fill={PALETTE.wood} stroke={INK} strokeWidth={7} />
      <rect x={380} y={540} width={320} height={520} rx={18} fill="url(#mk-gen-night)" />
      <g clipPath="url(#mk-gen-win)">
        <circle cx={600} cy={680} r={170} fill="url(#mk-gen-moonglow)" />
        <circle cx={600} cy={680} r={64} fill="#fff4c4" />
        <circle cx={582} cy={662} r={14} fill="#f1e3a6" />
        <circle cx={622} cy={706} r={10} fill="#f1e3a6" />
        <path d="M 556 650 Q 566 626 590 620" fill="none" stroke="#ffffff" strokeWidth={7} strokeLinecap="round" opacity={0.8} />
        {STARS.map((s, i) => {
          const tw = 0.55 + 0.45 * Math.sin(frame / 14 + i * 1.9);
          return <circle key={`s${i}`} cx={s.x} cy={s.y} r={s.r} fill="#fff9de" opacity={tw.toFixed(2)} />;
        })}
        <g transform={`translate(${cloudX.toFixed(1)} 900)`} opacity={0.5}>
          <ellipse cx={0} cy={0} rx={80} ry={22} fill="#8d9bd0" />
          <ellipse cx={-20} cy={-16} rx={40} ry={24} fill="#8d9bd0" />
        </g>
        <path d="M 380 960 Q 470 900 560 950 Q 640 910 700 940 L 700 1060 L 380 1060 Z" fill="#33437a" />
      </g>
      <line x1={540} y1={540} x2={540} y2={1060} stroke={PALETTE.wood} strokeWidth={14} />
      <line x1={540} y1={540} x2={540} y2={1060} stroke={INK} strokeWidth={3} opacity={0.4} />
      <line x1={380} y1={800} x2={700} y2={800} stroke={PALETTE.wood} strokeWidth={14} />
      <rect x={340} y={1066} width={400} height={30} rx={10} fill={PALETTE.woodDark} stroke={INK} strokeWidth={6} />
      <rect x={300} y={488} width={480} height={18} rx={9} fill={PALETTE.metalDark} stroke={INK} strokeWidth={5} />
      {curtain("cl", 320, 1, frame)}
      {curtain("cr", 760, -1, frame)}

      {/* Kệ sách bên trái */}
      <rect x={-360} y={900} width={300} height={22} rx={6} fill={PALETTE.wood} stroke={INK} strokeWidth={6} />
      <rect x={-330} y={790} width={38} height={110} rx={6} fill="#8fb7d8" stroke={INK} strokeWidth={5} />
      <rect x={-288} y={810} width={34} height={90} rx={6} fill="#e8c46f" stroke={INK} strokeWidth={5} />
      <rect x={-250} y={800} width={40} height={100} rx={6} fill="#a6c98d" stroke={INK} strokeWidth={5} transform="rotate(8 -230 900)" />
      <path d="M -150 900 L -140 846 L -100 846 L -90 900 Z" fill="#d98f6f" stroke={INK} strokeWidth={5} />
      <ellipse cx={-120} cy={820} rx={34} ry={28} fill={PALETTE.leaf} stroke={INK} strokeWidth={5} />

      {/* Tranh treo bên phải */}
      <rect x={1110} y={700} width={240} height={180} rx={12} fill={PALETTE.wood} stroke={INK} strokeWidth={6} />
      <rect x={1128} y={718} width={204} height={144} rx={6} fill="#cfe3f2" />
      <path d="M 1128 862 L 1128 820 Q 1180 770 1230 815 Q 1280 780 1332 820 L 1332 862 Z" fill="#9fcf95" />
      <circle cx={1290} cy={752} r={16} fill="#ffe08a" />
      <circle cx={-200} cy={420} r={34} fill="#d6d9f0" opacity={0.6} />
    </g>
  );
};

const MidDefs: FC = () => (
  <defs>
    <linearGradient id="mk-gen-floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#c9a07a" />
      <stop offset="1" stopColor="#9a6f4f" />
    </linearGradient>
    <radialGradient id="mk-gen-lampglow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor="#ffe6a0" stopOpacity="0.75" />
      <stop offset="0.55" stopColor="#ffd77a" stopOpacity="0.25" />
      <stop offset="1" stopColor="#ffd77a" stopOpacity="0" />
    </radialGradient>
    <linearGradient id="mk-gen-blanket" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#9cc8ee" />
      <stop offset="1" stopColor="#6b9fd1" />
    </linearGradient>
  </defs>
);

/** Đồng hồ báo thức: kim giây nhích từng nhịp có nảy nhẹ. */
function alarmClock(frame: number): ReactNode {
  const sec = Math.floor(frame / 30);
  const frac = clamp((frame % 30) / 6, 0, 1);
  const secAngle = (sec + easing.outBack(1.8)(frac)) * 6;
  const minAngle = 60 + frame * 0.1;
  return (
    <g transform="translate(196 1258)">
      <line x1={-26} y1={30} x2={-36} y2={52} stroke={INK} strokeWidth={7} strokeLinecap="round" />
      <line x1={26} y1={30} x2={36} y2={52} stroke={INK} strokeWidth={7} strokeLinecap="round" />
      <circle cx={-30} cy={-38} r={16} fill={PALETTE.metal} stroke={INK} strokeWidth={5} />
      <circle cx={30} cy={-38} r={16} fill={PALETTE.metal} stroke={INK} strokeWidth={5} />
      <circle cx={0} cy={0} r={46} fill="#e9786a" stroke={INK} strokeWidth={6} />
      <circle cx={0} cy={0} r={33} fill="#fffaf0" stroke={INK} strokeWidth={4} />
      <circle cx={0} cy={-26} r={3} fill={INK} />
      <circle cx={26} cy={0} r={3} fill={INK} />
      <circle cx={0} cy={26} r={3} fill={INK} />
      <circle cx={-26} cy={0} r={3} fill={INK} />
      <line x1={0} y1={0} x2={-12} y2={-12} stroke={INK} strokeWidth={5} strokeLinecap="round" />
      <line x1={0} y1={0} x2={0} y2={-24} stroke={INK} strokeWidth={4} strokeLinecap="round" transform={`rotate(${minAngle.toFixed(2)})`} />
      <line x1={0} y1={4} x2={0} y2={-27} stroke="#d94b3f" strokeWidth={2.5} strokeLinecap="round" transform={`rotate(${secAngle.toFixed(2)})`} />
      <circle cx={0} cy={0} r={4} fill={INK} />
      <path d="M -34 -14 Q -30 -30 -16 -36" fill="none" stroke="#ffffff" strokeWidth={5} strokeLinecap="round" opacity={0.7} />
    </g>
  );
}

/** Lớp giữa: sàn gỗ, thảm, tủ đầu giường với đèn ngủ và đồng hồ, giường bên phải, hộp đồ chơi bên trái. */
const Component: FC<BackgroundProps> = ({ frame }) => {
  const flicker = 0.85 + 0.1 * wobble(frame, 11, 70);
  const breathe = Math.sin(frame / 40) * 3;
  return (
    <g>
      <MidDefs />
      <rect x={X0} y={1560} width={WIDTH} height={HEIGHT - 1560} fill="url(#mk-gen-floor)" />
      <line x1={X0} y1={1560} x2={1520} y2={1560} stroke={INK} strokeWidth={6} />
      {[1690, 1860, 2080, 2360].map((y) => (
        <line key={`p${y}`} x1={X0} y1={y} x2={1520} y2={y} stroke={PALETTE.woodDark} strokeWidth={4} opacity={0.3} />
      ))}
      <ellipse cx={540} cy={1770} rx={500} ry={120} fill="#c3b3d8" stroke={INK} strokeWidth={6} />
      <ellipse cx={540} cy={1770} rx={420} ry={88} fill="none" stroke="#e2d7ef" strokeWidth={8} opacity={0.8} />

      {/* Quầng sáng đèn ngủ */}
      <circle cx={100} cy={1220} r={330} fill="url(#mk-gen-lampglow)" opacity={flicker.toFixed(2)} />

      {/* Tủ đầu giường */}
      <ellipse cx={140} cy={1594} rx={130} ry={14} fill="#000000" opacity={0.18} />
      <rect x={52} y={1560} width={18} height={34} fill={PALETTE.woodDark} stroke={INK} strokeWidth={5} />
      <rect x={210} y={1560} width={18} height={34} fill={PALETTE.woodDark} stroke={INK} strokeWidth={5} />
      <rect x={40} y={1330} width={200} height={238} rx={12} fill={PALETTE.wood} stroke={INK} strokeWidth={6} />
      <rect x={60} y={1360} width={160} height={84} rx={8} fill="#d2a679" stroke={INK} strokeWidth={5} />
      <rect x={60} y={1462} width={160} height={84} rx={8} fill="#d2a679" stroke={INK} strokeWidth={5} />
      <circle cx={140} cy={1402} r={9} fill={PALETTE.metal} stroke={INK} strokeWidth={4} />
      <circle cx={140} cy={1504} r={9} fill={PALETTE.metal} stroke={INK} strokeWidth={4} />
      <rect x={26} y={1310} width={228} height={30} rx={10} fill="#d9ad80" stroke={INK} strokeWidth={6} />

      {/* Đèn ngủ */}
      <ellipse cx={92} cy={1306} rx={42} ry={12} fill={PALETTE.woodDark} stroke={INK} strokeWidth={5} />
      <rect x={86} y={1230} width={12} height={74} fill={PALETTE.metalDark} stroke={INK} strokeWidth={4} />
      <path d="M 52 1160 L 132 1160 L 160 1244 L 24 1244 Z" fill="#ffd98a" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
      <path d="M 60 1172 L 46 1232" stroke="#fff3c8" strokeWidth={9} strokeLinecap="round" opacity={0.9} />
      <path d="M 30 1244 L 154 1244" stroke="#fff3c8" strokeWidth={5} opacity={flicker.toFixed(2)} />
      {alarmClock(frame)}

      {/* Hộp đồ chơi bên trái */}
      <ellipse cx={-230} cy={1594} rx={140} ry={14} fill="#000000" opacity={0.18} />
      <rect x={-340} y={1440} width={220} height={150} rx={14} fill="#8fc3a4" stroke={INK} strokeWidth={6} />
      <rect x={-352} y={1424} width={244} height={32} rx={10} fill="#a8d6b8" stroke={INK} strokeWidth={6} />
      <circle cx={-190} cy={1385} r={38} fill="#f2c25e" stroke={INK} strokeWidth={6} />
      <path d="M -226 1385 Q -190 1360 -154 1385" fill="none" stroke="#e07a5f" strokeWidth={7} />

      {/* Giường bên phải */}
      <ellipse cx={1190} cy={1600} rx={330} ry={18} fill="#000000" opacity={0.2} />
      <rect x={870} y={1170} width={70} height={430} rx={30} fill={PALETTE.wood} stroke={INK} strokeWidth={7} />
      <rect x={884} y={1190} width={16} height={380} rx={8} fill="#d9ad80" opacity={0.8} />
      <rect x={1440} y={1330} width={60} height={270} rx={26} fill={PALETTE.wood} stroke={INK} strokeWidth={7} />
      <rect x={930} y={1470} width={520} height={100} rx={14} fill={PALETTE.woodDark} stroke={INK} strokeWidth={6} />
      <rect x={930} y={1410} width={520} height={74} rx={20} fill="#f3eefa" stroke={INK} strokeWidth={6} />
      <ellipse cx={1010} cy={(1392 - breathe * 0.3).toFixed(1)} rx={78} ry={40} fill="#fffaf2" stroke={INK} strokeWidth={6} />
      <path d="M 960 1378 Q 990 1366 1020 1372" fill="none" stroke="#ffffff" strokeWidth={6} strokeLinecap="round" />
      <path
        d={`M 1080 ${(1400 - breathe).toFixed(1)} Q 1260 ${(1380 - breathe).toFixed(1)} 1440 1402 L 1460 1540 Q 1250 1560 1060 1530 Z`}
        fill="url(#mk-gen-blanket)"
        stroke={INK}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <path d={`M 1100 ${(1420 - breathe).toFixed(1)} L 1440 1424`} stroke="#e8f3ff" strokeWidth={10} strokeLinecap="round" opacity={0.8} />
      <path d="M 1200 1450 Q 1240 1500 1230 1540" fill="none" stroke="#5a88b8" strokeWidth={5} strokeLinecap="round" />
      <path d="M 1340 1450 Q 1370 1500 1360 1545" fill="none" stroke="#5a88b8" strokeWidth={5} strokeLinecap="round" />
    </g>
  );
};

const LEAVES = [
  { a: -38, h: 420 },
  { a: -14, h: 470 },
  { a: 12, h: 440 },
  { a: 34, h: 380 },
];

/** Tiền cảnh: bóng gấu bông và dép bên trái, chậu cây lá đung đưa bên phải; kit làm mờ lớp này. */
const Near: FC<BackgroundProps> = ({ frame }) => (
  <g>
    <circle cx={-330} cy={1690} r={34} fill="#2b2542" />
    <circle cx={-180} cy={1690} r={34} fill="#2b2542" />
    <circle cx={-255} cy={1760} r={90} fill="#2b2542" />
    <ellipse cx={-255} cy={1980} rx={150} ry={150} fill="#2b2542" />
    <ellipse cx={-120} cy={2070} rx={70} ry={44} fill="#332c4e" />
    <ellipse cx={70} cy={2085} rx={90} ry={34} fill="#332c4e" />
    <path d="M 1150 2100 L 1170 1960 L 1350 1960 L 1370 2100 Z" fill="#2b2542" />
    {LEAVES.map((l, i) => {
      const sway = wobble(frame, 20 + i, 80) * 5;
      const ang = l.a + sway;
      return (
        <path
          key={`l${i}`}
          d={`M 1260 1970 Q 1200 ${1970 - l.h * 0.5} 1260 ${1970 - l.h + 80} Q 1320 ${1970 - l.h * 0.5} 1260 1970 Z`}
          fill={i % 2 === 0 ? "#263d38" : "#2f4a42"}
          transform={`rotate(${ang.toFixed(2)} 1260 1970)`}
        />
      );
    })}
    <path d="M 1430 1700 Q 1460 1900 1440 2120 L 1520 2120 L 1520 1700 Z" fill="#3a2f52" />
  </g>
);

/** Phòng ngủ ban đêm ba lớp: lớp xa, lớp giữa, tiền cảnh. */
export const asset: BackgroundAsset = {
  stage: GENERATED_WIDE_BACKGROUND_STAGE,
  Far,
  Component,
  Near,
};
