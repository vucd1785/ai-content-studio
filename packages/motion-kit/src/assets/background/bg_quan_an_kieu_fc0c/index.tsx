import type { FC, ReactNode } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble, rnd } from "../../../rig/math.js";
import { GENERATED_WIDE_BACKGROUND_STAGE } from "../../../stage/generated-stage.js";
import type { BackgroundAsset, BackgroundProps } from "../../../stage/types.js";

const INK = PALETTE.ink;
/** Vùng vẽ: rộng hơn khung dọc 440 mỗi bên cho khung ngang 16:9. */
const X0 = -440;
const WIDTH = 1960;
const H = 2615;

const Defs: FC = () => (
  <defs>
    <linearGradient id="mk-gen-wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#f3dfbf" />
      <stop offset="1" stopColor="#f8ead2" />
    </linearGradient>
    <linearGradient id="mk-gen-night" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#1f2c55" />
      <stop offset="0.7" stopColor="#35457a" />
      <stop offset="1" stopColor="#5a5f8a" />
    </linearGradient>
    <radialGradient id="mk-gen-glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor="#ffe6a3" stopOpacity="0.85" />
      <stop offset="1" stopColor="#ffe6a3" stopOpacity="0" />
    </radialGradient>
    <linearGradient id="mk-gen-floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#d9b98f" />
      <stop offset="1" stopColor="#b68e66" />
    </linearGradient>
    <linearGradient id="mk-gen-seat" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stopColor="#e0675a" />
      <stop offset="1" stopColor="#b8443c" />
    </linearGradient>
    <clipPath id="mk-gen-win">
      <rect x={140} y={380} width={800} height={800} rx={18} />
    </clipPath>
  </defs>
);

const BUILDINGS = [
  { x: 150, w: 150, top: 820, c: "#2b3866" },
  { x: 300, w: 120, top: 900, c: "#34427a" },
  { x: 420, w: 170, top: 760, c: "#2b3866" },
  { x: 590, w: 130, top: 870, c: "#3a4884" },
  { x: 720, w: 220, top: 800, c: "#2f3c6e" },
];

/** Đèn thả trần: chao vàng, quầng sáng lung linh, đung đưa nhẹ. */
function lamp(key: string, x: number, len: number, frame: number, seed: number): ReactNode {
  const sway = wobble(frame, seed, 110) * 1.6;
  const glow = 0.55 + wobble(frame, seed + 7, 40) * 0.08;
  return (
    <g key={key} transform={`rotate(${sway.toFixed(2)} ${x} 0)`}>
      <circle cx={x} cy={len + 40} r={200} fill="url(#mk-gen-glow)" opacity={glow} />
      <line x1={x} y1={0} x2={x} y2={len} stroke={INK} strokeWidth={5} />
      <path
        d={`M ${x - 22} ${len} L ${x + 22} ${len} L ${x + 70} ${len + 62} L ${x - 70} ${len + 62} Z`}
        fill="#e9a23b"
        stroke={INK}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <path d={`M ${x - 18} ${len + 8} L ${x - 50} ${len + 54}`} stroke="#ffd98a" strokeWidth={8} strokeLinecap="round" />
      <ellipse cx={x} cy={len + 64} rx={38} ry={12} fill="#fff4c7" />
    </g>
  );
}

