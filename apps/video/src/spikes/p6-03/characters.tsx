/**
 * Spike P6-03: nhân vật Tí và Bit chuyển từ bản phác `docs/design/characters/sheet.html` sang JSX.
 * Chỉ để đo chi phí render. Motion kit thật làm ở P6-05.
 */
import type { FC, ReactNode } from "react";

type Pt = { x: number; y: number };
export type LimbAngles = readonly [number, number];
export type Pose = {
  armA: LimbAngles;
  armB: LimbAngles;
  legA: LimbAngles;
  legB: LimbAngles;
  lean: number;
  tilt: number;
  hop: number;
};
export type Expression = "vui" | "ngacnhien" | "hoang" | "nghingo" | "dacy" | "buon";
export type SkinKey = "ti" | "bit";

const rad = (d: number) => (d * Math.PI) / 180;
/** Góc 0 = chỉ xuống, 90 = sang phải màn hình, 180 = chỉ lên. */
const step = (p: Pt, a: number, l: number): Pt => ({
  x: p.x + l * Math.sin(rad(a)),
  y: p.y + l * Math.cos(rad(a)),
});
function limb(start: Pt, [a1, a2]: LimbAngles, [l1, l2]: LimbAngles) {
  const mid = step(start, a1, l1);
  return { mid, end: step(mid, a1 + a2, l2) };
}
const pathOf = (pts: Pt[]) =>
  `M ${pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L ")}`;

export const POSES = {
  hero: {
    armA: [-40, 86],
    armB: [40, -86],
    legA: [-12, 0],
    legB: [12, 0],
    lean: 0,
    tilt: -6,
    hop: 0,
  },
  wave: { armA: [-12, 8], armB: [115, 45], legA: [-6, 0], legB: [6, 0], lean: -4, tilt: 6, hop: 0 },
  point: {
    armA: [-40, 86],
    armB: [96, -4],
    legA: [-8, 0],
    legB: [10, 0],
    lean: 4,
    tilt: 0,
    hop: 0,
  },
  celebrate: {
    armA: [-125, -25],
    armB: [125, 25],
    legA: [-28, 40],
    legB: [28, -40],
    lean: 0,
    tilt: 0,
    hop: 34,
  },
  scared: {
    armA: [-130, 64],
    armB: [130, -64],
    legA: [-18, 6],
    legB: [16, -6],
    lean: -10,
    tilt: -8,
    hop: 0,
  },
  idle: { armA: [-10, 6], armB: [10, -6], legA: [-6, 0], legB: [6, 0], lean: 0, tilt: 0, hop: 0 },
} as const satisfies Record<string, Pose>;
export type PoseKey = keyof typeof POSES;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpPair = (a: LimbAngles, b: LimbAngles, t: number): LimbAngles => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
];
export function mixPose(a: Pose, b: Pose, t: number): Pose {
  return {
    armA: lerpPair(a.armA, b.armA, t),
    armB: lerpPair(a.armB, b.armB, t),
    legA: lerpPair(a.legA, b.legA, t),
    legB: lerpPair(a.legB, b.legB, t),
    lean: lerp(a.lean, b.lean, t),
    tilt: lerp(a.tilt, b.tilt, t),
    hop: lerp(a.hop, b.hop, t),
  };
}

type FaceSpec = {
  eyes: "oval" | "big" | "wide" | "half" | "happy";
  brows: readonly [number, number, number];
  mouth: "smileOpen" | "o" | "wavy" | "flat" | "smirk" | "frown";
  look?: readonly [number, number];
  sweat?: boolean;
  tear?: boolean;
  blush?: boolean;
};
const FACES: Record<Expression, FaceSpec> = {
  vui: { eyes: "oval", brows: [-8, 8, -26], mouth: "smileOpen", blush: true },
  ngacnhien: { eyes: "big", brows: [-4, 4, -34], mouth: "o" },
  hoang: { eyes: "wide", brows: [18, -18, -28], mouth: "wavy", sweat: true },
  nghingo: { eyes: "half", brows: [14, -10, -24], mouth: "flat", look: [4, 0] },
  dacy: { eyes: "happy", brows: [0, -14, -26], mouth: "smirk" },
  buon: { eyes: "oval", brows: [-16, 16, -24], mouth: "frown", look: [0, 4], tear: true },
};

