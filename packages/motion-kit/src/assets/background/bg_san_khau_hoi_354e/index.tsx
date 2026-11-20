import type { FC, ReactNode } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
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
      <stop offset="0" stopColor="#3f4a68" />
      <stop offset="0.7" stopColor="#5a6788" />
      <stop offset="1" stopColor="#4a5574" />
    </linearGradient>
    <linearGradient id="mk-gen-screen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#8ef0d0" />
      <stop offset="0.55" stopColor="#38c2a4" />
      <stop offset="1" stopColor="#1f8f86" />
    </linearGradient>
    <radialGradient id="mk-gen-glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor="#8ef0d0" stopOpacity="0.6" />
      <stop offset="1" stopColor="#8ef0d0" stopOpacity="0" />
    </radialGradient>
    <linearGradient id="mk-gen-beam" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#fff6d8" stopOpacity="0.6" />
      <stop offset="1" stopColor="#fff6d8" stopOpacity="0.04" />
    </linearGradient>
    <radialGradient id="mk-gen-pool" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor="#fff3cf" stopOpacity="0.45" />
      <stop offset="1" stopColor="#fff3cf" stopOpacity="0" />
    </radialGradient>
    <linearGradient id="mk-gen-stage" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#9a7a5e" />
      <stop offset="1" stopColor="#6e5340" />
    </linearGradient>
    <linearGradient id="mk-gen-hall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#353d5a" />
      <stop offset="1" stopColor="#222840" />
    </linearGradient>
  </defs>
);

const LAMPS = [-260, 120, 400, 680, 960, 1340];
const PANELS = [-440, -280, -120, 1000, 1160, 1320];

/** Lớp xa: tường hội trường, màn hình lớn tỏa ánh xanh, giàn đèn và luồng sáng chiếu xuống. */
const Far: FC<BackgroundProps> = ({ frame }) => {
  const pulse = 0.85 + 0.15 * Math.sin(frame / 24);
  const ringT = (frame % 90) / 90;
  const ringR = 140 + easing.out(ringT) * 240;
  const scanY = 280 + ((frame * 3) % 720);
  let pins = "";
  for (let i = 0; i < 5; i++) {
    const p = 490 + i * 25 - 50;
    pins += `M ${p} 470 L ${p} 440 M ${p} 730 L ${p} 760 M 410 ${p + 60} L 380 ${p + 60} M 670 ${p + 60} L 700 ${p + 60} `;
  }
  return (
    <g>
      <Defs />
      <rect x={X0} y={0} width={WIDTH} height={H} fill="url(#mk-gen-wall)" />
      {PANELS.map((x) => (
        <rect key={`p${x}`} x={x + 14} y={260} width={130} height={1120} rx={14} fill="#66739a" opacity={0.45} />
      ))}
      {[-360, 1400].map((x, i) => (
        <g key={`led${x}`}>
          <rect x={x - 40} y={300} width={80} height={1060} rx={30} fill="#2f3854" stroke={INK} strokeWidth={6} />
          {[0, 1, 2, 3, 4, 5, 6].map((j) => (
            <circle
              key={`d${j}`}
              cx={x}
              cy={380 + j * 140}
              r={18}
              fill="#8ef0d0"
              opacity={0.35 + 0.45 * (0.5 + 0.5 * Math.sin(frame / 10 - j * 0.9 + i * 2))}
            />
          ))}
        </g>
      ))}
      <ellipse cx={540} cy={640} rx={720 * pulse} ry={560 * pulse} fill="url(#mk-gen-glow)" />
      <rect x={120} y={250} width={840} height={780} rx={28} fill="#252b40" stroke={INK} strokeWidth={8} />
      <rect x={146} y={276} width={788} height={728} rx={16} fill="url(#mk-gen-screen)" opacity={pulse} />
      <rect x={146} y={276} width={260} height={728} rx={16} fill="#ffffff" opacity={0.12} />
      <circle cx={540} cy={600} r={ringR} fill="none" stroke="#e6fff5" strokeWidth={6} opacity={(1 - ringT) * 0.6} />
      <path d={pins} stroke="#0f4d42" strokeWidth={10} strokeLinecap="round" />
      <rect x={410} y={470} width={260} height={260} rx={30} fill="#1a6b5a" stroke="#0f4d42" strokeWidth={8} />
      <rect x={470} y={530} width={140} height={140} rx={18} fill="#b8ffe6" opacity={0.6 + 0.3 * Math.sin(frame / 14)} />
      <rect x={146} y={Math.min(scanY, 980)} width={788} height={24} fill="#ffffff" opacity={0.15} />
      <rect x={X0} y={1380} width={WIDTH} height={140} fill="#323b58" />
      <rect x={X0} y={70} width={WIDTH} height={70} fill={PALETTE.metalDark} stroke={INK} strokeWidth={6} />
      <path
        d={`M ${X0} 135 ${Array.from({ length: 25 }, (_, i) => `L ${X0 + i * 80 + 40} 75 L ${X0 + i * 80 + 80} 135`).join(" ")}`}
        fill="none"
        stroke={PALETTE.metal}
        strokeWidth={5}
      />
      {LAMPS.map((lx, i) => {
        const sway = Math.sin(frame / 50 + i * 1.3) * 4;
        const op = 0.55 + 0.12 * wobble(frame, i + 3, 40);
        return (
          <g key={`l${lx}`}>
            <g transform={`rotate(${sway.toFixed(2)} ${lx} 170)`}>
              <path d={`M ${lx - 40} 180 L ${lx - 230} 1580 L ${lx + 230} 1580 L ${lx + 40} 180 Z`} fill="url(#mk-gen-beam)" opacity={op} />
            </g>
            <rect x={lx - 42} y={135} width={84} height={56} rx={14} fill={PALETTE.metalDark} stroke={INK} strokeWidth={6} />
            <ellipse cx={lx} cy={190} rx={30} ry={10} fill="#fff6d8" />
          </g>
        );
      })}
    </g>
  );
};

