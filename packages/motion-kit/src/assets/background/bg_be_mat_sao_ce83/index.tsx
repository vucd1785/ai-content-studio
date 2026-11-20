import type { FC, ReactNode } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble } from "../../../rig/math.js";
import { GENERATED_WIDE_BACKGROUND_STAGE } from "../../../stage/generated-stage.js";
import type { BackgroundAsset, BackgroundProps } from "../../../stage/types.js";

const INK = PALETTE.ink;
/** Vùng vẽ: rộng hơn khung dọc 440 mỗi bên cho khung ngang 16:9. */
const X0 = -440;
const WIDTH = 1960;

/** Đưa toạ độ x về lại trong vùng vẽ để vật trôi lặp vòng. */
const wrap = (v: number) => X0 + ((((v - X0) % WIDTH) + WIDTH) % WIDTH);

const Defs: FC = () => (
  <defs>
    <linearGradient id="mk-gen-mars-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#e39a78" />
      <stop offset="0.45" stopColor="#f0b893" />
      <stop offset="1" stopColor="#f8dcc0" />
    </linearGradient>
    <radialGradient id="mk-gen-mars-sun" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor="#fff4e2" stopOpacity="0.9" />
      <stop offset="1" stopColor="#fff4e2" stopOpacity="0" />
    </radialGradient>
    <linearGradient id="mk-gen-mars-ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#cf7448" />
      <stop offset="0.5" stopColor="#bb5d38" />
      <stop offset="1" stopColor="#9c4529" />
    </linearGradient>
    <linearGradient id="mk-gen-mars-dune" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#dc9772" />
      <stop offset="1" stopColor="#e9b593" />
    </linearGradient>
  </defs>
);

/** Một dải bụi mờ trôi ngang. */
function dustBand(key: string, x: number, y: number, w: number, h: number, frame: number, speed: number, op: number) {
  const cx = wrap(x + frame * speed);
  return <ellipse key={key} cx={cx.toFixed(1)} cy={y} rx={w} ry={h} fill="#fbe3cc" opacity={op} />;
}

/** Lớp xa: trời bụi hồng cam, mặt trời nhạt, dải bụi, núi mặt bàn và đồi cát nhạt dần. */
const Far: FC<BackgroundProps> = ({ frame }) => {
  const glow = 1 + wobble(frame, 3, 90) * 0.04;
  return (
    <g>
      <Defs />
      <rect x={X0} y={0} width={WIDTH} height={2615} fill="url(#mk-gen-mars-sky)" />
      <circle cx={860} cy={380} r={260 * glow} fill="url(#mk-gen-mars-sun)" />
      <circle cx={860} cy={380} r={48} fill="#fff3e2" />
      <circle cx={846} cy={366} r={20} fill="#ffffff" opacity={0.7} />
      {dustBand("d1", 200, 620, 420, 34, frame, 0.5, 0.35)}
      {dustBand("d2", 1100, 820, 360, 26, frame, 0.35, 0.3)}
      {dustBand("d3", -200, 1000, 480, 40, frame, 0.6, 0.28)}
      {/* núi mặt bàn xa nhất */}
      <path
        d={`M ${X0} 1300 L -300 1300 L -250 1150 L -40 1140 L 10 1300 L 520 1300 L 580 1200 L 760 1195 L 800 1300 L 1180 1300 L 1240 1120 L 1440 1110 L 1480 1300 L 1520 1300 L 1520 2615 L ${X0} 2615 Z`}
        fill="#e7b598"
      />
      <path d="M -250 1150 L -40 1140 L -36 1156 L -246 1166 Z" fill="#f2cbb0" />
      <path d="M 1240 1120 L 1440 1110 L 1444 1128 L 1244 1138 Z" fill="#f2cbb0" />
      {/* đồi cát gần hơn, đậm hơn */}
      <path
        d={`M ${X0} 1420 Q -180 1300 120 1380 Q 380 1290 660 1390 Q 940 1300 1220 1380 Q 1400 1320 1520 1370 L 1520 2615 L ${X0} 2615 Z`}
        fill="url(#mk-gen-mars-dune)"
      />
      <path
        d="M -120 1350 Q 0 1330 120 1380 Q 20 1360 -120 1350 Z M 560 1350 Q 640 1340 760 1370 Q 660 1360 560 1350 Z"
        fill="#f1c5a6"
      />
      {dustBand("d4", 700, 1360, 520, 30, frame, 0.8, 0.32)}
    </g>
  );
};

/** Một tảng đá đỏ: viền đậm, sáng bên trái trên, tối bên phải. */
function rock(key: string, x: number, y: number, s: number, flip: number): ReactNode {
  return (
    <g key={key} transform={`translate(${x} ${y}) scale(${s * flip} ${s})`}>
      <ellipse cx={0} cy={4} rx={110} ry={16} fill="#000" opacity={0.18} />
      <path
        d="M -95 0 Q -105 -60 -55 -96 Q 5 -130 62 -92 Q 108 -58 98 0 Z"
        fill="#a9533a"
        stroke={INK}
        strokeWidth={6}
      />
      <path d="M -74 -36 Q -64 -86 -12 -104 Q -42 -72 -52 -28 Z" fill="#d98a66" />
      <path d="M 56 -82 Q 94 -52 88 -6 L 42 -6 Q 64 -40 56 -82 Z" fill="#7d3622" opacity={0.6} />
    </g>
  );
}

