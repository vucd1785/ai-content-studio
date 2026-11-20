import type { FC, ReactNode } from "react";
import { PALETTE } from "../../../palette.js";
import { rnd } from "../../../rig/math.js";
import { GENERATED_WIDE_BACKGROUND_STAGE } from "../../../stage/generated-stage.js";
import type { BackgroundAsset, BackgroundProps } from "../../../stage/types.js";

const INK = PALETTE.ink;
/** Vùng vẽ: rộng hơn khung dọc 440 mỗi bên cho khung ngang 16:9. */
const X0 = -440;
const WIDTH = 1960;
const H = 2615;

const Defs: FC = () => (
  <defs>
    <linearGradient id="mk-gen-pad-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#0e1636" />
      <stop offset="0.45" stopColor="#1f2c5c" />
      <stop offset="0.62" stopColor="#3b4c82" />
      <stop offset="1" stopColor="#56679a" />
    </linearGradient>
    <radialGradient id="mk-gen-pad-moon" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor="#fdf6d0" stopOpacity="0.55" />
      <stop offset="1" stopColor="#fdf6d0" stopOpacity="0" />
    </radialGradient>
    <linearGradient id="mk-gen-pad-ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#7d859f" />
      <stop offset="1" stopColor="#3f4661" />
    </linearGradient>
    <linearGradient id="mk-gen-pad-beam" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#fff4c2" stopOpacity="0.55" />
      <stop offset="1" stopColor="#fff4c2" stopOpacity="0" />
    </linearGradient>
    <linearGradient id="mk-gen-pad-steel" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stopColor="#c9563f" />
      <stop offset="1" stopColor="#8e3528" />
    </linearGradient>
  </defs>
);

/** Ngôi sao nhỏ, nhấp nháy lệch nhịp theo frame. */
function stars(frame: number): ReactNode[] {
  const out: ReactNode[] = [];
  for (let i = 0; i < 46; i++) {
    const x = X0 + rnd(31, i) * WIDTH;
    const y = 40 + rnd(57, i) * 1150;
    const r = 2.5 + rnd(73, i) * 4;
    const tw = 0.55 + 0.45 * Math.sin(frame / (14 + rnd(91, i) * 18) + i * 1.9);
    out.push(<circle key={`s${i}`} cx={x.toFixed(1)} cy={y.toFixed(1)} r={r.toFixed(1)} fill="#fffbe6" opacity={tw.toFixed(2)} />);
  }
  return out;
}

/** Lớp xa: trời đêm, trăng, sao lấp lánh, tháp phóng xa mờ và đồi nhạt dần. */
const Far: FC<BackgroundProps> = ({ frame }) => (
  <g>
    <Defs />
    <rect x={X0} y={0} width={WIDTH} height={H} fill="url(#mk-gen-pad-sky)" />
    {stars(frame)}
    <circle cx={250} cy={360} r={260} fill="url(#mk-gen-pad-moon)" />
    <circle cx={250} cy={360} r={86} fill="#f6f0cf" />
    <circle cx={280} cy={390} r={80} fill="#e2dbb6" opacity={0.6} />
    <circle cx={222} cy={334} r={16} fill="#ddd5ac" />
    <circle cx={270} cy={398} r={11} fill="#ddd5ac" />
    <g opacity={0.55} fill="#6a7aab">
      <rect x={-300} y={1000} width={34} height={400} />
      <rect x={-266} y={1060} width={60} height={10} />
      <rect x={-262} y={1150} width={50} height={10} />
      <circle cx={-283} cy={990} r={8} fill="#ff8a7a" opacity={0.5 + 0.5 * Math.sin(frame / 12)} />
    </g>
    <path
      d={`M ${X0} 1380 Q -160 1270 160 1350 Q 470 1250 780 1345 Q 1090 1260 1350 1340 Q 1450 1310 1520 1340 L 1520 ${H} L ${X0} ${H} Z`}
      fill="#4c5c8d"
    />
    <path
      d={`M ${X0} 1450 Q -200 1390 120 1430 Q 420 1370 700 1440 Q 1000 1380 1280 1430 Q 1420 1400 1520 1430 L 1520 ${H} L ${X0} ${H} Z`}
      fill="#3d4b78"
    />
  </g>
);

/** Một cụm khói trắng tròn, trôi chậm sang trái và lặp lại. */
function smoke(key: string, x: number, y: number, s: number, frame: number, speed: number): ReactNode {
  const cx = X0 + ((((x - X0 - frame * speed) % WIDTH) + WIDTH) % WIDTH);
  const puff = 1 + Math.sin(frame / 30 + x) * 0.04;
  return (
    <g key={key} transform={`translate(${cx.toFixed(1)} ${y}) scale(${(s * puff).toFixed(3)})`} opacity={0.82}>
      <ellipse cx={0} cy={0} rx={130} ry={50} fill={PALETTE.smoke} />
      <ellipse cx={-60} cy={-30} rx={70} ry={50} fill={PALETTE.smoke} />
      <ellipse cx={40} cy={-44} rx={80} ry={58} fill="#f4f6fb" />
      <ellipse cx={20} cy={18} rx={115} ry={24} fill="#c3c9d8" opacity={0.7} />
    </g>
  );
}