type FaceProps = {
  expr: Expression;
  ink: string;
  glow: boolean;
  scale: number;
  blink: boolean;
  mouthOpen: number | null;
};

/** `mouthOpen` khác null nghĩa là đang nói: 0..1 là độ mở miệng của frame này. */
const Face: FC<FaceProps> = ({ expr, ink, glow, scale, blink, mouthOpen }) => {
  const e = FACES[expr];
  const [lx, ly] = e.look ?? [0, 0];
  const parts: ReactNode[] = [];
  for (const side of [-1, 1] as const) {
    const x = side * 18;
    const y = -2;
    const k = `eye${side}`;
    if (blink) {
      parts.push(
        <line
          key={k}
          x1={x - 8}
          y1={y}
          x2={x + 8}
          y2={y}
          stroke={ink}
          strokeWidth={4}
          strokeLinecap="round"
        />,
      );
      continue;
    }
    switch (e.eyes) {
      case "oval":
      case "big": {
        const big = e.eyes === "big";
        parts.push(
          <ellipse
            key={k}
            cx={x + lx}
            cy={y + ly}
            rx={big ? 8 : 6.5}
            ry={big ? 11 : 9}
            fill={ink}
          />,
        );
        if (!glow)
          parts.push(
            <circle key={`${k}h`} cx={x + lx + 2.5} cy={y + ly - 3.5} r={2.4} fill="#fff" />,
          );
        break;
      }
      case "wide":
        parts.push(
          <circle
            key={k}
            cx={x}
            cy={y}
            r={11}
            fill={glow ? "none" : "#fff"}
            stroke={ink}
            strokeWidth={3}
          />,
        );
        parts.push(<circle key={`${k}p`} cx={x + lx} cy={y + ly} r={3.5} fill={ink} />);
        break;
      case "half":
        parts.push(
          <path key={k} d={`M ${x - 7 + lx} ${y} A 7 8 0 0 0 ${x + 7 + lx} ${y} Z`} fill={ink} />,
        );
        parts.push(
          <line
            key={`${k}l`}
            x1={x - 10}
            y1={y}
            x2={x + 10}
            y2={y}
            stroke={ink}
            strokeWidth={3.5}
            strokeLinecap="round"
          />,
        );
        break;
      case "happy":
        parts.push(
          <path
            key={k}
            d={`M ${x - 8} ${y + 3} Q ${x} ${y - 9} ${x + 8} ${y + 3}`}
            fill="none"
            stroke={ink}
            strokeWidth={4}
            strokeLinecap="round"
          />,
        );
        break;
    }
  }
  const [aL, aR, by] = e.brows;
  parts.push(
    <line
      key="bl"
      x1={-8}
      y1={0}
      x2={8}
      y2={0}
      stroke={ink}
      strokeWidth={4}
      strokeLinecap="round"
      transform={`translate(-18 ${by}) rotate(${aL})`}
    />,
    <line
      key="br"
      x1={-8}
      y1={0}
      x2={8}
      y2={0}
      stroke={ink}
      strokeWidth={4}
      strokeLinecap="round"
      transform={`translate(18 ${by}) rotate(${aR})`}
    />,
  );
  const mouthFill = glow ? ink : "#b8323a";
  if (mouthOpen !== null) {
    parts.push(
      <ellipse
        key="m"
        cx={0}
        cy={24}
        rx={10}
        ry={2 + 9 * mouthOpen}
        fill={mouthFill}
        stroke={ink}
        strokeWidth={3}
      />,
    );
  } else {
    switch (e.mouth) {
      case "smileOpen":
        parts.push(
          <path
            key="m"
            d="M -14 17 Q 0 38 14 17 Z"
            fill={mouthFill}
            stroke={ink}
            strokeWidth={3}
            strokeLinejoin="round"
          />,
        );
        break;
      case "o":
        parts.push(<ellipse key="m" cx={0} cy={24} rx={6} ry={8} fill={ink} />);
        break;
      case "wavy":
        parts.push(
          <path
            key="m"
            d="M -14 24 q 3.5 -5 7 0 t 7 0 t 7 0 t 7 0"
            fill="none"
            stroke={ink}
            strokeWidth={3.5}
            strokeLinecap="round"
          />,
        );
        break;
      case "flat":
        parts.push(
          <line
            key="m"
            x1={-6}
            y1={25}
            x2={12}
            y2={22}
            stroke={ink}
            strokeWidth={3.5}
            strokeLinecap="round"
          />,
        );
        break;
      case "smirk":
        parts.push(
          <path
            key="m"
            d="M -10 22 Q 4 29 15 15"
            fill="none"
            stroke={ink}
            strokeWidth={3.5}
            strokeLinecap="round"
          />,
        );
        break;
      case "frown":
        parts.push(
          <path
            key="m"
            d="M -12 29 Q 0 18 12 29"
            fill="none"
            stroke={ink}
            strokeWidth={3.5}
            strokeLinecap="round"
          />,
        );
        break;
    }
  }
  const drop = (key: string, x: number, y: number, s: number) => (
    <path
      key={key}
      d={`M ${x} ${y - 9 * s} Q ${x + 6 * s} ${y} ${x} ${y + 4 * s} Q ${x - 6 * s} ${y} ${x} ${y - 9 * s} Z`}
      fill={glow ? ink : "#6ec6ff"}
      stroke={glow ? "none" : "#2d7fb8"}
      strokeWidth={1.5}
    />
  );
  if (e.sweat) parts.push(drop("sw", 36, -26, 1.3));
  if (e.tear) parts.push(drop("te", -20, 14, 1));
  if (e.blush && !glow) {
    parts.push(
      <ellipse key="b1" cx={-30} cy={13} rx={8} ry={5} fill="#ff6f91" opacity={0.8} />,
      <ellipse key="b2" cx={30} cy={13} rx={8} ry={5} fill="#ff6f91" opacity={0.8} />,
    );
  }
  return <g transform={`scale(${scale})`}>{parts}</g>;
};

