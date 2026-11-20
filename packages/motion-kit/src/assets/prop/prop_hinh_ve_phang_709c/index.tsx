import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const NOODLE = "#F6C945";
const NOODLE_LIGHT = "#FFE89A";
const NOODLE_DARK = "#D99A1E";

/** Sợi mì vàng rất dài được đôi đũa kéo thẳng lên khỏi bát, khẽ đung đưa vui nhộn. */
const LongNoodle: FC<PropProps> = ({ frame, seed }) => {
  const sway = 9 * wobble(frame, seed, 70);
  const phase = (Math.sin((frame / 48) * Math.PI * 2) + 1) / 2;
  const stretch = 6 * easing.inOut(phase);
  const topY = -262 - stretch;
  const topX = sway * 0.6;
  const bottomY = -44;

  const pts: string[] = [];
  const hi: string[] = [];
  const n = 28;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const y = bottomY + (topY - bottomY) * u;
    const env = 4 * u * (1 - u);
    const x =
      topX * u +
      sway * Math.sin(Math.PI * u) +
      3.5 * env * Math.sin(u * 16 + frame * 0.14 + seed);
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);
    if (i > 2 && i < n - 2) {
      hi.push(`${hi.length === 0 ? "M" : "L"}${(x - 2).toFixed(2)} ${y.toFixed(2)}`);
    }
  }
  const d = pts.join(" ");
  const dh = hi.join(" ");

  const sp1 = 0.5 + 0.5 * Math.sin(frame * 0.2 + seed);
  const sp2 = 0.5 + 0.5 * Math.sin(frame * 0.2 + seed + 2.4);

  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-noodle-bowl" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7EC8F0" />
          <stop offset="0.55" stopColor="#4FA3D9" />
          <stop offset="1" stopColor="#2F78AE" />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={64} />

      {/* chân bát */}
      <rect x={-24} y={-12} width={48} height={12} rx={4} fill="#2F78AE" stroke={ink} strokeWidth={5} />
      {/* thân bát */}
      <path
        d="M-60 -44 Q-56 -8 0 -8 Q56 -8 60 -44 Z"
        fill="url(#mk-gen-noodle-bowl)"
        stroke={ink}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <path d="M-48 -36 Q-44 -18 -24 -14" fill="none" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" opacity={0.45} />
      <path d="M-30 -24 L-18 -24 M-24 -30 L-24 -18" stroke={PALETTE.paper} strokeWidth={3} strokeLinecap="round" opacity={0.6} />
      {/* miệng bát với mì */}
      <ellipse cx={0} cy={-44} rx={60} ry={11} fill={NOODLE_DARK} stroke={ink} strokeWidth={6} />
      <path d="M-44 -46 Q-34 -52 -24 -45 Q-14 -38 -4 -46 Q8 -53 18 -45 Q28 -38 40 -46" fill="none" stroke={NOODLE} strokeWidth={5} strokeLinecap="round" />
      <path d="M-36 -40 Q-24 -36 -12 -41 Q2 -45 14 -40 Q26 -36 34 -40" fill="none" stroke={NOODLE_LIGHT} strokeWidth={3} strokeLinecap="round" opacity={0.8} />

      {/* sợi mì dài */}
      <path d={d} fill="none" stroke={ink} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={NOODLE} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={NOODLE_DARK} strokeWidth={3} strokeLinecap="round" opacity={0.35} transform="translate(2 0)" />
      <path d={dh} fill="none" stroke={NOODLE_LIGHT} strokeWidth={2.5} strokeLinecap="round" opacity={0.9} />

      {/* đũa */}
      <g transform={`translate(${topX.toFixed(2)} ${topY.toFixed(2)})`}>
        <line x1={-10} y1={-6} x2={62} y2={-48} stroke={ink} strokeWidth={11} strokeLinecap="round" />
        <line x1={-10} y1={-6} x2={62} y2={-48} stroke={PALETTE.wood} strokeWidth={5} strokeLinecap="round" />
        <line x1={-10} y1={8} x2={66} y2={-30} stroke={ink} strokeWidth={11} strokeLinecap="round" />
        <line x1={-10} y1={8} x2={66} y2={-30} stroke={PALETTE.woodDark} strokeWidth={5} strokeLinecap="round" />
        <line x1={44} y1={-37} x2={58} y2={-45} stroke={PALETTE.alert} strokeWidth={5} strokeLinecap="round" />
        <line x1={48} y1={-21} x2={62} y2={-28} stroke={PALETTE.alert} strokeWidth={5} strokeLinecap="round" />
        <circle cx={-2} cy={1} r={6} fill={NOODLE} stroke={ink} strokeWidth={3} />
      </g>

      {/* lấp lánh */}
      <g transform={`translate(-40 -190) scale(${(0.6 + 0.5 * sp1).toFixed(3)})`} opacity={0.4 + 0.6 * sp1}>
        <path d="M0 -10 L3 -3 L10 0 L3 3 L0 10 L-3 3 L-10 0 L-3 -3 Z" fill={PALETTE.warn} stroke={ink} strokeWidth={2.5} strokeLinejoin="round" />
      </g>
      <g transform={`translate(38 -130) scale(${(0.6 + 0.5 * sp2).toFixed(3)})`} opacity={0.4 + 0.6 * sp2}>
        <path d="M0 -8 L2.5 -2.5 L8 0 L2.5 2.5 L0 8 L-2.5 2.5 L-8 0 L-2.5 -2.5 Z" fill={NOODLE_LIGHT} stroke={ink} strokeWidth={2.5} strokeLinejoin="round" />
      </g>
      <circle cx={-30} cy={-110} r={3.5} fill={PALETTE.paper} opacity={0.3 + 0.6 * sp2} />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 75,
  height: 320,
  Component: LongNoodle,
};
