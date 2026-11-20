import type { FC, ReactNode } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble } from "../../../rig/math.js";
import { GENERATED_WIDE_BACKGROUND_STAGE } from "../../../stage/generated-stage.js";
import type { BackgroundAsset, BackgroundProps } from "../../../stage/types.js";

const INK = PALETTE.ink;
/** Vùng vẽ: rộng hơn khung dọc 440 mỗi bên cho khung ngang 16:9. */
const X0 = -440;
const WIDTH = 1960;
const PIPE_BLUE = "#3f8fd8";
const PIPE_LIGHT = "#8cc8f5";

const Defs: FC = () => (
  <defs>
    <linearGradient id="mk-gen-wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#cfd8e2" />
      <stop offset="0.55" stopColor="#e2e8ee" />
      <stop offset="1" stopColor="#d3dbe3" />
    </linearGradient>
    <linearGradient id="mk-gen-floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#c3ccd5" />
      <stop offset="1" stopColor="#8f9ba8" />
    </linearGradient>
    <radialGradient id="mk-gen-glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor="#ffb057" stopOpacity="0.75" />
      <stop offset="1" stopColor="#ffb057" stopOpacity="0" />
    </radialGradient>
    <linearGradient id="mk-gen-pipe" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor={PIPE_LIGHT} />
      <stop offset="0.45" stopColor={PIPE_BLUE} />
      <stop offset="1" stopColor="#2a6aa8" />
    </linearGradient>
    <linearGradient id="mk-gen-tank" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stopColor="#e4ebf2" />
      <stop offset="0.35" stopColor="#c2ced9" />
      <stop offset="1" stopColor="#8796a6" />
    </linearGradient>
  </defs>
);

/** Một tủ máy chủ: thân xám, khe đèn cam ấm nhấp nháy lệch nhịp, quầng cam phía sau. */
function rack(
  key: string,
  x: number,
  top: number,
  w: number,
  h: number,
  frame: number,
  muted: boolean,
): ReactNode {
  const pulse = 0.75 + 0.25 * Math.sin(frame / 24 + x / 90);
  const body = muted ? "#a3aebb" : PALETTE.metalDark;
  const rows = [0.18, 0.36, 0.54, 0.72];
  return (
    <g key={key}>
      <ellipse
        cx={x + w / 2}
        cy={top + h * 0.5}
        rx={w * 0.95}
        ry={h * 0.55}
        fill="url(#mk-gen-glow)"
        opacity={(muted ? 0.45 : 0.7) * pulse}
      />
      <rect x={x} y={top} width={w} height={h} rx={14} fill={body} stroke={INK} strokeWidth={muted ? 5 : 7} />
      <rect x={x + 10} y={top + 10} width={w * 0.18} height={h - 20} rx={6} fill="#ffffff" opacity={0.18} />
      {rows.map((r, i) => {
        const blink = 0.55 + 0.45 * Math.sin(frame / 7 + i * 1.3 + x / 50);
        return (
          <g key={`${key}-r${i}`}>
            <rect
              x={x + w * 0.16}
              y={top + h * r}
              width={w * 0.68}
              height={h * 0.1}
              rx={6}
              fill={muted ? "#7d8896" : "#3a4552"}
            />
            <rect
              x={x + w * 0.22}
              y={top + h * r + h * 0.035}
              width={w * 0.4}
              height={h * 0.03}
              rx={3}
              fill="#ffa64d"
              opacity={blink * (muted ? 0.7 : 1)}
            />
            <circle
              cx={x + w * 0.74}
              cy={top + h * r + h * 0.05}
              r={muted ? 5 : 7}
              fill={i % 2 === 0 ? PALETTE.ok : "#ffd166"}
              opacity={blink}
            />
          </g>
        );
      })}
    </g>
  );
}

