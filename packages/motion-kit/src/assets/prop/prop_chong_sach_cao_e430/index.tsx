import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

type BookSpec = { h: number; w: number; x: number; color: string };

const BOOKS: BookSpec[] = [
  { h: 26, w: 130, x: -2, color: PALETTE.accent },
  { h: 22, w: 118, x: 4, color: PALETTE.leaf },
  { h: 24, w: 124, x: -6, color: PALETTE.shield },
  { h: 20, w: 110, x: 6, color: PALETTE.warn },
  { h: 24, w: 120, x: -2, color: PALETTE.alert },
  { h: 20, w: 104, x: 2, color: "#8e6bd8" },
];

const pingPong = (frame: number, period: number, offset: number): number => {
  const p = (((frame + offset) % period) + period) % period / period;
  const tri = p < 0.5 ? p * 2 : 2 - p * 2;
  return easing.inOut(tri);
};

const Sparkle: FC<{ x: number; y: number; s: number; o: number }> = ({ x, y, s, o }) => (
  <path
    d={`M${x} ${y - s} Q${x} ${y} ${x + s} ${y} Q${x} ${y} ${x} ${y + s} Q${x} ${y} ${x - s} ${y} Q${x} ${y} ${x} ${y - s} Z`}
    fill="#fff6c2"
    stroke={ink}
    strokeWidth={2}
    opacity={o}
  />
);