const PEBBLES = [
  { x: -340, y: 1720, r: 14 },
  { x: -60, y: 1820, r: 10 },
  { x: 180, y: 1700, r: 9 },
  { x: 420, y: 1880, r: 12 },
  { x: 660, y: 1760, r: 8 },
  { x: 880, y: 1700, r: 11 },
  { x: 1220, y: 1820, r: 13 },
  { x: 1450, y: 1700, r: 9 },
  { x: 560, y: 2240, r: 16 },
];

/** Lớp giữa: nền đất đỏ cam nơi nhân vật đứng, miệng hố, đá hai bên, sỏi và gợn bụi bay sát đất. */
const Ground: FC<BackgroundProps> = ({ frame }) => (
  <g>
    <Defs />
    <path
      d={`M ${X0} 1520 Q 100 1480 540 1505 Q 1000 1480 1520 1515 L 1520 2615 L ${X0} 2615 Z`}
      fill="url(#mk-gen-mars-ground)"
      stroke={INK}
      strokeWidth={6}
    />
    {/* dải đất sáng, êm phía sau nhân vật */}
    <ellipse cx={540} cy={1600} rx={520} ry={70} fill="#d98d64" opacity={0.55} />
    <path d="M -440 1980 Q 300 1930 1520 2010" stroke="#a84e30" strokeWidth={10} fill="none" opacity={0.5} />
    <path d="M -440 2300 Q 500 2240 1520 2320" stroke="#93402a" strokeWidth={12} fill="none" opacity={0.45} />
    {/* miệng hố nhỏ */}
    <ellipse cx={1180} cy={2080} rx={170} ry={46} fill="#e09a74" stroke={INK} strokeWidth={6} />
    <ellipse cx={1186} cy={2088} rx={128} ry={30} fill="#9a4429" />
    <path d="M 1070 2080 Q 1120 2062 1180 2060" stroke="#f0b996" strokeWidth={6} fill="none" />
    {rock("r1", -250, 1560, 1.3, 1)}
    {rock("r2", 60, 1535, 0.6, -1)}
    {rock("r3", 1050, 1540, 0.75, 1)}
    {rock("r4", 1340, 1575, 1.2, -1)}
    {rock("r5", 160, 2080, 0.55, 1)}
    {rock("r6", 860, 2250, 0.7, -1)}
    {PEBBLES.map((p) => (
      <g key={`p${p.x}-${p.y}`}>
        <ellipse cx={p.x} cy={p.y} rx={p.r * 1.4} ry={p.r} fill="#8e3f27" stroke={INK} strokeWidth={4} />
        <ellipse cx={p.x - p.r * 0.4} cy={p.y - p.r * 0.35} rx={p.r * 0.5} ry={p.r * 0.3} fill="#d38660" />
      </g>
    ))}
    {[0, 1, 2, 3].map((i) => {
      const x = wrap(i * 520 - 300 + frame * (1.6 + i * 0.3));
      const y = 1555 + i * 38 + wobble(frame, i + 7, 70) * 8;
      return (
        <path
          key={`w${i}`}
          d={`M ${(x - 160).toFixed(1)} ${y.toFixed(1)} Q ${x.toFixed(1)} ${(y - 18).toFixed(1)} ${(x + 160).toFixed(1)} ${y.toFixed(1)}`}
          stroke="#fbe0c8"
          strokeWidth={8}
          strokeLinecap="round"
          fill="none"
          opacity={0.35}
        />
      );
    })}
  </g>
);

/** Tiền cảnh: vài tảng đá tối lớn ở hai góc dưới; kit làm mờ và cho trượt nhanh hơn. */
const Near: FC<BackgroundProps> = ({ frame }) => {
  const sway = wobble(frame, 11, 120) * 4;
  return (
    <g>
      <path d="M -420 2100 Q -430 1820 -300 1720 Q -180 1660 -60 1740 Q 30 1820 20 2100 Z" fill="#5a2418" />
      <path d="M -60 2100 Q -40 1900 40 1860 Q 120 1840 150 1940 Q 160 2020 150 2100 Z" fill="#6c2e1d" />
      <path d="M 930 2100 Q 940 1940 1030 1890 Q 1110 1860 1150 1960 L 1170 2100 Z" fill="#6c2e1d" />
      <path d="M 1100 2100 Q 1090 1800 1240 1700 Q 1380 1660 1460 1780 Q 1500 1900 1480 2100 Z" fill="#5a2418" />
      <ellipse cx={(-180 + sway).toFixed(1)} cy={2010} rx={260} ry={40} fill="#4a1d13" opacity={0.6} />
      <ellipse cx={(1250 - sway).toFixed(1)} cy={2020} rx={240} ry={38} fill="#4a1d13" opacity={0.6} />
    </g>
  );
};

/** Bề mặt sao Hỏa, bối cảnh ba lớp: trời bụi xa, đất đỏ ở giữa, đá tối tiền cảnh. */
export const asset: BackgroundAsset = {
  stage: GENERATED_WIDE_BACKGROUND_STAGE,
  Far,
  Component: Ground,
  Near,
};
