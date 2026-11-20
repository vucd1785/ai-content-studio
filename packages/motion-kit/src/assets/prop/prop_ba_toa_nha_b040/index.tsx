import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, rnd, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const GLOW = "#5BE37D";
const GLOW_SOFT = "#B8F5C6";

type Pt = { x: number; y: number };

const quad = (a: Pt, c: Pt, b: Pt, u: number): Pt => {
  const v = 1 - u;
  return {
    x: v * v * a.x + 2 * v * u * c.x + u * u * b.x,
    y: v * v * a.y + 2 * v * u * c.y + u * u * b.y,
  };
};

const building = (
  x: number,
  w: number,
  h: number,
  cols: number,
  rows: number,
  frame: number,
  seed: number,
  key: string,
) => {
  const left = x - w / 2;
  const top = -h;
  const winW = 8;
  const winH = 9;
  const gapX = (w - cols * winW) / (cols + 1);
  const wins = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const phase = rnd(seed, i) * 100;
      const lit = Math.sin((frame + phase) * 0.06) > -0.3;
      wins.push(
        <rect
          key={`${key}-w${i}`}
          x={left + gapX + c * (winW + gapX)}
          y={top + 16 + r * 18}
          width={winW}
          height={winH}
          rx={2}
          fill={lit ? "#FFE59A" : PALETTE.bitScreen}
          stroke={ink}
          strokeWidth={2}
        />,
      );
    }
  }
  return (
    <g key={key}>
      <rect x={left} y={top} width={w} height={h} rx={5} fill="url(#mk-gen-bldg)" stroke={ink} strokeWidth={5} />
      <rect x={left + 3} y={top + 3} width={7} height={h - 6} rx={3} fill="#FFFFFF" opacity={0.25} />
      <rect x={left + w - 11} y={top + 3} width={8} height={h - 6} rx={3} fill={ink} opacity={0.15} />
      <rect x={left - 3} y={top - 7} width={w + 6} height={9} rx={3} fill={PALETTE.metalDark} stroke={ink} strokeWidth={4} />
      {wins}
      <rect x={x - 7} y={-18} width={14} height={18} rx={2} fill={PALETTE.woodDark} stroke={ink} strokeWidth={3} />
    </g>
  );
};

const PartnerNetwork: FC<PropProps> = ({ frame, seed }) => {
  const pulse = 0.5 + 0.5 * wobble(frame, seed, 30);
  const cloudDrift = 3 * wobble(frame, seed + 3, 90);
  const cloudBob = 2 * wobble(frame, seed + 5, 60);
  const dash = -(frame * 1.2) % 24;

  const nL: Pt = { x: -62, y: -70 };
  const nC: Pt = { x: 0, y: -100 };
  const nR: Pt = { x: 62, y: -74 };
  const aL: Pt = { x: -62, y: -122 };
  const aR: Pt = { x: 62, y: -132 };
  const cTop: Pt = { x: 0, y: -224 };
  const c1: Pt = { x: -31, y: -112 };
  const c2: Pt = { x: 31, y: -114 };

  const pingPong = (period: number, off: number) => {
    const s = 0.5 + 0.5 * Math.sin(((frame + off) / period) * Math.PI * 2);
    return easing.inOut(s);
  };
  const d1 = quad(nL, c1, nC, pingPong(70, 0));
  const d2 = quad(nC, c2, nR, pingPong(70, 35));
  const d3 = quad(aL, cTop, aR, pingPong(110, 20));

  const link = (a: Pt, c: Pt, b: Pt, k: string) => {
    const d = `M ${a.x} ${a.y} Q ${c.x} ${c.y} ${b.x} ${b.y}`;
    return (
      <g key={k}>
        <path d={d} fill="none" stroke={GLOW} strokeWidth={10} strokeLinecap="round" opacity={0.18 + 0.2 * pulse} />
        <path d={d} fill="none" stroke={ink} strokeWidth={6} strokeLinecap="round" />
        <path d={d} fill="none" stroke={GLOW} strokeWidth={3.5} strokeLinecap="round" />
        <path
          d={d}
          fill="none"
          stroke={GLOW_SOFT}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray="6 18"
          strokeDashoffset={dash.toFixed(2)}
        />
      </g>
    );
  };

  const node = (p: Pt, k: string) => (
    <g key={k}>
      <circle cx={p.x} cy={p.y} r={10 + 3 * pulse} fill={GLOW} opacity={0.25} />
      <circle cx={p.x} cy={p.y} r={6} fill={GLOW} stroke={ink} strokeWidth={3} />
      <circle cx={p.x - 2} cy={p.y - 2} r={2} fill="#FFFFFF" opacity={0.8} />
    </g>
  );

  const spark = (p: Pt, k: string) => (
    <g key={k}>
      <circle cx={p.x} cy={p.y} r={8} fill={GLOW} opacity={0.35} />
      <circle cx={p.x} cy={p.y} r={4} fill="#FFFFFF" stroke={GLOW} strokeWidth={2} />
    </g>
  );

  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-bldg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8FB8E8" />
          <stop offset="1" stopColor="#4F78B0" />
        </linearGradient>
        <linearGradient id="mk-gen-cloud" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#D6E6F5" />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={88} />

      {link(aL, cTop, aR, "l3")}

      {building(-62, 42, 122, 2, 5, frame, seed + 11, "bl")}
      {building(62, 42, 132, 2, 5, frame, seed + 23, "br")}

      <line x1={0} y1={-168} x2={0} y2={-186} stroke={ink} strokeWidth={4} strokeLinecap="round" />
      <circle cx={0} cy={-189} r={7} fill={PALETTE.alert} opacity={0.3 * pulse} />
      <circle cx={0} cy={-189} r={4} fill={PALETTE.alert} stroke={ink} strokeWidth={2} />
      {building(0, 52, 162, 3, 7, frame, seed + 37, "bc")}

      <g transform={`translate(${cloudDrift.toFixed(2)} ${cloudBob.toFixed(2)})`}>
        <path
          d="M 44 -146 Q 40 -160 52 -162 Q 56 -176 70 -170 Q 82 -170 80 -158 Q 86 -150 78 -146 Z"
          fill="url(#mk-gen-cloud)"
          stroke={ink}
          strokeWidth={4}
          strokeLinejoin="round"
        />
        <ellipse cx={60} cy={-163} rx={6} ry={3} fill="#FFFFFF" opacity={0.9} />
        <line x1={62} y1={-146} x2={62} y2={-141} stroke={ink} strokeWidth={3} strokeLinecap="round" />
      </g>

      {link(nL, c1, nC, "l1")}
      {link(nC, c2, nR, "l2")}

      {node(nL, "n1")}
      {node(nC, "n2")}
      {node(nR, "n3")}
      {node(aL, "n4")}
      {node(aR, "n5")}

      {spark(d1, "s1")}
      {spark(d2, "s2")}
      {spark(d3, "s3")}
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 200,
  Component: PartnerNetwork,
};