type SkinSpec = {
  hip: Pt;
  neck: Pt;
  headOffset: number;
  shoulderA: Pt;
  shoulderB: Pt;
  armLen: LimbAngles;
  legA: Pt;
  legB: Pt;
  legLen: LimbAngles;
  limbW: number;
  limbColor: string;
};

const TI: SkinSpec = {
  hip: { x: 0, y: -132 },
  neck: { x: 0, y: -236 },
  headOffset: -70,
  shoulderA: { x: -6, y: -226 },
  shoulderB: { x: 6, y: -226 },
  armLen: [56, 50],
  legA: { x: -4, y: -132 },
  legB: { x: 4, y: -132 },
  legLen: [66, 66],
  limbW: 13,
  limbColor: "#1f2a44",
};
const BIT: SkinSpec = {
  hip: { x: 0, y: -64 },
  neck: { x: 0, y: -160 },
  headOffset: -76,
  shoulderA: { x: -60, y: -136 },
  shoulderB: { x: 60, y: -136 },
  armLen: [38, 34],
  legA: { x: -26, y: -64 },
  legB: { x: 26, y: -64 },
  legLen: [30, 28],
  limbW: 12,
  limbColor: "#3a4157",
};
const OUTLINE = "#0b0d12";

export type CharacterProps = {
  skin: SkinKey;
  pose: Pose;
  expr: Expression;
  blink: boolean;
  mouthOpen: number | null;
  breathe: number;
};

