import type { FC, ReactNode } from "react";
import { PALETTE } from "../../../palette.js";
import { GENERATED_BACKGROUND_STAGE } from "../../../stage/generated-stage.js";
import type { BackgroundAsset, BackgroundProps } from "../../../stage/types.js";

const INK = PALETTE.ink;

const Defs: FC = () => (
  <defs>
    <linearGradient id="mk-gen-wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#f3e6cf" />
      <stop offset="1" stopColor="#e2cfae" />
    </linearGradient>
    <linearGradient id="mk-gen-ocean" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#8fd3f0" />
      <stop offset="1" stopColor="#5fb2df" />
    </linearGradient>
    <linearGradient id="mk-gen-floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#b88c5e" />
      <stop offset="1" stopColor="#8f6740" />
    </linearGradient>
    <radialGradient id="mk-gen-desert" cx="0.5" cy="0.35" r="0.6">
      <stop offset="0" stopColor="#ffe08a" />
      <stop offset="1" stopColor="#efbf5c" />
    </radialGradient>
    <linearGradient id="mk-gen-beam" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#fff2cf" stopOpacity="0.5" />
      <stop offset="1" stopColor="#fff2cf" stopOpacity="0" />
    </linearGradient>
  </defs>
);

const NILE = "M 665 770 C 645 700 685 650 660 595 S 675 510 662 462";
const AMAZON = "M 282 742 C 318 716 342 764 372 736 S 422 700 462 716";
const MEKONG = "M 838 478 C 852 508 832 530 846 560";

const GLINTS = [
  { cx: 662, cy: 640, p: 0 },
  { cx: 668, cy: 530, p: 1.7 },
  { cx: 320, cy: 735, p: 0.9 },
  { cx: 410, cy: 718, p: 2.6 },
];

function river(d: string, w: number, frame: number, key: string): ReactNode {
  return (
    <g key={key}>
      <path d={d} fill="none" stroke={INK} strokeWidth={w + 6} strokeLinecap="round" />
      <path d={d} fill="none" stroke="#2f8fd8" strokeWidth={w} strokeLinecap="round" />
      <path
        d={d}
        fill="none"
        stroke="#e8f8ff"
        strokeWidth={w * 0.4}
        strokeLinecap="round"
        strokeDasharray="10 34"
        strokeDashoffset={-frame * 0.6}
        opacity={0.85}
      />
    </g>
  );
}

const MapBg: FC<BackgroundProps> = ({ frame, lightShaft = false }) => (
  <g>
    <Defs />
    <rect x={0} y={0} width={1080} height={1580} fill="url(#mk-gen-wall)" />
    <rect x={0} y={1580} width={1080} height={1035} fill="url(#mk-gen-floor)" />
    <rect x={0} y={1560} width={1080} height={24} fill={PALETTE.woodDark} />
    {/* khung bảng */}
    <rect
      x={50}
      y={210}
      width={980}
      height={1100}
      rx={18}
      fill={PALETTE.wood}
      stroke={INK}
      strokeWidth={7}
    />
    <rect
      x={88}
      y={248}
      width={904}
      height={1024}
      fill="url(#mk-gen-ocean)"
      stroke={INK}
      strokeWidth={5}
    />
    {/* các châu lục */}
    <path
      d="M 120 330 L 330 300 L 400 360 L 360 470 L 300 540 L 250 600 L 220 560 L 170 470 L 120 420 Z"
      fill="#9ccf6a"
      stroke={INK}
      strokeWidth={5}
      strokeLinejoin="round"
    />
    <path
      d="M 300 640 L 400 620 L 470 690 L 450 800 L 400 900 L 360 1020 L 330 1050 L 320 930 L 290 800 L 270 700 Z"
      fill="#2f7d3a"
      stroke={INK}
      strokeWidth={5}
      strokeLinejoin="round"
    />
    <path
      d="M 520 330 L 640 310 L 680 380 L 600 430 L 530 420 Z"
      fill="#b6d97a"
      stroke={INK}
      strokeWidth={5}
      strokeLinejoin="round"
    />
    <path
      d="M 520 470 L 680 450 L 740 520 L 780 560 L 740 680 L 700 800 L 660 900 L 620 900 L 600 800 L 570 680 L 510 600 L 490 530 Z"
      fill="url(#mk-gen-desert)"
      stroke={INK}
      strokeWidth={5}
      strokeLinejoin="round"
    />
    <ellipse cx={640} cy={760} rx={70} ry={45} fill="#5aa64a" opacity={0.9} />
    <path
      d="M 680 300 L 960 290 L 970 450 L 900 560 L 820 560 L 760 480 L 700 420 Z"
      fill="#a8d46f"
      stroke={INK}
      strokeWidth={5}
      strokeLinejoin="round"
    />
    <ellipse cx={880} cy={870} rx={72} ry={46} fill="#f2a65a" stroke={INK} strokeWidth={5} />
    <ellipse cx={540} cy={1200} rx={360} ry={34} fill="#eef7fb" stroke={INK} strokeWidth={4} />
    {/* các dòng sông */}
    {river(NILE, 12, frame, "nile")}
    {river(AMAZON, 13, frame, "amazon")}
    {river(MEKONG, 8, frame, "mekong")}
    {GLINTS.map((g) => (
      <circle
        key={`gl${g.cx}`}
        cx={g.cx}
        cy={g.cy}
        r={6}
        fill="#ffffff"
        opacity={0.35 + 0.45 * (0.5 + 0.5 * Math.sin(frame * 0.08 + g.p))}
      />
    ))}
    {/* đinh ghim */}
    <circle cx={92} cy={250} r={12} fill="#e2574c" stroke={INK} strokeWidth={4} />
    <circle cx={988} cy={250} r={12} fill="#e2574c" stroke={INK} strokeWidth={4} />
    {/* bóng dưới bảng */}
    <rect x={70} y={1310} width={940} height={14} fill="#000" opacity={0.12} />
    {lightShaft ? (
      <polygon points="700,0 960,0 1080,1580 520,1580" fill="url(#mk-gen-beam)" />
    ) : null}
  </g>
);

const Component: FC<BackgroundProps> = (props) => <MapBg {...props} />;

export const asset: BackgroundAsset = { stage: GENERATED_BACKGROUND_STAGE, Component };