/** Chồng sách cao: dữ liệu để AI học, với sách, khung ảnh và nốt nhạc bay lượn phía trên. */
const BookStackData: FC<PropProps> = ({ frame, seed }) => {
  const sway = wobble(frame, seed, 90) * 1.4;
  const flap = pingPong(frame, 26, seed);
  const bobA = -6 * pingPong(frame, 64, seed + 5);
  const bobB = -7 * pingPong(frame, 72, seed + 23);
  const bobF = -5 * pingPong(frame, 58, seed + 41);
  const bobN = -8 * pingPong(frame, 80, seed + 11);
  const tiltB = 10 * wobble(frame, seed + 3, 70);
  const tiltF = -8 + 6 * wobble(frame, seed + 9, 66);
  const tiltN = 12 * wobble(frame, seed + 17, 60);
  const sp1 = 0.3 + 0.7 * pingPong(frame, 34, seed);
  const sp2 = 0.3 + 0.7 * pingPong(frame, 40, seed + 15);
  const sp3 = 0.3 + 0.7 * pingPong(frame, 46, seed + 29);

  let cum = 0;
  const stack = BOOKS.map((b, i) => {
    const top = -(cum + b.h);
    cum += b.h;
    const cx = b.x + sway * i * 0.8;
    const left = cx - b.w / 2;
    const right = cx + b.w / 2;
    return (
      <g key={i}>
        <rect x={left} y={top} width={b.w} height={b.h} rx={6} fill={b.color} />
        <rect x={left} y={top} width={b.w} height={b.h} rx={6} fill="url(#mk-gen-book-shade)" />
        <rect
          x={right - 28}
          y={top + 4}
          width={24}
          height={b.h - 8}
          rx={3}
          fill={PALETTE.paper}
          stroke={ink}
          strokeWidth={2.5}
        />
        <line x1={right - 26} y1={top + b.h / 2 - 2} x2={right - 6} y2={top + b.h / 2 - 2} stroke={ink} strokeWidth={1.5} opacity={0.35} />
        <line x1={right - 26} y1={top + b.h / 2 + 3} x2={right - 6} y2={top + b.h / 2 + 3} stroke={ink} strokeWidth={1.5} opacity={0.35} />
        <rect x={left + 12} y={top} width={5} height={b.h} fill={ink} opacity={0.22} />
        <rect x={left + 22} y={top} width={3} height={b.h} fill={ink} opacity={0.22} />
        <rect x={left + 34} y={top + b.h / 2 - 3} width={30} height={6} rx={3} fill="#ffffff" opacity={0.45} />
        <rect x={left + 6} y={top + 3} width={b.w - 40} height={4} rx={2} fill="#ffffff" opacity={0.35} />
        <rect x={left} y={top} width={b.w} height={b.h} rx={6} fill="none" stroke={ink} strokeWidth={5} />
      </g>
    );
  });

  const ly = -4 - 12 * flap;

  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-book-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity={0.3} />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity={0} />
          <stop offset="1" stopColor="#000000" stopOpacity={0.22} />
        </linearGradient>
        <linearGradient id="mk-gen-frame-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fd3ff" />
          <stop offset="1" stopColor="#d9f1ff" />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={72} />
      {stack}

      {/* luồng dữ liệu bay lên */}
      <path d="M-30 -146 Q-40 -160 -36 -172" fill="none" stroke={PALETTE.screen} strokeWidth={3} strokeLinecap="round" strokeDasharray="4 7" opacity={0.6} />
      <path d="M30 -146 Q44 -160 40 -168" fill="none" stroke={PALETTE.screen} strokeWidth={3} strokeLinecap="round" strokeDasharray="4 7" opacity={0.6} />

      {/* sách mở vỗ cánh */}
      <g transform={`translate(-40 ${(-186 + bobA).toFixed(2)})`}>
        <path d={`M0 0 L-32 ${ly} L-32 ${ly - 20} L0 -20 Z`} fill={PALETTE.accent} stroke={ink} strokeWidth={5} strokeLinejoin="round" />
        <path d={`M0 0 L32 ${ly} L32 ${ly - 20} L0 -20 Z`} fill={PALETTE.accent} stroke={ink} strokeWidth={5} strokeLinejoin="round" />
        <path d={`M0 -3 L-27 ${ly - 4} L-27 ${ly - 19} L0 -21 Z`} fill={PALETTE.paper} stroke={ink} strokeWidth={2.5} strokeLinejoin="round" />
        <path d={`M0 -3 L27 ${ly - 4} L27 ${ly - 19} L0 -21 Z`} fill={PALETTE.paper} stroke={ink} strokeWidth={2.5} strokeLinejoin="round" />
        <path d={`M-6 -10 L-22 ${ly - 9}`} stroke={ink} strokeWidth={1.5} opacity={0.35} />
        <path d={`M6 -10 L22 ${ly - 9}`} stroke={ink} strokeWidth={1.5} opacity={0.35} />
        <path d={`M-4 -16 L-14 ${ly / 2 - 16}`} stroke="#ffffff" strokeWidth={3} strokeLinecap="round" opacity={0.7} />
        <line x1={0} y1={0} x2={0} y2={-21} stroke={ink} strokeWidth={3} />
      </g>

      {/* sách nhỏ bay */}
      <g transform={`translate(36 ${(-250 + bobB).toFixed(2)}) rotate(${tiltB.toFixed(2)})`}>
        <rect x={-22} y={-14} width={44} height={28} rx={5} fill={PALETTE.leaf} />
        <rect x={-22} y={-14} width={44} height={28} rx={5} fill="url(#mk-gen-book-shade)" />
        <rect x={8} y={-10} width={10} height={20} rx={2} fill={PALETTE.paper} stroke={ink} strokeWidth={2} />
        <rect x={-16} y={-14} width={4} height={28} fill={ink} opacity={0.22} />
        <rect x={-8} y={-9} width={12} height={4} rx={2} fill="#ffffff" opacity={0.5} />
        <rect x={-22} y={-14} width={44} height={28} rx={5} fill="none" stroke={ink} strokeWidth={4} />
      </g>

      {/* khung ảnh nhỏ */}
      <g transform={`translate(50 ${(-186 + bobF).toFixed(2)}) rotate(${tiltF.toFixed(2)})`}>
        <rect x={-20} y={-17} width={40} height={34} rx={4} fill={PALETTE.wood} stroke={ink} strokeWidth={4} />
        <rect x={-13} y={-10} width={26} height={20} fill="url(#mk-gen-frame-sky)" stroke={PALETTE.woodDark} strokeWidth={2} />
        <path d="M-13 10 L-4 0 L2 6 L7 1 L13 10 Z" fill={PALETTE.leaf} />
        <circle cx={6} cy={-4} r={3} fill={PALETTE.warn} />
        <path d="M-18 -15 L-4 -15" stroke="#ffffff" strokeWidth={2.5} strokeLinecap="round" opacity={0.6} />
      </g>

      {/* nốt nhạc */}
      <g transform={`translate(-38 ${(-262 + bobN).toFixed(2)}) rotate(${tiltN.toFixed(2)})`}>
        <path d="M4 6 L4 -26 Q14 -22 18 -12 Q12 -18 4 -18" fill={PALETTE.shield} stroke={ink} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
        <ellipse cx={-3} cy={8} rx={9} ry={7} transform="rotate(-20 -3 8)" fill={PALETTE.shield} stroke={ink} strokeWidth={4} />
        <ellipse cx={-6} cy={6} rx={3} ry={2} fill="#ffffff" opacity={0.7} />
      </g>

      <Sparkle x={0} y={-215} s={7} o={sp1} />
      <Sparkle x={-70} y={-228} s={5} o={sp2} />
      <Sparkle x={70} y={-222} s={6} o={sp3} />
      <Sparkle x={8} y={-280} s={5} o={sp2} />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 85,
  height: 300,
  Component: BookStackData,
};