/** Cột đèn pha: cột thép, đầu đèn bốn bóng, chùm sáng chập chờn nhẹ. */
function floodlight(key: string, x: number, dir: number, frame: number): ReactNode {
  const flick = 0.75 + 0.1 * Math.sin(frame / 9 + x) + 0.06 * Math.sin(frame / 3.7 + x * 2);
  return (
    <g key={key}>
      <path
        d={`M ${x + dir * 20} 760 L ${x + dir * 760} 1600 L ${x + dir * 140} 1600 Z`}
        fill="url(#mk-gen-pad-beam)"
        opacity={(flick * 0.55).toFixed(2)}
      />
      <rect x={x - 12} y={760} width={24} height={800} fill={PALETTE.metalDark} stroke={INK} strokeWidth={6} />
      <rect x={x - 8} y={770} width={7} height={780} fill={PALETTE.metal} opacity={0.7} />
      <g transform={`rotate(${dir * 14} ${x} 740)`}>
        <rect x={x - 70} y={690} width={140} height={86} rx={12} fill={PALETTE.metalDark} stroke={INK} strokeWidth={6} />
        {[0, 1, 2, 3].map((i) => (
          <circle
            key={`l${i}`}
            cx={x - 36 + (i % 2) * 72}
            cy={712 + Math.floor(i / 2) * 42}
            r={17}
            fill="#fff3b8"
            opacity={flick.toFixed(2)}
            stroke={INK}
            strokeWidth={4}
          />
        ))}
      </g>
    </g>
  );
}

/** Lớp giữa: nền bê tông, bệ phóng, tháp thép, đèn pha và khói trôi. */
const Component: FC<BackgroundProps> = ({ frame }) => {
  const blink = Math.sin(frame / 10) > 0 ? 1 : 0.25;
  const braces: string[] = [];
  for (let i = 0; i < 9; i++) {
    const y = 1520 - i * 120;
    braces.push(`M 900 ${y} L 1040 ${y - 120} M 1040 ${y} L 900 ${y - 120}`);
  }
  return (
    <g>
      <Defs />
      <path
        d={`M ${X0} 1510 Q 540 1490 1520 1510 L 1520 ${H} L ${X0} ${H} Z`}
        fill="url(#mk-gen-pad-ground)"
        stroke={INK}
        strokeWidth={6}
      />
      <path d="M -60 1540 L 1140 1540 L 1200 1640 L -120 1640 Z" fill="#a3aac0" stroke={INK} strokeWidth={6} />
      <path d="M -60 1540 L 1140 1540 L 1150 1556 L -70 1556 Z" fill="#c3c8d8" />
      <path d="M -120 1640 L 1200 1640 L 1200 1680 L -120 1680 Z" fill="#6c7390" stroke={INK} strokeWidth={6} />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <path key={`h${i}`} d={`M ${-80 + i * 190} 1640 l 40 0 l 30 40 l -40 0 Z`} fill={PALETTE.warn} opacity={0.75} />
      ))}
      {smoke("m1", 1250, 1470, 1.1, frame, 0.3)}
      {smoke("m2", -150, 1460, 0.9, frame, 0.22)}
      {smoke("m3", 560, 1300, 0.6, frame, 0.18)}
      <path d="M 880 1545 L 900 420 L 1040 420 L 1060 1545 Z" fill="none" stroke={INK} strokeWidth={22} />
      <path d="M 880 1545 L 900 420 M 1060 1545 L 1040 420" stroke="url(#mk-gen-pad-steel)" strokeWidth={12} />
      <path d={braces.join(" ")} stroke="#a8432f" strokeWidth={7} fill="none" />
      {[1440, 1080, 720, 470].map((y) => (
        <rect key={`p${y}`} x={880} y={y} width={180} height={18} fill={PALETTE.metal} stroke={INK} strokeWidth={5} />
      ))}
      <path d="M 1040 820 L 1200 820 L 1200 846 L 1040 846 Z" fill={PALETTE.metalDark} stroke={INK} strokeWidth={5} />
      <rect x={955} y={360} width={30} height={60} fill={PALETTE.metalDark} stroke={INK} strokeWidth={5} />
      <circle cx={970} cy={350} r={22} fill="#ff8a7a" opacity={blink * 0.35} />
      <circle cx={970} cy={350} r={11} fill={PALETTE.alert} opacity={blink} stroke={INK} strokeWidth={3} />
      {floodlight("f1", 60, 1, frame)}
      {floodlight("f2", 1330, -1, frame)}
      {smoke("m4", 1000, 1500, 0.8, frame, 0.26)}
    </g>
  );
};

/** Tiền cảnh: khối chắn bê tông, cuộn cáp và bụi cỏ tối ở hai góc dưới; không viền vì kit làm mờ. */
const Near: FC<BackgroundProps> = ({ frame }) => {
  const sway = (i: number) => Math.sin(frame / 24 + i * 0.9) * 14;
  const blades: ReactNode[] = [];
  for (let i = 0; i < 5; i++) {
    const bx = 1300 + (i - 2) * 44;
    const tip = 260 + ((i * 47) % 100);
    const bend = sway(i) - 36 + (i - 2) * 18;
    blades.push(
      <path
        key={`g${i}`}
        d={`M ${bx - 24} 2100 Q ${bx} ${2100 - tip * 0.6} ${(bx + bend).toFixed(1)} ${2100 - tip} Q ${bx + 12} ${2100 - tip * 0.5} ${bx + 24} 2100 Z`}
        fill={i % 2 === 0 ? "#1f2a3d" : "#26334a"}
      />,
    );
  }
  return (
    <g>
      <path d="M -400 2100 L -360 1700 L 40 1700 L 90 2100 Z" fill="#232b40" />
      <path d="M -360 1700 L 40 1700 L 46 1740 L -364 1740 Z" fill="#2f3954" />
      <ellipse cx={1050} cy={1960} rx={130} ry={140} fill="#1c2336" />
      <ellipse cx={1050} cy={1960} rx={50} ry={54} fill="#2b3550" />
      {blades}
    </g>
  );
};

/** Bãi phóng tên lửa ban đêm, bối cảnh ba lớp. */
export const asset: BackgroundAsset = {
  stage: GENERATED_WIDE_BACKGROUND_STAGE,
  Far,
  Component,
  Near,
};