/** Đồng hồ đo nhiệt tròn, kim dao động nhẹ quanh vùng nóng. */
function gauge(key: string, cx: number, cy: number, r: number, frame: number, seed: number): ReactNode {
  const ang = 25 + wobble(frame, seed, 80) * 22;
  return (
    <g key={key}>
      <circle cx={cx} cy={cy} r={r} fill={PALETTE.paper} stroke={INK} strokeWidth={7} />
      <path
        d={`M ${cx - r * 0.7} ${cy + r * 0.25} A ${r * 0.72} ${r * 0.72} 0 0 1 ${cx - r * 0.1} ${cy - r * 0.7}`}
        fill="none"
        stroke={PALETTE.ok}
        strokeWidth={r * 0.14}
      />
      <path
        d={`M ${cx + r * 0.1} ${cy - r * 0.7} A ${r * 0.72} ${r * 0.72} 0 0 1 ${cx + r * 0.7} ${cy + r * 0.25}`}
        fill="none"
        stroke={PALETTE.alert}
        strokeWidth={r * 0.14}
      />
      <g transform={`rotate(${ang.toFixed(2)} ${cx} ${cy})`}>
        <path d={`M ${cx - 5} ${cy} L ${cx} ${cy - r * 0.78} L ${cx + 5} ${cy} Z`} fill={INK} />
      </g>
      <circle cx={cx} cy={cy} r={r * 0.12} fill={INK} />
    </g>
  );
}

const BACK_RACKS = [-400, -170, 220, 440, 660, 880, 1100, 1330];

/** Lớp xa: tường phòng máy, trần, dãy tủ máy chủ nhạt, hai ống nước xanh chảy dọc tường và đồng hồ treo tường. */
const Far: FC<BackgroundProps> = ({ frame }) => {
  const flow = (-frame * 4) % 100;
  return (
    <g>
      <Defs />
      <rect x={X0} y={0} width={WIDTH} height={2615} fill="url(#mk-gen-wall)" />
      <rect x={X0} y={0} width={WIDTH} height={250} fill="#b4c0cd" />
      <rect x={X0} y={236} width={WIDTH} height={18} fill="#9aa8b7" />
      {[-300, 0, 300, 600, 900, 1200].map((x) => (
        <rect key={`lamp${x}`} x={x} y={150} width={180} height={30} rx={12} fill="#fbfdff" opacity={0.85} />
      ))}
      {BACK_RACKS.map((x) => (
        <rect key={`drop${x}`} x={x + 80} y={420} width={30} height={460} fill={PIPE_LIGHT} stroke={INK} strokeWidth={4} opacity={0.75} />
      ))}
      <rect x={X0} y={350} width={WIDTH} height={46} fill="url(#mk-gen-pipe)" stroke={INK} strokeWidth={5} />
      <rect x={X0} y={420} width={WIDTH} height={36} fill="url(#mk-gen-pipe)" stroke={INK} strokeWidth={5} opacity={0.9} />
      <line
        x1={X0}
        y1={366}
        x2={1520}
        y2={366}
        stroke="#ffffff"
        strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray="40 60"
        strokeDashoffset={flow}
        opacity={0.55}
      />
      <line
        x1={X0}
        y1={434}
        x2={1520}
        y2={434}
        stroke="#ffffff"
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray="30 70"
        strokeDashoffset={-flow}
        opacity={0.45}
      />
      {BACK_RACKS.map((x) => rack(`br${x}`, x, 870, 190, 630, frame, true))}
      {gauge("wg", 1080, 640, 64, frame, 7)}
      <rect x={X0} y={1490} width={WIDTH} height={24} fill="#a9b5c2" />
    </g>
  );
};

