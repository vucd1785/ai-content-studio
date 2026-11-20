import type { FC, ReactNode } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble, rnd } from "../../../rig/math.js";
import { GENERATED_WIDE_BACKGROUND_STAGE } from "../../../stage/generated-stage.js";
import type { BackgroundAsset, BackgroundProps } from "../../../stage/types.js";

const INK = PALETTE.ink;
/** Vùng vẽ: rộng hơn khung dọc 440 mỗi bên cho khung ngang 16:9. */
const X0 = -440;
const WIDTH = 1960;

const Defs: FC = () => (
  <defs>
    <linearGradient id="mk-gen-wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#e4edf8" />
      <stop offset="1" stopColor="#bccde4" />
    </linearGradient>
    <linearGradient id="mk-gen-night" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#1b2f5c" />
      <stop offset="0.7" stopColor="#35599a" />
      <stop offset="1" stopColor="#5a7fbf" />
    </linearGradient>
    <radialGradient id="mk-gen-halo" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor="#f6f1cf" stopOpacity="0.55" />
      <stop offset="1" stopColor="#f6f1cf" stopOpacity="0" />
    </radialGradient>
    <linearGradient id="mk-gen-floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#9db1cd" />
      <stop offset="1" stopColor="#5f779c" />
    </linearGradient>
    <linearGradient id="mk-gen-table" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#f3f6fb" />
      <stop offset="1" stopColor="#c6d3e6" />
    </linearGradient>
    <clipPath id="mk-gen-win">
      <rect x={-400} y={260} width={630} height={1070} />
      <rect x={850} y={260} width={630} height={1070} />
    </clipPath>
  </defs>
);

const BUILDINGS = [
  { x: -400, w: 120, h: 520, far: true },
  { x: -270, w: 90, h: 640, far: true },
  { x: -60, w: 140, h: 560, far: true },
  { x: 120, w: 110, h: 700, far: true },
  { x: 850, w: 130, h: 600, far: true },
  { x: 1050, w: 100, h: 720, far: true },
  { x: 1260, w: 150, h: 540, far: true },
  { x: -380, w: 150, h: 380, far: false },
  { x: -170, w: 120, h: 460, far: false },
  { x: 20, w: 170, h: 340, far: false },
  { x: 880, w: 160, h: 420, far: false },
  { x: 1120, w: 130, h: 330, far: false },
  { x: 1300, w: 180, h: 450, far: false },
];

const STARS = [
  { x: -330, y: 330 }, { x: -60, y: 300 }, { x: 160, y: 380 },
  { x: 920, y: 320 }, { x: 1180, y: 360 }, { x: 1420, y: 300 },
];

/** Thành phố đêm sau vách kính: tòa nhà xa nhạt, gần đậm, cửa sổ sáng nhấp nháy. */
function city(frame: number): ReactNode {
  const out: ReactNode[] = [];
  BUILDINGS.forEach((b, bi) => {
    const top = 1330 - b.h;
    out.push(
      <rect key={`b${bi}`} x={b.x} y={top} width={b.w} height={b.h} fill={b.far ? "#5f82bd" : "#28457a"} />,
    );
    for (let k = 0; k < 6; k++) {
      if (rnd(bi + 3, k) < 0.45) continue;
      const wx = b.x + 18 + (k % 2) * (b.w / 2 - 6);
      const wy = top + 40 + Math.floor(k / 2) * 90;
      const flick = 0.65 + 0.35 * wobble(frame, bi * 7 + k, 70);
      out.push(
        <rect key={`w${bi}-${k}`} x={wx} y={wy} width={b.w / 2 - 30} height={30} rx={4}
          fill={b.far ? "#cfe0ff" : "#ffe08a"} opacity={flick.toFixed(2)} />,
      );
    }
  });
  return out;
}

