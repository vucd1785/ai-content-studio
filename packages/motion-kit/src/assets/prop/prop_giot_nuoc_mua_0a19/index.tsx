import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";

const ink = PALETTE.ink;

const DROP =
  "M 0 -95 C 18 -62 55 -30 55 8 C 55 40 30 60 0 60 C -30 60 -55 40 -55 8 C -55 -30 -18 -62 0 -95 Z";

/** Giọt nước mưa to tròn, trong suốt xanh nhạt, có vệt sáng, lơ lửng rung rinh. */
const GiotNuocMua: FC<PropProps> = ({ frame, seed }) => {
  const cycle = (frame % 60) / 60;
  const phase = cycle < 0.5 ? easing.inOut(cycle * 2) : easing.inOut((1 - cycle) * 2);
  const bob = -8 + 14 * phase;
  const jiggle = wobble(frame, seed + 3, 26);
  const sx = 1 + 0.035 * jiggle;
  const sy = 1 - 0.035 * jiggle;
  const tilt = 3 * wobble(frame, seed + 11, 70);
  const glint = 0.5 + 0.5 * wobble(frame, seed + 5, 32);
  const tw1 = 0.5 + 0.5 * Math.sin(frame * 0.18);
  const tw2 = 0.5 + 0.5 * Math.sin(frame * 0.18 + 2.2);
  const star = (cx: number, cy: number, s: number, o: number) => (
    <path
      d={`M ${cx} ${cy - s} Q ${cx} ${cy} ${cx + s} ${cy} Q ${cx} ${cy} ${cx} ${cy + s} Q ${cx} ${cy} ${cx - s} ${cy} Q ${cx} ${cy} ${cx} ${cy - s} Z`}
      fill="#FFFFFF"
      stroke={ink}
      strokeWidth={2}
      strokeLinejoin="round"
      opacity={o}
    />
  );
  return (
    <g>
      <defs>
        <radialGradient id="mk-gen-giot-nuoc-0a19" cx="0.35" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#E6F7FF" />
          <stop offset="0.55" stopColor="#9FDBF5" />
          <stop offset="1" stopColor="#5FB4E0" />
        </radialGradient>
      </defs>
      <g transform={`translate(0 ${(-82 + bob).toFixed(2)}) rotate(${tilt.toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)})`}>
        <circle cx={0} cy={5} r={66} fill="#BFE9FF" opacity={0.18 + 0.12 * glint} />
        <path d={DROP} fill="url(#mk-gen-giot-nuoc-0a19)" opacity={0.92} />
        <path
          d="M 52 -2 C 56 34 32 58 0 58 C -20 58 -36 49 -45 36 C -20 50 30 44 52 -2 Z"
          fill="#3E8FC4"
          opacity={0.35}
        />
        <path
          d="M 36 18 C 34 36 20 46 4 48"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={5}
          strokeLinecap="round"
          opacity={0.55}
        />
        <path
          d="M -36 -4 C -36 -28 -22 -50 -10 -66"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={11}
          strokeLinecap="round"
          opacity={0.9}
        />
        <ellipse cx={-30} cy={18} rx={6} ry={8} fill="#FFFFFF" opacity={0.85} />
        <circle cx={-18} cy={-18} r={18} fill="#FFFFFF" opacity={0.15 + 0.15 * glint} />
        <path d={DROP} fill="none" stroke={ink} strokeWidth={6} strokeLinejoin="round" />
        <circle cx={14} cy={-30} r={3} fill="#FFFFFF" opacity={glint} />
      </g>
      {star(-56, -170 + bob * 0.5, 9, 0.4 + 0.6 * tw1)}
      {star(56, -120 - bob * 0.5, 7, 0.4 + 0.6 * tw2)}
      {star(44, -186, 5, 0.3 + 0.7 * tw2)}
      <circle cx={-58} cy={-70 + bob * 0.3} r={4} fill="#BFE9FF" stroke={ink} strokeWidth={2} opacity={0.5 + 0.5 * tw1} />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 70,
  height: 200,
  Component: GiotNuocMua,
};
