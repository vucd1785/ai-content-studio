import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, lerp, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const CELL = 19;
const BACK = -108;
const ROW = 7.5;

const scaleAt = (v: number): number => 0.72 + (0.28 * v) / 8;
const projX = (u: number, v: number): number => (u - 4) * CELL * scaleAt(v);
const projY = (v: number): number => BACK + v * ROW;
const pt = (u: number, v: number): string =>
  `${projX(u, v).toFixed(2)} ${projY(v).toFixed(2)}`;
const quad = (u0: number, v0: number, u1: number, v1: number): string =>
  `M${pt(u0, v0)} L${pt(u1, v0)} L${pt(u1, v1)} L${pt(u0, v1)} Z`;

type Kind = "pawn" | "rook" | "king";

type PieceProps = {
  kind: Kind;
  white: boolean;
  x: number;
  y: number;
  k: number;
  rot: number;
  sy: number;
};

const BASE = "M-10 0 Q-10 -6 -6 -6 L6 -6 Q10 -6 10 0 Z";

const Piece: FC<PieceProps> = ({ kind, white, x, y, k, rot, sy }) => {
  const fill = white ? "#F7F3EA" : "#34374A";
  const hi = white ? "#FFFFFF" : "#6A7090";
  const shade = white ? "#D6CAB2" : "#1C1E2B";
  const sw = 2.4;
  return (
    <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`}>
      <ellipse cx={0} cy={0} rx={11 * k} ry={3.5 * k} fill={ink} opacity={0.22} />
      <g transform={`rotate(${rot.toFixed(2)}) scale(${k.toFixed(3)} ${(k * sy).toFixed(3)})`}>
        {kind === "pawn" && (
          <g>
            <path d="M-6 -6 L-3 -18 L3 -18 L6 -6 Z" fill={fill} stroke={ink} strokeWidth={sw} strokeLinejoin="round" />
            <path d="M2 -7 L1.5 -17 L3 -17 L5.5 -7 Z" fill={shade} />
            <ellipse cx={0} cy={-18} rx={5.5} ry={2.2} fill={fill} stroke={ink} strokeWidth={sw} />
            <circle cx={0} cy={-24} r={6} fill={fill} stroke={ink} strokeWidth={sw} />
            <circle cx={-2.2} cy={-26} r={2} fill={hi} opacity={0.9} />
          </g>
        )}
        {kind === "rook" && (
          <g>
            <path d="M-7 -6 L-6 -24 L6 -24 L7 -6 Z" fill={fill} stroke={ink} strokeWidth={sw} strokeLinejoin="round" />
            <path d="M3 -7 L3 -23 L5.5 -23 L6.5 -7 Z" fill={shade} />
            <path
              d="M-8 -24 L-8 -32 L-4.5 -32 L-4.5 -29 L-1.5 -29 L-1.5 -32 L1.5 -32 L1.5 -29 L4.5 -29 L4.5 -32 L8 -32 L8 -24 Z"
              fill={fill}
              stroke={ink}
              strokeWidth={sw}
              strokeLinejoin="round"
            />
            <rect x={-4.5} y={-21} width={2} height={11} rx={1} fill={hi} opacity={0.8} />
          </g>
        )}
        {kind === "king" && (
          <g>
            <path d="M-7 -6 L-4 -26 L4 -26 L7 -6 Z" fill={fill} stroke={ink} strokeWidth={sw} strokeLinejoin="round" />
            <path d="M2 -7 L2 -25 L4 -25 L6.5 -7 Z" fill={shade} />
            <path d="M-5.5 -29 Q0 -38 5.5 -29 Z" fill={fill} stroke={ink} strokeWidth={sw} strokeLinejoin="round" />
            <ellipse cx={0} cy={-28} rx={7} ry={3} fill={fill} stroke={ink} strokeWidth={sw} />
            <rect x={-1.6} y={-44} width={3.2} height={9} rx={1} fill={PALETTE.warn} stroke={ink} strokeWidth={1.6} />
            <rect x={-4.5} y={-41.5} width={9} height={3.2} rx={1} fill={PALETTE.warn} stroke={ink} strokeWidth={1.6} />
            <rect x={-3.6} y={-23} width={1.8} height={13} rx={0.9} fill={hi} opacity={0.8} />
          </g>
        )}
        <path d={BASE} fill={fill} stroke={ink} strokeWidth={sw} strokeLinejoin="round" />
        <path d="M-7 -3 Q-7 -4.5 -4 -4.5 L0 -4.5" fill="none" stroke={hi} strokeWidth={1.4} strokeLinecap="round" opacity={0.8} />
      </g>
    </g>
  );
};

type Spec = { kind: Kind; white: boolean; u: number; v: number; mover: boolean };

const STATIC: Spec[] = [
  { kind: "rook", white: false, u: 1, v: 1, mover: false },
  { kind: "king", white: false, u: 4, v: 0, mover: false },
  { kind: "pawn", white: false, u: 2, v: 2, mover: false },
  { kind: "pawn", white: false, u: 5, v: 2, mover: false },
  { kind: "rook", white: true, u: 6, v: 7, mover: false },
  { kind: "pawn", white: true, u: 1, v: 6, mover: false },
  { kind: "king", white: true, u: 4, v: 7, mover: false },
];

const moveCurve = (l: number): number => {
  if (l < 30) return 0;
  if (l < 60) return easing.outBack(1.6)((l - 30) / 30);
  if (l < 90) return 1;
  return 1 - easing.inOut((l - 90) / 30);
};

/** Bàn cờ vua trên bàn gỗ: một quân tốt trắng tự trượt lên hai ô rồi trượt về, ô đích phát sáng. */
const ChessBoard: FC<PropProps> = ({ frame, seed }) => {
  const l = (((frame + seed * 7) % 120) + 120) % 120;
  const p = moveCurve(l);
  const vel = (moveCurve(Math.min(l + 1, 119.9)) - p) * 30;
  const moverV = lerp(6, 4, p);
  const lean = -vel * 6;
  const sy = 1 - Math.min(0.12, Math.abs(vel) * 0.05) + 0.02 * wobble(frame, seed + 3, 40);
  const glow = 0.5 + 0.5 * wobble(frame, seed + 11, 24);
  const twinkle = 0.5 + 0.5 * wobble(frame, seed + 5, 18);

  let light = "";
  let dark = "";
  for (let i = 0; i < 8; i += 1) {
    for (let j = 0; j < 8; j += 1) {
      const d = quad(i, j, i + 1, j + 1);
      if ((i + j) % 2 === 0) light += d;
      else dark += d;
    }
  }

  const pieces: Spec[] = STATIC.concat([
    { kind: "pawn", white: true, u: 3, v: moverV, mover: true },
  ]).sort((a, b) => a.v - b.v);

  const m = 0.45;
  const frontY = projY(8 + m);
  const fl = projX(-m, 8 + m);
  const fr = projX(8 + m, 8 + m);

  return (
    <g>
      <ContactShadow halfWidth={84} />
      <defs>
        <linearGradient id="mk-gen-chess-frame" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#B07A4A" />
          <stop offset="1" stopColor={PALETTE.woodDark} />
        </linearGradient>
        <linearGradient id="mk-gen-chess-sheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity={0.35} />
          <stop offset="0.6" stopColor="#FFFFFF" stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* chân bàn */}
      <rect x={-72} y={-28} width={11} height={28} rx={3} fill={PALETTE.woodDark} stroke={ink} strokeWidth={5} />
      <rect x={61} y={-28} width={11} height={28} rx={3} fill={PALETTE.woodDark} stroke={ink} strokeWidth={5} />
      {/* mặt bàn */}
      <rect x={-86} y={-38} width={172} height={12} rx={5} fill={PALETTE.wood} stroke={ink} strokeWidth={5} />
      <rect x={-80} y={-35} width={60} height={3} rx={1.5} fill="#FFFFFF" opacity={0.35} />
      {/* thành bàn cờ */}
      <path
        d={`M${fl.toFixed(2)} ${frontY.toFixed(2)} L${fr.toFixed(2)} ${frontY.toFixed(2)} L${fr.toFixed(2)} ${(frontY + 8).toFixed(2)} L${fl.toFixed(2)} ${(frontY + 8).toFixed(2)} Z`}
        fill={PALETTE.woodDark}
        stroke={ink}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <path d={quad(-m, -m, 8 + m, 8 + m)} fill="url(#mk-gen-chess-frame)" stroke={ink} strokeWidth={5} strokeLinejoin="round" />
      {/* ô cờ */}
      <path d={light} fill="#F3ECDD" />
      <path d={dark} fill="#3A3E4E" />
      <path d={quad(0, 0, 8, 8)} fill="none" stroke={ink} strokeWidth={2.5} />
      <path d={quad(0, 0, 8, 8)} fill="url(#mk-gen-chess-sheen)" />
      <path d={quad(0, 6, 8, 8)} fill={ink} opacity={0.08} />
      {/* ô đích phát sáng */}
      <path d={quad(3, 4, 4, 5)} fill={PALETTE.ok} opacity={0.25 + 0.35 * glow} />
      <path d={quad(3, 6, 4, 7)} fill={PALETTE.accent} opacity={0.15 + 0.15 * (1 - glow)} />
      {pieces.map((pc, idx) => {
        const v = pc.v + 0.5;
        const k = scaleAt(v) * 0.95;
        return (
          <Piece
            key={idx}
            kind={pc.kind}
            white={pc.white}
            x={projX(pc.u + 0.5, v)}
            y={projY(v)}
            k={k}
            rot={pc.mover ? lean : 0}
            sy={pc.mover ? sy : 1}
          />
        );
      })}
      {/* lấp lánh quanh quân đang đi */}
      <g
        transform={`translate(${(projX(3.5, moverV + 0.5) + 14).toFixed(2)} ${(projY(moverV + 0.5) - 30).toFixed(2)}) scale(${(0.5 + 0.6 * twinkle).toFixed(3)})`}
        opacity={0.4 + 0.6 * twinkle}
      >
        <path d="M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2 Z" fill={PALETTE.warn} stroke={ink} strokeWidth={1.5} strokeLinejoin="round" />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 150,
  Component: ChessBoard,
};