/** Lớp xa: tường sau, trần có đèn, hai vách kính nhìn ra phố đêm và bảng trắng lớn có biểu đồ. */
const Far: FC<BackgroundProps> = ({ frame }) => {
  const glow = 0.8 + 0.15 * wobble(frame, 11, 120);
  return (
    <g>
      <Defs />
      <rect x={X0} y={0} width={WIDTH} height={2615} fill="url(#mk-gen-wall)" />
      <rect x={X0} y={0} width={WIDTH} height={190} fill="#c7d6ea" />
      <line x1={X0} y1={190} x2={1520} y2={190} stroke={INK} strokeWidth={5} opacity={0.5} />
      {[-180, 360, 900].map((lx) => (
        <rect key={`l${lx}`} x={lx} y={140} width={360} height={22} rx={11} fill="#fffbe8"
          stroke={INK} strokeWidth={4} opacity={glow.toFixed(2)} />
      ))}
      <g clipPath="url(#mk-gen-win)">
        <rect x={-400} y={260} width={1880} height={1070} fill="url(#mk-gen-night)" />
        <circle cx={-230} cy={440} r={150} fill="url(#mk-gen-halo)" />
        <circle cx={-230} cy={440} r={52} fill="#f6f1cf" />
        <circle cx={-246} cy={426} r={18} fill="#ffffff" opacity={0.6} />
        {STARS.map((s, i) => (
          <circle key={`s${i}`} cx={s.x} cy={s.y} r={5} fill="#ffffff"
            opacity={(0.55 + 0.45 * wobble(frame, i + 40, 50)).toFixed(2)} />
        ))}
        {city(frame)}
        <path d="M -380 1330 L -120 260 L -40 260 L -300 1330 Z" fill="#ffffff" opacity={0.1} />
        <path d="M 900 1330 L 1160 260 L 1220 260 L 960 1330 Z" fill="#ffffff" opacity={0.1} />
      </g>
      {[-400, 850].map((wx) => (
        <g key={`f${wx}`}>
          <rect x={wx} y={260} width={630} height={1070} fill="none" stroke={INK} strokeWidth={8} />
          <line x1={wx + 210} y1={260} x2={wx + 210} y2={1330} stroke={PALETTE.metalDark} strokeWidth={10} />
          <line x1={wx + 420} y1={260} x2={wx + 420} y2={1330} stroke={PALETTE.metalDark} strokeWidth={10} />
          <rect x={wx - 10} y={1326} width={650} height={26} rx={6} fill={PALETTE.metal} stroke={INK} strokeWidth={5} />
        </g>
      ))}
      <g>
        <rect x={262} y={560} width={556} height={590} rx={18} fill={PALETTE.metal} stroke={INK} strokeWidth={7} />
        <rect x={286} y={584} width={508} height={542} rx={8} fill="#f8fbff" />
        <rect x={296} y={594} width={180} height={18} rx={9} fill="#ffffff" />
        <polyline points="320,800 380,750 440,770 500,690 560,650" fill="none" stroke="#4a7fe0" strokeWidth={8}
          strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={560} cy={650} r={12} fill={PALETTE.accent}
          opacity={(0.6 + 0.4 * wobble(frame, 5, 40)).toFixed(2)} />
        {[90, 140, 180, 250].map((h, i) => (
          <rect key={`bar${i}`} x={330 + i * 60} y={1080 - h} width={40} height={h} rx={6}
            fill={i === 3 ? PALETTE.ok : "#7fa8ee"} stroke={INK} strokeWidth={4} />
        ))}
        <circle cx={690} cy={960} r={70} fill="#9fc0f5" stroke={INK} strokeWidth={5} />
        <path d="M 690 960 L 690 890 A 70 70 0 0 1 756 984 Z" fill="#3e6fd1" stroke={INK} strokeWidth={4} />
        <rect x={660} y={620} width={56} height={56} rx={4} fill="#ffe08a" stroke={INK} strokeWidth={3} transform="rotate(-6 688 648)" />
        <rect x={728} y={630} width={50} height={50} rx={4} fill="#a8e6cf" stroke={INK} strokeWidth={3} transform="rotate(5 753 655)" />
        <rect x={360} y={1150} width={360} height={18} rx={9} fill={PALETTE.metalDark} stroke={INK} strokeWidth={4} />
      </g>
    </g>
  );
};

/** Chậu cây văn phòng, lá đung đưa nhẹ. */
function plant(key: string, x: number, base: number, s: number, frame: number): ReactNode {
  const sway = Math.sin(frame / 30 + x) * 3;
  return (
    <g key={key} transform={`translate(${x} ${base}) scale(${s})`}>
      <ellipse cx={0} cy={4} rx={100} ry={16} fill="#000" opacity={0.18} />
      <g transform={`rotate(${sway.toFixed(2)} 0 -150)`}>
        <ellipse cx={-50} cy={-250} rx={34} ry={110} fill="#4f9a45" stroke={INK} strokeWidth={6} transform="rotate(-25 -50 -250)" />
        <ellipse cx={52} cy={-250} rx={34} ry={110} fill="#5fae52" stroke={INK} strokeWidth={6} transform="rotate(25 52 -250)" />
        <ellipse cx={0} cy={-290} rx={38} ry={130} fill={PALETTE.leaf} stroke={INK} strokeWidth={6} />
        <ellipse cx={-10} cy={-330} rx={10} ry={50} fill="#a6e07c" opacity={0.6} />
      </g>
      <path d="M -70 -150 L 70 -150 L 52 0 L -52 0 Z" fill="#eef3fa" stroke={INK} strokeWidth={6} />
      <path d="M 30 -150 L 70 -150 L 52 0 L 20 0 Z" fill="#c4d2e6" />
    </g>
  );
}