/** Lớp giữa: sàn phòng máy, tủ máy chủ lớn bên trái, bồn chứa, máy bơm và đồng hồ bên phải. */
const Room: FC<BackgroundProps> = ({ frame }) => {
  const fan = (frame * 7) % 360;
  const wave = Math.sin(frame / 14) * 8;
  const level = 1300 + wobble(frame, 3, 120) * 10;
  const flow = (-frame * 5) % 90;
  return (
    <g>
      <Defs />
      <path
        d={`M ${X0} 1510 L 1520 1510 L 1520 2615 L ${X0} 2615 Z`}
        fill="url(#mk-gen-floor)"
        stroke={INK}
        strokeWidth={6}
      />
      {[1660, 1820, 2030, 2300].map((y) => (
        <line key={`h${y}`} x1={X0} y1={y} x2={1520} y2={y} stroke="#7d8995" strokeWidth={4} opacity={0.35} />
      ))}
      {[-600, -200, 200, 540, 880, 1280, 1680].map((x) => (
        <line key={`v${x}`} x1={540 + (x - 540) * 0.3} y1={1510} x2={x} y2={2615} stroke="#7d8995" strokeWidth={4} opacity={0.3} />
      ))}
      <ellipse cx={-60} cy={1572} rx={300} ry={26} fill="#000" opacity={0.16} />
      <ellipse cx={1120} cy={1572} rx={300} ry={26} fill="#000" opacity={0.16} />
      {/* ống xanh từ trần xuống tủ */}
      <rect x={60} y={300} width={40} height={600} fill="url(#mk-gen-pipe)" stroke={INK} strokeWidth={6} />
      <rect x={-200} y={300} width={40} height={600} fill="url(#mk-gen-pipe)" stroke={INK} strokeWidth={6} />
      {rack("r1", -320, 880, 220, 690, frame, false)}
      {rack("r2", -40, 880, 220, 690, frame, false)}
      {/* ống nối tủ sang bồn chạy dưới chân tường */}
      <rect x={180} y={1478} width={760} height={30} fill="url(#mk-gen-pipe)" stroke={INK} strokeWidth={5} />
      <line
        x1={180}
        y1={1492}
        x2={940}
        y2={1492}
        stroke="#ffffff"
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray="30 60"
        strokeDashoffset={flow}
        opacity={0.5}
      />
      {/* bồn chứa */}
      <rect x={920} y={1020} width={210} height={550} rx={60} fill="url(#mk-gen-tank)" stroke={INK} strokeWidth={7} />
      <ellipse cx={1025} cy={1040} rx={90} ry={22} fill="#eef3f8" stroke={INK} strokeWidth={5} />
      <rect x={960} y={1160} width={56} height={340} rx={20} fill="#e9f4fd" stroke={INK} strokeWidth={5} />
      <path
        d={`M 964 ${level} Q 976 ${(level - wave).toFixed(1)} 988 ${level} Q 1000 ${(level + wave).toFixed(1)} 1012 ${level} L 1012 1494 Q 988 1498 964 1494 Z`}
        fill={PIPE_BLUE}
        opacity={0.85}
      />
      {gauge("tg", 1082, 1180, 46, frame, 11)}
      {/* ống từ bồn sang bơm và lên tường */}
      <rect x={1125} y={1440} width={110} height={34} fill="url(#mk-gen-pipe)" stroke={INK} strokeWidth={5} />
      <rect x={1388} y={300} width={40} height={1130} fill="url(#mk-gen-pipe)" stroke={INK} strokeWidth={6} />
      {/* máy bơm */}
      <rect x={1220} y={1380} width={220} height={190} rx={30} fill={PALETTE.metal} stroke={INK} strokeWidth={7} />
      <rect x={1232} y={1392} width={70} height={18} rx={9} fill="#ffffff" opacity={0.4} />
      <circle cx={1300} cy={1478} r={58} fill="#5d6b7a" stroke={INK} strokeWidth={6} />
      <g transform={`rotate(${fan.toFixed(1)} 1300 1478)`}>
        {[0, 120, 240].map((a) => (
          <ellipse key={`fb${a}`} cx={1300} cy={1450} rx={14} ry={28} fill="#cdd7e1" transform={`rotate(${a} 1300 1478)`} />
        ))}
      </g>
      <circle cx={1300} cy={1478} r={11} fill={INK} />
      <circle cx={1400} cy={1420} r={10} fill={PALETTE.ok} opacity={0.6 + 0.4 * Math.sin(frame / 9)} />
    </g>
  );
};

/** Tiền cảnh: bó dây cáp, góc tủ và van ống tối màu ở hai góc dưới; kit làm mờ lớp này. */
const Near: FC<BackgroundProps> = ({ frame }) => {
  const sway = Math.sin(frame / 30) * 6;
  return (
    <g>
      <rect x={-430} y={1700} width={250} height={915} rx={24} fill="#1f2a36" />
      <path
        d={`M -180 2615 Q -160 2000 ${(-40 + sway).toFixed(1)} 1760 Q 0 1700 60 1720 L 90 1760 Q 20 1780 ${(-10 + sway).toFixed(1)} 1820 Q -100 2050 -90 2615 Z`}
        fill="#263445"
      />
      <path d="M -60 2615 Q 40 2200 140 2080 L 150 2130 Q 70 2260 20 2615 Z" fill="#2d3c4e" />
      <rect x={1180} y={1720} width={300} height={895} rx={24} fill="#1f2a36" />
      <circle cx={1060} cy={1960} r={110} fill="none" stroke="#263445" strokeWidth={34} />
      <rect x={940} y={2040} width={260} height={70} rx={20} fill="#263445" />
    </g>
  );
};

/** Phòng làm mát bằng chất lỏng của trung tâm dữ liệu, bối cảnh ba lớp. */
export const asset: BackgroundAsset = {
  stage: GENERATED_WIDE_BACKGROUND_STAGE,
  Far,
  Component: Room,
  Near,
};