/** Lớp xa: tường kem, cửa kính lớn nhìn ra phố đêm, tranh, đồng hồ, kệ cốc và đèn thả. */
const Far: FC<BackgroundProps> = ({ frame }) => {
  const carX = 60 + ((frame * 5) % 1100);
  return (
    <g>
      <Defs />
      <rect x={X0} y={0} width={WIDTH} height={H} fill="url(#mk-gen-wall)" />
      <rect x={X0} y={0} width={WIDTH} height={70} fill="#c9a77f" />
      {/* ốp gỗ chân tường */}
      <rect x={X0} y={1250} width={WIDTH} height={400} fill="#a8734a" />
      <rect x={X0} y={1236} width={WIDTH} height={24} fill={PALETTE.woodDark} />
      {[-360, -120, 120, 360, 600, 840, 1080, 1320].map((px) => (
        <rect key={`p${px}`} x={px} y={1300} width={180} height={220} rx={10} fill="#b98458" />
      ))}
      {/* cửa kính và phố đêm */}
      <g clipPath="url(#mk-gen-win)">
        <rect x={140} y={380} width={800} height={800} fill="url(#mk-gen-night)" />
        <circle cx={790} cy={520} r={54} fill="#fff3c4" />
        <circle cx={812} cy={505} r={46} fill="#2a3762" opacity={0.25} />
        {BUILDINGS.map((b, bi) => (
          <g key={`b${bi}`}>
            <rect x={b.x} y={b.top} width={b.w} height={1180 - b.top} fill={b.c} />
            {[0, 1, 2, 3, 4, 5].map((r) =>
              [0, 1, 2].map((c) => {
                const i = r * 3 + c;
                if (rnd(bi + 3, i) < 0.45) return null;
                const op = 0.65 + wobble(frame, bi * 20 + i, 70) * 0.3;
                return (
                  <rect
                    key={`w${bi}-${i}`}
                    x={b.x + 18 + c * ((b.w - 36) / 3)}
                    y={b.top + 24 + r * 46}
                    width={22}
                    height={26}
                    fill="#ffd36e"
                    opacity={op}
                  />
                );
              }),
            )}
          </g>
        ))}
        <rect x={140} y={1110} width={800} height={70} fill="#4a4e6e" />
        <ellipse cx={carX} cy={1130} rx={110} ry={22} fill="#fff1b0" opacity={0.6} />
        <path d="M 240 1120 L 240 940" stroke="#1c2445" strokeWidth={10} />
        <circle cx={240} cy={930} r={40} fill="url(#mk-gen-glow)" />
        <circle cx={240} cy={932} r={14} fill="#ffe6a3" />
        <path d="M 180 380 L 420 380 L 200 1180 L 140 1180 L 140 560 Z" fill="#ffffff" opacity={0.08} />
      </g>
      <rect x={140} y={380} width={800} height={800} rx={18} fill="none" stroke={PALETTE.woodDark} strokeWidth={26} />
      <rect x={140} y={380} width={800} height={800} rx={18} fill="none" stroke={INK} strokeWidth={6} />
      <line x1={540} y1={392} x2={540} y2={1168} stroke={PALETTE.woodDark} strokeWidth={16} />
      <rect x={110} y={1180} width={860} height={34} rx={8} fill={PALETTE.wood} stroke={INK} strokeWidth={6} />
      {/* rèm vải đỏ trên cửa */}
      <path d="M 120 350 L 960 350 L 960 420 Q 855 470 750 420 Q 645 470 540 420 Q 435 470 330 420 Q 225 470 120 420 Z" fill="#cf5548" stroke={INK} strokeWidth={6} />
      {/* tranh treo bên trái */}
      <rect x={-330} y={560} width={220} height={260} rx={12} fill="#7fb7a8" stroke={INK} strokeWidth={7} />
      <rect x={-300} y={590} width={160} height={200} rx={6} fill="#cfe6dc" />
      <path d="M -260 700 L -180 700 L -190 760 L -250 760 Z" fill="#ffffff" stroke={INK} strokeWidth={5} />
      <path d="M -235 680 Q -245 650 -225 630" stroke="#9aa9a4" strokeWidth={5} fill="none" strokeLinecap="round" />
      {/* đồng hồ và kệ cốc bên phải */}
      <circle cx={1290} cy={600} r={90} fill="#fffaf0" stroke={INK} strokeWidth={7} />
      <line x1={1290} y1={600} x2={1290} y2={540} stroke={INK} strokeWidth={6} strokeLinecap="round" />
      <line x1={1290} y1={600} x2={1330} y2={620} stroke={PALETTE.alert} strokeWidth={5} strokeLinecap="round" />
      <rect x={1150} y={940} width={300} height={22} rx={6} fill={PALETTE.wood} stroke={INK} strokeWidth={6} />
      {[1190, 1260, 1330, 1400].map((mx, i) => (
        <g key={`m${mx}`}>
          <rect x={mx - 24} y={880} width={48} height={60} rx={8} fill={i % 2 ? "#f2c14e" : "#7fb7a8"} stroke={INK} strokeWidth={5} />
          <rect x={mx - 16} y={888} width={10} height={40} rx={4} fill="#ffffff" opacity={0.45} />
        </g>
      ))}
      {lamp("l1", 40, 180, frame, 1)}
      {lamp("l2", 1040, 200, frame, 2)}
      {lamp("l3", -300, 150, frame, 3)}
      {lamp("l4", 1380, 160, frame, 4)}
    </g>
  );
};

/** Ghế băng đệm đỏ nhìn nghiêng: lưng cao, nệm ngồi, chân gỗ. dir = 1 quay sang phải. */
function booth(key: string, x: number, dir: number): ReactNode {
  const back = dir > 0 ? x : x - 70;
  const seatX = dir > 0 ? x : x - 220;
  return (
    <g key={key}>
      <rect x={seatX} y={1480} width={220} height={100} fill={PALETTE.woodDark} stroke={INK} strokeWidth={6} />
      <rect x={seatX - 6} y={1430} width={232} height={60} rx={26} fill="url(#mk-gen-seat)" stroke={INK} strokeWidth={6} />
      <rect x={back} y={1150} width={70} height={330} rx={30} fill="url(#mk-gen-seat)" stroke={INK} strokeWidth={6} />
      <line x1={back + 35} y1={1190} x2={back + 35} y2={1440} stroke="#9c3a33" strokeWidth={4} />
      <rect x={back + 10} y={1170} width={12} height={180} rx={6} fill="#f39286" opacity={0.7} />
    </g>
  );
}