const CHAIRS = [150, 330, 540, 750, 930];

/** Lớp giữa: sàn thảm xanh, bàn họp dài với ghế và laptop phía sau nhân vật, chậu cây hai bên. */
const Room: FC<BackgroundProps> = ({ frame }) => (
  <g>
    <Defs />
    <path d={`M ${X0} 1500 L 1520 1500 L 1520 2615 L ${X0} 2615 Z`} fill="url(#mk-gen-floor)" />
    <rect x={X0} y={1484} width={WIDTH} height={20} fill="#8ea3c0" stroke={INK} strokeWidth={5} />
    <path d="M -300 1504 L 120 1504 L -60 2615 L -440 2615 Z" fill="#ffffff" opacity={0.08} />
    <path d="M 960 1504 L 1380 1504 L 1520 2300 L 1520 2615 L 1160 2615 Z" fill="#ffffff" opacity={0.08} />
    <ellipse cx={540} cy={1512} rx={520} ry={22} fill="#000" opacity={0.15} />
    {CHAIRS.map((cx) => (
      <g key={`c${cx}`}>
        <rect x={cx - 60} y={1230} width={120} height={150} rx={30} fill="#34507f" stroke={INK} strokeWidth={6} />
        <rect x={cx - 44} y={1246} width={22} height={90} rx={11} fill="#5675a8" />
      </g>
    ))}
    {[130, 950].map((lx) => (
      <rect key={`leg${lx}`} x={lx - 13} y={1410} width={26} height={92} fill={PALETTE.metalDark} stroke={INK} strokeWidth={5} />
    ))}
    <rect x={70} y={1384} width={940} height={36} rx={8} fill="#2f4870" stroke={INK} strokeWidth={6} />
    <rect x={40} y={1350} width={1000} height={42} rx={20} fill="url(#mk-gen-table)" stroke={INK} strokeWidth={6} />
    {[250, 640, 860].map((lx, i) => (
      <g key={`lap${lx}`}>
        <ellipse cx={lx} cy={1282} rx={70} ry={18} fill={PALETTE.screen}
          opacity={(0.3 + 0.15 * wobble(frame, i + 20, 60)).toFixed(2)} />
        <rect x={lx - 55} y={1290} width={110} height={64} rx={8} fill={PALETTE.metal} stroke={INK} strokeWidth={5} />
        <circle cx={lx} cy={1322} r={9} fill="#ffffff" opacity={0.7} />
      </g>
    ))}
    <rect x={430} y={1316} width={34} height={38} rx={6} fill="#ffffff" stroke={INK} strokeWidth={4} />
    {plant("p1", -250, 1560, 1.1, frame)}
    {plant("p2", 1320, 1560, 1.15, frame)}
  </g>
);

/** Tiền cảnh: lưng ghế và lá cây tối bên trái, góc bàn và cốc bên phải; kit làm mờ lớp này. */
const Near: FC<BackgroundProps> = ({ frame }) => {
  const leaves = [0, 1, 2].map((i) => {
    const bend = Math.sin(frame / 26 + i * 1.3) * 14 + (i - 1) * 50;
    const tip = 380 - i * 40;
    return (
      <path key={`lf${i}`}
        d={`M 70 2120 Q ${60 + bend * 0.4} ${2120 - tip * 0.6} ${(90 + bend).toFixed(1)} ${2120 - tip} Q ${110 + bend * 0.3} ${2120 - tip * 0.5} 110 2120 Z`}
        fill={i === 1 ? "#1f3a4a" : "#18303f"} />
    );
  });
  return (
    <g>
      <rect x={-400} y={1690} width={250} height={470} rx={60} fill="#1a2a47" />
      <rect x={-420} y={2000} width={320} height={80} rx={30} fill="#15233c" />
      {leaves}
      <path d="M 940 1820 L 1480 1770 L 1480 2200 L 1000 2200 Z" fill="#1d2f50" />
      <rect x={1110} y={1700} width={80} height={96} rx={14} fill="#15233c" />
    </g>
  );
};

/** Phòng họp nhà đầu tư trong trụ sở công ty công nghệ, nhìn ra thành phố đêm. */
export const asset: BackgroundAsset = {
  stage: GENERATED_WIDE_BACKGROUND_STAGE,
  Far,
  Component: Room,
  Near,
};
