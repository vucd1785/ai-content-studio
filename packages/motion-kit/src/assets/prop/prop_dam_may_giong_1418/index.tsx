import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";

const ink = PALETTE.ink;
const cloudBase = "#5b6577";
const cloudLight = "#8a95a8";
const cloudDark = "#3a4152";
const glowColor = "#ffe27a";

const LOBES: ReadonlyArray<readonly [number, number, number]> = [
  [-50, -200, 32],
  [-15, -228, 40],
  [28, -222, 36],
  [58, -195, 26],
];

/** Đám mây giông xám đen lơ lửng: nhấp nhô, phồng xẹp nhẹ, ánh chớp mờ lóe bên trong. */
const StormCloud: FC<PropProps> = ({ frame, seed }) => {
  const phase = (frame % 90) / 90;
  const bob = Math.sin(phase * Math.PI * 2) * 4;
  const breathe = Math.sin(phase * Math.PI * 2 + 0.8);
  const sx = 1 + 0.02 * breathe;
  const sy = 1 - 0.025 * breathe;
  const drift = 2 * wobble(frame, seed, 60);
  const flashPhase = (frame % 120) / 120;
  const flash =
    flashPhase > 0.7 && flashPhase < 0.85
      ? Math.sin(((flashPhase - 0.7) / 0.15) * Math.PI)
      : 0;
  const curl = Math.sin(phase * Math.PI * 2 + 1.6) * 3;
  return (
    <g transform={`translate(${drift.toFixed(2)} ${bob.toFixed(2)})`}>
      <defs>
        <linearGradient id="mk-gen-storm-cloud" x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0%" stopColor={cloudLight} />
          <stop offset="55%" stopColor={cloudBase} />
          <stop offset="100%" stopColor={cloudDark} />
        </linearGradient>
        <radialGradient id="mk-gen-storm-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor={glowColor} stopOpacity={0.9} />
          <stop offset="100%" stopColor={glowColor} stopOpacity={0} />
        </radialGradient>
      </defs>
      <g transform={`translate(0 -200) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(0 200)`}>
        {/* outline pass */}
        <ellipse cx={0} cy={-180} rx={78} ry={24} fill={ink} stroke={ink} strokeWidth={6} />
        {LOBES.map(([x, y, r], i) => (
          <circle key={`o${i}`} cx={x} cy={y} r={r} fill={ink} stroke={ink} strokeWidth={6} />
        ))}
        {/* fill pass */}
        <ellipse cx={0} cy={-180} rx={78} ry={24} fill="url(#mk-gen-storm-cloud)" />
        {LOBES.map(([x, y, r], i) => (
          <circle key={`f${i}`} cx={x} cy={y} r={r} fill="url(#mk-gen-storm-cloud)" />
        ))}
        {/* inner flash glow */}
        <ellipse
          cx={10}
          cy={-200}
          rx={48}
          ry={32}
          fill="url(#mk-gen-storm-glow)"
          opacity={0.15 + 0.6 * flash}
        />
        {/* dark belly */}
        <path
          d="M -74 -184 Q -40 -166 0 -170 Q 40 -166 74 -184 Q 60 -160 0 -158 Q -60 -160 -74 -184 Z"
          fill={cloudDark}
          opacity={0.7}
        />
        {/* top-left highlights */}
        <ellipse cx={-26} cy={-246} rx={18} ry={9} fill="#ffffff" opacity={0.28} transform="rotate(-25 -26 -246)" />
        <ellipse cx={-60} cy={-214} rx={11} ry={6} fill="#ffffff" opacity={0.22} transform="rotate(-35 -60 -214)" />
        <ellipse cx={18} cy={-244} rx={9} ry={5} fill="#ffffff" opacity={0.18} />
        {/* right shade */}
        <ellipse cx={62} cy={-188} rx={14} ry={16} fill={cloudDark} opacity={0.45} />
        {/* curling edges */}
        <path
          d={`M -40 -196 q 10 ${-10 + curl} 20 -2 q 6 6 -2 10`}
          fill="none"
          stroke={ink}
          strokeWidth={4}
          strokeLinecap="round"
          opacity={0.75}
        />
        <path
          d={`M 14 -212 q 12 ${-12 - curl} 24 -2 q 6 7 -3 11`}
          fill="none"
          stroke={ink}
          strokeWidth={4}
          strokeLinecap="round"
          opacity={0.75}
        />
        <path
          d={`M -12 -178 q 10 ${-6 + curl * 0.6} 22 0`}
          fill="none"
          stroke={cloudLight}
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.6}
        />
        {/* little flash sparkle */}
        <path
          d="M 6 -206 L 14 -198 L 8 -196 L 16 -186"
          fill="none"
          stroke={glowColor}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={flash}
        />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 300,
  Component: StormCloud,
};
