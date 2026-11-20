import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

type BookSpec = {
  id: string;
  w: number;
  h: number;
  dx: number;
  color: string;
  band: string;
};

const BOOKS: BookSpec[] = [
  { id: "b0", w: 140, h: 30, dx: -2, color: "#3FA7E0", band: "#2A7DB0" },
  { id: "b1", w: 128, h: 26, dx: 6, color: "#E8574B", band: "#B23B32" },
  { id: "b2", w: 134, h: 28, dx: -5, color: "#5BBF6A", band: "#3E8E4B" },
  { id: "b3", w: 118, h: 24, dx: 3, color: "#F5C542", band: "#C99A22" },
];

/** Chồng sách giáo khoa nhiều màu với bút chì trên cùng, sách nảy nhẹ lần lượt. */
const BookStack: FC<PropProps> = ({ frame, seed }) => {
  const period = 48;
  let baseY = 0;
  let topY = 0;
  const books = BOOKS.map((b, i) => {
    const phase = (((frame - i * 3) % period) + period) % period / period;
    const hop = phase < 0.35 ? Math.sin((phase / 0.35) * Math.PI) : 0;
    const lift = easing.out(hop) * (1.5 + i * 1.6);
    const y = baseY;
    baseY -= b.h;
    topY = baseY - lift;
    return { b, y: y - lift, i };
  });
  const sway = wobble(frame, seed, 60) * 4;
  const sparkle = 0.5 + 0.5 * Math.sin(frame * 0.18);
  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-book-shade" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity={0.35} />
          <stop offset="0.55" stopColor="#FFFFFF" stopOpacity={0} />
          <stop offset="1" stopColor="#000000" stopOpacity={0.18} />
        </linearGradient>
        <linearGradient id="mk-gen-pencil" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE07A" />
          <stop offset="1" stopColor="#E8A92A" />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={74} />
      {books.map(({ b, y, i }) => {
        const x0 = b.dx - b.w / 2;
        return (
          <g key={b.id} transform={`translate(0 ${y.toFixed(2)})`}>
            <rect x={x0} y={-b.h} width={b.w} height={b.h} rx={7} fill={b.color} stroke={ink} strokeWidth={5} />
            <rect x={x0 + 14} y={-b.h + 7} width={b.w - 20} height={b.h - 14} rx={3} fill={PALETTE.paper} stroke={ink} strokeWidth={3} />
            <line x1={x0 + 20} y1={-b.h / 2 - 2} x2={x0 + b.w - 12} y2={-b.h / 2 - 2} stroke={ink} strokeOpacity={0.25} strokeWidth={2} />
            <line x1={x0 + 20} y1={-b.h / 2 + 3} x2={x0 + b.w - 12} y2={-b.h / 2 + 3} stroke={ink} strokeOpacity={0.25} strokeWidth={2} />
            <rect x={x0 + 3} y={-b.h + 3} width={8} height={b.h - 6} rx={3} fill={b.band} />
            <rect x={x0} y={-b.h} width={b.w} height={b.h} rx={7} fill="url(#mk-gen-book-shade)" />
            <rect x={x0 + 6} y={-b.h + 3} width={b.w * 0.4} height={3} rx={1.5} fill="#FFFFFF" opacity={0.5} />
            <circle cx={x0 + 7} cy={-b.h / 2} r={2.5} fill={i % 2 === 0 ? PALETTE.paper : PALETTE.warn} />
          </g>
        );
      })}
      <g transform={`translate(0 ${(topY - 9).toFixed(2)}) rotate(${(-6 + sway).toFixed(2)})`}>
        <rect x={-46} y={-8} width={78} height={16} fill="url(#mk-gen-pencil)" stroke={ink} strokeWidth={4} />
        <line x1={-46} y1={-2} x2={32} y2={-2} stroke="#FFF3C4" strokeWidth={2} opacity={0.8} />
        <line x1={-46} y1={3} x2={32} y2={3} stroke="#C98612" strokeWidth={2} opacity={0.7} />
        <rect x={-60} y={-8} width={14} height={16} fill={PALETTE.metal} stroke={ink} strokeWidth={4} />
        <rect x={-74} y={-8} width={14} height={16} rx={5} fill="#F28CA8" stroke={ink} strokeWidth={4} />
        <path d="M32 -8 L56 0 L32 8 Z" fill="#F2C99A" stroke={ink} strokeWidth={4} strokeLinejoin="round" />
        <path d="M48 -2.7 L56 0 L48 2.7 Z" fill={ink} />
      </g>
      <g transform={`translate(52 ${(topY - 40).toFixed(2)}) scale(${(0.6 + 0.5 * sparkle).toFixed(3)})`} opacity={0.4 + 0.6 * sparkle}>
        <path d="M0 -10 L3 -3 L10 0 L3 3 L0 10 L-3 3 L-10 0 L-3 -3 Z" fill={PALETTE.warn} stroke={ink} strokeWidth={2} strokeLinejoin="round" />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 80,
  height: 180,
  Component: BookStack,
};