export const Character: FC<CharacterProps> = ({ skin, pose, expr, blink, mouthOpen, breathe }) => {
  const s = skin === "ti" ? TI : BIT;
  const ink = s.limbColor;
  const legs: ReactNode[] = [];
  const feet: number[] = [];
  for (const [i, start, angles] of [
    [-1, s.legA, pose.legA],
    [1, s.legB, pose.legB],
  ] as const) {
    const { mid, end } = limb(start, angles, s.legLen);
    feet.push(end.y);
    legs.push(
      <path
        key={`leg${i}`}
        d={pathOf([start, mid, end])}
        fill="none"
        stroke={ink}
        strokeWidth={s.limbW + 1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />,
    );
    legs.push(
      skin === "ti" ? (
        <ellipse key={`foot${i}`} cx={end.x + i * 10} cy={end.y + 2} rx={17} ry={9} fill={ink} />
      ) : (
        <rect
          key={`foot${i}`}
          x={end.x - 18 + i * 4}
          y={end.y - 6}
          width={36}
          height={16}
          rx={8}
          fill="#e9e4da"
          stroke={OUTLINE}
          strokeWidth={4}
        />
      ),
    );
  }
  const arms: ReactNode[] = [];
  for (const [i, start, angles] of [
    [-1, s.shoulderA, pose.armA],
    [1, s.shoulderB, pose.armB],
  ] as const) {
    const { mid, end } = limb(start, angles, s.armLen);
    arms.push(
      <path
        key={`arm${i}`}
        d={pathOf([start, mid, end])}
        fill="none"
        stroke={ink}
        strokeWidth={s.limbW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />,
    );
    arms.push(
      skin === "ti" ? (
        <circle key={`hand${i}`} cx={end.x} cy={end.y} r={12} fill={ink} />
      ) : (
        <circle
          key={`hand${i}`}
          cx={end.x}
          cy={end.y}
          r={13}
          fill="#e9e4da"
          stroke={OUTLINE}
          strokeWidth={4}
        />
      ),
    );
  }
  const feetY = Math.max(...feet);
  const headY = s.neck.y + s.headOffset;
  const head =
    skin === "ti" ? (
      <>
        <path
          d="M -10 -58 Q -6 -88 12 -84 M 2 -60 Q 8 -80 24 -72"
          fill="none"
          stroke={ink}
          strokeWidth={6}
          strokeLinecap="round"
        />
        <circle cx={0} cy={0} r={62} fill="#fffaf2" stroke={ink} strokeWidth={7} />
        <Face expr={expr} ink={ink} glow={false} scale={1.2} blink={blink} mouthOpen={mouthOpen} />
      </>
    ) : (
      <>
        <line
          x1={0}
          y1={-62}
          x2={0}
          y2={-92}
          stroke="#3a4157"
          strokeWidth={6}
          strokeLinecap="round"
        />
        <circle cx={0} cy={-98} r={11} fill="#d85a30" stroke={OUTLINE} strokeWidth={4} />
        <circle cx={-82} cy={0} r={10} fill="#3a4157" stroke={OUTLINE} strokeWidth={3} />
        <circle cx={82} cy={0} r={10} fill="#3a4157" stroke={OUTLINE} strokeWidth={3} />
        <rect
          x={-80}
          y={-64}
          width={160}
          height={128}
          rx={32}
          fill="#e9e4da"
          stroke={OUTLINE}
          strokeWidth={5}
        />
        <rect x={-64} y={-48} width={128} height={96} rx={20} fill="#0b1220" />
        <Face expr={expr} ink="#8fe9ff" glow scale={1.15} blink={blink} mouthOpen={mouthOpen} />
      </>
    );
  const torso =
    skin === "ti" ? (
      <>
        <line
          x1={s.hip.x}
          y1={s.hip.y}
          x2={s.neck.x}
          y2={s.neck.y + 6}
          stroke={ink}
          strokeWidth={15}
          strokeLinecap="round"
        />
        <path
          d={`M 18 ${s.neck.y + 10} q 30 6 44 30 q -16 2 -26 -10 z`}
          fill="#f26b3a"
          stroke={ink}
          strokeWidth={4}
          strokeLinejoin="round"
        />
        <rect
          x={-30}
          y={s.neck.y - 6}
          width={60}
          height={20}
          rx={10}
          fill="#f26b3a"
          stroke={ink}
          strokeWidth={4}
        />
      </>
    ) : (
      <>
        <rect
          x={-56}
          y={-158}
          width={112}
          height={100}
          rx={24}
          fill="#e9e4da"
          stroke={OUTLINE}
          strokeWidth={5}
        />
        <circle cx={0} cy={-108} r={12} fill="#d85a30" stroke={OUTLINE} strokeWidth={4} />
      </>
    );
  return (
    <g>
      <ellipse
        cx={0}
        cy={pose.hop + 4}
        rx={70 - pose.hop * 0.6}
        ry={10}
        fill="#000"
        opacity={0.18}
      />
      <g transform={`translate(0 ${-feetY - pose.hop})`}>
        {legs}
        <g transform={`rotate(${pose.lean} ${s.hip.x} ${s.hip.y}) translate(0 ${breathe})`}>
          {torso}
          {arms}
          <g transform={`rotate(${pose.tilt} ${s.neck.x} ${s.neck.y}) translate(0 ${headY})`}>
            {head}
          </g>
        </g>
      </g>
    </g>
  );
};
