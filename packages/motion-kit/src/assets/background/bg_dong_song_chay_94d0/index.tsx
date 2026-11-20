import type { FC, ReactNode } from "react";
import { PALETTE } from "../../../palette.js";
import { GENERATED_BACKGROUND_STAGE } from "../../../stage/generated-stage.js";
import type { BackgroundAsset, BackgroundProps } from "../../../stage/types.js";

const INK = PALETTE.ink;

const Defs: FC = () => (
  <defs>
    <linearGradient id="mk-gen-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#8e9bab" />
      <stop offset="1" stopColor="#c9d3dc" />
    </linearGradient>
    <linearGradient id="mk-gen-sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#6fa8c9" />
      <stop offset="1" stopColor="#3f7fa8" />
    </linearGradient>
    <linearGradient id="mk-gen-cliff" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#a3a7ad" />
      <stop offset="1" stopColor="#6f747c" />
    </linearGradient>
    <linearGradient id="mk-gen-river" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#7cc3d9" />
      <stop offset="1" stopColor="#2f86b0" />
    </linearGradient>
    <linearGradient id="mk-gen-bank" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#8f9a7a" />
      <stop offset="1" stopColor="#5f6a50" />
    </linearGradient>
    <linearGradient id="mk-gen-beam" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#f4f7fa" stopOpacity="0.5" />
      <stop offset="1" stopColor="#f4f7fa" stopOpacity="0" />
    </linearGradient>
  </defs>
);

const RIVER =
  "M 520 700 C 450 840, 690 940, 610 1100 C 530 1250, 300 1360, 360 1600 L 840 1600 C 770 1390, 870 1250, 770 1100 C 690 960, 590 820, 570 700 Z";

function flowLines(frame: number): ReactNode[] {
  const lines = [
    "M 545 720 C 500 840, 680 950, 640 1100 C 590 1260, 440 1360, 470 1560",
    "M 555 760 C 560 860, 740 980, 700 1110 C 660 1260, 580 1400, 640 1560",
    "M 560 800 C 600 900, 770 1020, 740 1150 C 700 1300, 720 1420, 760 1560",
  ];
  return lines.map((d, i) => (
    <path
      key={`fl${i}`}
      d={d}
      fill="none"
      stroke="#e8f6fb"
      strokeWidth={6 - i}
      strokeLinecap="round"
      strokeDasharray="40 70"
      strokeDashoffset={-((frame * 1.6 + i * 37) % 110)}
      opacity={0.75}
    />
  ));
}

function rain(frame: number): ReactNode[] {
  const out: ReactNode[] = [];
  for (let i = 0; i < 26; i++) {
    const x = (i * 137 + 40) % 1080;
    const y = ((i * 263 + frame * 16) % 1700) - 120;
    out.push(
      <line
        key={`r${i}`}
        x1={x}
        y1={y}
        x2={x - 10}
        y2={y + 50}
        stroke="#eef3f7"
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.55}
      />,
    );
  }
  return out;
}

const Scene: FC<BackgroundProps> = ({ frame, lightShaft = false }) => (
  <g>
    <Defs />
    <rect x={0} y={0} width={1080} height={760} fill="url(#mk-gen-sky)" />
    {/* mây mưa */}
    <ellipse cx={260} cy={140} rx={240} ry={70} fill="#7d8896" />
    <ellipse cx={800} cy={110} rx={280} ry={80} fill="#848f9c" />
    {/* biển xa */}
    <rect
      x={0}
      y={680}
      width={1080}
      height={120}
      fill="url(#mk-gen-sea)"
      stroke={INK}
      strokeWidth={5}
    />
    {/* vách đá trái */}
    <polygon
      points="-20,230 110,260 210,380 300,530 380,720 420,920 350,1110 440,1320 420,1600 -20,1600"
      fill="url(#mk-gen-cliff)"
      stroke={INK}
      strokeWidth={7}
      strokeLinejoin="round"
    />
    {/* vách đá phải */}
    <polygon
      points="1100,200 960,250 860,390 760,560 700,720 690,900 780,1100 720,1320 780,1600 1100,1600"
      fill="url(#mk-gen-cliff)"
      stroke={INK}
      strokeWidth={7}
      strokeLinejoin="round"
    />
    {/* vân đá */}
    <path
      d="M 120 420 L 200 520 L 170 640 M 60 800 L 180 900 L 260 1050 M 90 1200 L 220 1300"
      fill="none"
      stroke="#5b6068"
      strokeWidth={5}
      strokeLinecap="round"
    />
    <path
      d="M 950 420 L 870 540 L 900 660 M 1020 820 L 900 930 L 830 1060 M 990 1220 L 860 1320"
      fill="none"
      stroke="#5b6068"
      strokeWidth={5}
      strokeLinecap="round"
    />
    <polygon
      points="230,560 300,600 330,700 250,690"
      fill="#8b9098"
      stroke={INK}
      strokeWidth={5}
      strokeLinejoin="round"
    />
    <polygon
      points="820,620 760,680 790,760 860,720"
      fill="#8b9098"
      stroke={INK}
      strokeWidth={5}
      strokeLinejoin="round"
    />
    {/* dòng sông */}
    <path d={RIVER} fill="url(#mk-gen-river)" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
    {flowLines(frame)}
    {/* bờ sông (sàn) */}
    <path
      d="M -20 1570 C 200 1555, 380 1590, 540 1575 C 720 1560, 880 1590, 1100 1570 L 1100 2615 L -20 2615 Z"
      fill="url(#mk-gen-bank)"
      stroke={INK}
      strokeWidth={6}
    />
    {/* sỏi đá hai bên, tránh dải nhân vật */}
    <ellipse cx={80} cy={1640} rx={55} ry={26} fill="#9a9ea5" stroke={INK} strokeWidth={5} />
    <ellipse cx={150} cy={1700} rx={34} ry={18} fill="#878b92" stroke={INK} strokeWidth={5} />
    <ellipse cx={990} cy={1650} rx={60} ry={28} fill="#9a9ea5" stroke={INK} strokeWidth={5} />
    <ellipse cx={930} cy={1720} rx={30} ry={16} fill="#878b92" stroke={INK} strokeWidth={5} />
    <ellipse cx={540} cy={2050} rx={420} ry={40} fill="#56604a" opacity={0.35} />
    {rain(frame)}
    {lightShaft ? (
      <polygon points="430,0 650,0 820,1600 260,1600" fill="url(#mk-gen-beam)" />
    ) : null}
  </g>
);

const Component: FC<BackgroundProps> = (props) => <Scene {...props} />;

export const asset: BackgroundAsset = { stage: GENERATED_BACKGROUND_STAGE, Component };