/** Bàn tròn chân trụ với cốc cà phê bốc hơi và đĩa bánh. */
function table(key: string, x: number, frame: number, seed: number): ReactNode {
  const steam = [0, 1].map((k) => {
    const ph = ((frame + k * 30 + seed * 11) % 60) / 60;
    const y = 1290 - ph * 70;
    const sx = wobble(frame, seed + k, 50) * 8;
    return (
      <path
        key={`s${k}`}
        d={`M ${x - 52 + k * 18} ${y} q ${10 + sx} -18 0 -36 q ${-10 + sx} -18 0 -36`}
        stroke="#ffffff"
        strokeWidth={6}
        fill="none"
        strokeLinecap="round"
        opacity={(1 - ph) * 0.8}
      />
    );
  });
  return (
    <g key={key}>
      <ellipse cx={x} cy={1580} rx={90} ry={14} fill="#000" opacity={0.15} />
      <rect x={x - 16} y={1380} width={32} height={190} fill={PALETTE.metalDark} stroke={INK} strokeWidth={6} />
      <rect x={x - 70} y={1560} width={140} height={20} rx={8} fill={PALETTE.metal} stroke={INK} strokeWidth={6} />
      <rect x={x - 170} y={1352} width={340} height={34} rx={12} fill="#f2ede4" stroke={INK} strokeWidth={6} />
      <rect x={x - 160} y={1360} width={150} height={8} rx={4} fill="#ffffff" />
      {steam}
      <rect x={x - 80} y={1290} width={56} height={62} rx={10} fill="#ffffff" stroke={INK} strokeWidth={5} />
      <path d={`M ${x - 24} 1306 q 26 2 0 30`} stroke={INK} strokeWidth={5} fill="none" />
      <ellipse cx={x - 52} cy={1296} rx={22} ry={5} fill="#6b3f22" />
      <ellipse cx={x + 70} cy={1350} rx={70} ry={10} fill="#ffffff" stroke={INK} strokeWidth={5} />
      <path d={`M ${x + 30} 1344 L ${x + 110} 1344 L ${x + 100} 1310 Z`} fill="#f2c14e" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
      <path d={`M ${x + 100} 1310 L ${x + 30} 1344`} stroke="#c8463c" strokeWidth={5} />
    </g>
  );
}

/** Lớp giữa: sàn gỗ ấm nơi nhân vật đứng, hai cụm ghế băng và bàn hai bên. */
const Diner: FC<BackgroundProps> = ({ frame }) => {
  const lines: ReactNode[] = [];
  for (let k = -7; k <= 7; k++) {
    lines.push(
      <line key={`fl${k}`} x1={540 + k * 150} y1={1580} x2={540 + k * 420} y2={H} stroke="#8a6444" strokeWidth={4} opacity={0.25} />,
    );
  }
  return (
    <g>
      <Defs />
      <rect x={X0} y={1560} width={WIDTH} height={H - 1560} fill="url(#mk-gen-floor)" />
      {lines}
      {[1700, 1880, 2120, 2420].map((y) => (
        <line key={`h${y}`} x1={X0} y1={y} x2={1520} y2={y} stroke="#8a6444" strokeWidth={4} opacity={0.2} />
      ))}
      <rect x={X0} y={1548} width={WIDTH} height={32} fill={PALETTE.woodDark} stroke={INK} strokeWidth={6} />
      {booth("bl1", -440, 1)}
      {table("tl", -150, frame, 1)}
      {booth("bl2", 190, -1)}
      {booth("br1", 890, 1)}
      {table("tr", 1260, frame, 5)}
      {booth("br2", 1520, -1)}
    </g>
  );
};

/** Tiền cảnh: góc ghế, ghế đẩu và lá cây tối màu ở hai góc dưới; kit làm mờ. */
const Near: FC<BackgroundProps> = ({ frame }) => {
  const sway = wobble(frame, 9, 80) * 4;
  const DARK = "#2a1e1c";
  return (
    <g>
      <rect x={-420} y={1720} width={300} height={400} rx={60} fill={DARK} />
      <g transform={`rotate(${sway.toFixed(2)} 80 2100)`}>
        <path d="M 80 2100 Q 20 1850 -40 1700 Q 60 1820 100 2100 Z" fill="#2f4a33" />
        <path d="M 90 2100 Q 120 1860 150 1680 Q 160 1880 120 2100 Z" fill="#3a5a3e" />
      </g>
      <ellipse cx={1090} cy={1700} rx={110} ry={34} fill={DARK} />
      <rect x={1074} y={1700} width={32} height={400} fill={DARK} />
      <g transform={`rotate(${(-sway).toFixed(2)} 1400 2100)`}>
        <path d="M 1380 2100 Q 1300 1860 1260 1680 Q 1380 1840 1420 2100 Z" fill="#2f4a33" />
        <path d="M 1410 2100 Q 1450 1850 1480 1660 Q 1490 1880 1450 2100 Z" fill="#3a5a3e" />
      </g>
    </g>
  );
};

/** Quán ăn kiểu Mỹ ấm cúng ba lớp: tường và cửa kính phố đêm, sàn với ghế băng và bàn, tiền cảnh tối. */
export const asset: BackgroundAsset = {
  stage: GENERATED_WIDE_BACKGROUND_STAGE,
  Far,
  Component: Diner,
  Near,
};