function seatRow(y: number, color: string, offset: number): ReactNode {
  let d = `M ${X0} ${y + 200}`;
  for (let x = X0 + offset; x < 1560; x += 96) {
    d += ` L ${x} ${y} Q ${x + 48} ${y - 76} ${x + 96} ${y}`;
  }
  d += ` L 1560 ${y + 200} Z`;
  return <path key={`r${y}`} d={d} fill={color} />;
}

/** Lớp giữa: sàn gỗ sân khấu, vũng sáng, bục phát biểu, loa kiểm âm và hàng ghế khán giả tối mờ. */
const Stage: FC<BackgroundProps> = ({ frame }) => (
  <g>
    <Defs />
    <path
      d={`M ${X0} 1500 L 1520 1500 L 1520 1950 L ${X0} 1950 Z`}
      fill="url(#mk-gen-stage)"
      stroke={INK}
      strokeWidth={6}
    />
    <rect x={X0} y={1500} width={WIDTH} height={16} fill="#b8987a" opacity={0.7} />
    {[310, 540, 770].map((x, i) => (
      <ellipse
        key={`pool${x}`}
        cx={x}
        cy={1600}
        rx={200}
        ry={60}
        fill="url(#mk-gen-pool)"
        opacity={0.8 + 0.2 * Math.sin(frame / 30 + i)}
      />
    ))}
    <rect x={X0} y={1944} width={WIDTH} height={56} fill={PALETTE.woodDark} stroke={INK} strokeWidth={6} />
    <rect x={X0} y={1958} width={WIDTH} height={8} fill="#8ef0d0" opacity={0.5 + 0.3 * Math.sin(frame / 18)} />
    <rect x={X0} y={2000} width={WIDTH} height={615} fill="url(#mk-gen-hall)" />
    {seatRow(2160, "#3a4262", 0)}
    {seatRow(2360, "#2f3653", 48)}
    {seatRow(2560, "#262c45", 0)}
    <g>
      <ellipse cx={1190} cy={1610} rx={120} ry={18} fill="#000" opacity={0.2} />
      <path d="M 1110 1610 L 1130 1400 L 1250 1400 L 1270 1610 Z" fill={PALETTE.wood} stroke={INK} strokeWidth={6} />
      <path d="M 1130 1400 L 1250 1400 L 1260 1440 L 1120 1440 Z" fill={PALETTE.woodDark} stroke={INK} strokeWidth={6} />
      <rect x={1145} y={1460} width={30} height={130} rx={10} fill="#ffffff" opacity={0.18} />
      <circle cx={1190} cy={1510} r={22} fill="#8ef0d0" opacity={0.6 + 0.3 * Math.sin(frame / 20)} />
    </g>
    <g>
      <ellipse cx={-170} cy={1612} rx={110} ry={16} fill="#000" opacity={0.2} />
      <path d="M -260 1610 L -240 1520 L -90 1520 L -80 1610 Z" fill="#2f3854" stroke={INK} strokeWidth={6} />
      <ellipse cx={-165} cy={1565} rx={36} ry={24} fill="#4a5574" />
    </g>
  </g>
);

const AUDIENCE = [
  { x: -320, c: "#141a2c" },
  { x: -140, c: "#1b2238" },
  { x: 60, c: "#161c30" },
  { x: 1010, c: "#161c30" },
  { x: 1210, c: "#1b2238" },
  { x: 1400, c: "#141a2c" },
];

/** Tiền cảnh: lưng ghế và bóng đầu khán giả tối ở hai góc dưới, khẽ cử động. */
const Near: FC<BackgroundProps> = ({ frame }) => (
  <g>
    {AUDIENCE.map((a, i) => {
      const bob = wobble(frame, i + 11, 70) * 6;
      return (
        <g key={`a${a.x}`}>
          <circle cx={a.x + bob} cy={1730} r={58} fill={a.c} />
          <path d={`M ${a.x - 110} 2100 L ${a.x - 100} 1810 Q ${a.x} 1770 ${a.x + 100} 1810 L ${a.x + 110} 2100 Z`} fill={a.c} />
        </g>
      );
    })}
  </g>
);

/** Sân khấu hội nghị công nghệ với màn hình xanh, đèn chiếu và khán giả, bối cảnh ba lớp. */
export const asset: BackgroundAsset = {
  stage: GENERATED_WIDE_BACKGROUND_STAGE,
  Far,
  Component: Stage,
  Near,
};
