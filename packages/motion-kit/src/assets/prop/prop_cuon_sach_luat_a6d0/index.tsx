import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { clamp, easing, rnd, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const coverBase = "#3FB950";
const coverDark = "#1E7A3A";
const coverLight = "#9BF5A8";
const pageBack = "#E6DEC4";

const LEFT_PAGE = "M -72 -82 Q -36 -80 0 -72 L 0 -146 Q -36 -156 -70 -152 Z";
const RIGHT_PAGE = "M 72 -82 Q 36 -80 0 -72 L 0 -146 Q 36 -156 70 -152 Z";

const starPath = (s: number) =>
  `M 0 ${-s} L ${s * 0.3} ${-s * 0.3} L ${s} 0 L ${s * 0.3} ${s * 0.3} L 0 ${s} L ${-s * 0.3} ${s * 0.3} L ${-s} 0 L ${-s * 0.3} ${-s * 0.3} Z`;

/** Cuốn sách luật chơi bìa xanh phát sáng (tượng trưng bộ phần mềm CUDA): lật trang chậm, đốm sáng bay lên. */
const CuonSachLuat: FC<PropProps> = ({ frame, seed }) => {
  const glow = 0.5 + 0.5 * wobble(frame, seed, 50);
  const local = (frame % 150) / 150;
  const p = clamp((local - 0.2) / 0.6, 0, 1);
  const e = easing.inOut(p);
  const sx = Math.cos(Math.PI * e);
  const lift = -Math.sin(Math.PI * e) * 10;
  const settle = p >= 1 ? Math.sin((local - 0.8) * 60) * (1 - (local - 0.8) / 0.2) * 2 : 0;
  const ribbon = 4 * wobble(frame, seed + 3, 60);
  const gid = `mk-gen-book-glow-${seed}`;
  const cid = `mk-gen-book-cover-${seed}`;

  const sparks = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const ph = ((frame + i * 21) / 140) % 1;
    const x0 = rnd(seed, i) * 110 - 55;
    const x = x0 + 8 * wobble(frame, seed + i * 5, 40);
    const y = -110 - ph * 100;
    const o = Math.sin(Math.PI * ph);
    const s = 4 + rnd(seed + 9, i) * 4;
    return { x, y, o, s, i };
  });

  return (
    <g>
      <defs>
        <radialGradient id={gid} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={coverLight} stopOpacity={0.9} />
          <stop offset="100%" stopColor={coverLight} stopOpacity={0} />
        </radialGradient>
        <linearGradient id={cid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={coverLight} />
          <stop offset="45%" stopColor={coverBase} />
          <stop offset="100%" stopColor={coverDark} />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={62} />
      {/* glow halo */}
      <ellipse cx={0} cy={-120} rx={84} ry={70} fill={`url(#${gid})`} opacity={0.35 + 0.35 * glow} />
      {/* lectern stand */}
      <rect x={-50} y={-14} width={100} height={14} rx={6} fill={PALETTE.woodDark} stroke={ink} strokeWidth={5} />
      <rect x={-14} y={-64} width={28} height={52} rx={4} fill={PALETTE.wood} stroke={ink} strokeWidth={5} />
      <rect x={-9} y={-60} width={6} height={44} rx={3} fill="#FFFFFF" opacity={0.25} />
      <circle cx={-36} cy={-7} r={2.5} fill={ink} />
      <circle cx={36} cy={-7} r={2.5} fill={ink} />
      {/* covers */}
      <path d="M -82 -76 Q -40 -74 0 -62 L 0 -146 Q -40 -160 -80 -160 Z" fill={`url(#${cid})`} stroke={ink} strokeWidth={6} strokeLinejoin="round" />
      <path d="M 82 -76 Q 40 -74 0 -62 L 0 -146 Q 40 -160 80 -160 Z" fill={coverDark} stroke={ink} strokeWidth={6} strokeLinejoin="round" />
      <path d="M -76 -156 Q -50 -157 -30 -153" stroke={coverLight} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.6 + 0.4 * glow} />
      {/* pages */}
      <path d={LEFT_PAGE} fill={PALETTE.paper} stroke={ink} strokeWidth={5} strokeLinejoin="round" />
      <path d={RIGHT_PAGE} fill={pageBack} stroke={ink} strokeWidth={5} strokeLinejoin="round" />
      <path d="M 0 -72 L 0 -146" stroke={ink} strokeWidth={3} opacity={0.3} />
      {/* page decorations (chip squares + lines) */}
      <rect x={-56} y={-138} width={18} height={18} rx={3} fill={coverBase} stroke={ink} strokeWidth={3} opacity={0.6 + 0.4 * glow} />
      <rect x={-51} y={-133} width={8} height={8} rx={1.5} fill={coverLight} />
      <path d="M -32 -134 L -10 -131 M -32 -124 L -10 -121 M -60 -110 L -10 -102 M -60 -98 L -10 -90" stroke={ink} strokeWidth={3} strokeLinecap="round" opacity={0.3} />
      <path d="M 14 -132 L 56 -137 M 14 -120 L 56 -124 M 14 -108 L 44 -111 M 14 -96 L 56 -99" stroke={ink} strokeWidth={3} strokeLinecap="round" opacity={0.25} />
      <circle cx={46} cy={-104} r={6} fill={coverBase} opacity={0.5 + 0.5 * glow} />
      {/* flipping page */}
      <g transform={`translate(0 ${(lift + settle).toFixed(2)}) scale(${sx.toFixed(3)} 1)`}>
        <path d={RIGHT_PAGE} fill={sx >= 0 ? PALETTE.paper : pageBack} stroke={ink} strokeWidth={5} strokeLinejoin="round" />
        <path d="M 14 -130 L 52 -135 M 14 -118 L 52 -122 M 14 -106 L 40 -109" stroke={ink} strokeWidth={3} strokeLinecap="round" opacity={0.25} />
        <rect x={38} y={-100} width={14} height={14} rx={3} fill={coverBase} stroke={ink} strokeWidth={3} opacity={0.7} />
      </g>
      {/* bookmark ribbon */}
      <path d={`M -3 -68 L -3 -48 Q ${(-2 + ribbon).toFixed(2)} -40 ${(ribbon).toFixed(2)} -34 L ${(4 + ribbon).toFixed(2)} -40 L 4 -48 L 4 -68 Z`} fill={PALETTE.alert} stroke={ink} strokeWidth={3} strokeLinejoin="round" />
      {/* rising sparkles */}
      {sparks.map((sp) => (
        <g key={sp.i} transform={`translate(${sp.x.toFixed(2)} ${sp.y.toFixed(2)})`} opacity={sp.o.toFixed(3)}>
          <circle cx={0} cy={0} r={sp.s * 1.6} fill={coverLight} opacity={0.35} />
          <path d={starPath(sp.s)} fill={sp.i % 2 === 0 ? coverLight : "#FFFFFF"} />
        </g>
      ))}
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 86,
  height: 220,
  Component: CuonSachLuat,
};
