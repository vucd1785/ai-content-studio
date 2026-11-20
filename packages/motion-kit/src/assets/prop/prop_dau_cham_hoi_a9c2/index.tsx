import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";

const ink = PALETTE.ink;
const BASE = "#FFD23F";
const LIGHT = "#FFF3A6";
const SHADE = "#E3A21A";
const GLOW = "#FFE680";

const HOOK =
  "M -34 -228 C -36 -276 38 -282 40 -234 C 42 -204 2 -196 0 -164 L 0 -146";

const sparklePath = (r: number): string => {
  const k = r * 0.28;
  return `M 0 ${-r} Q ${k} ${-k} ${r} 0 Q ${k} ${k} 0 ${r} Q ${-k} ${k} ${-r} 0 Q ${-k} ${-k} 0 ${-r} Z`;
};

const SPARKLES: ReadonlyArray<{ x: number; y: number; r: number; ph: number; c: string }> = [
  { x: -66, y: -252, r: 13, ph: 0, c: LIGHT },
  { x: 64, y: -270, r: 10, ph: 17, c: "#FFFFFF" },
  { x: 68, y: -150, r: 12, ph: 33, c: LIGHT },
  { x: -64, y: -128, r: 9, ph: 49, c: "#FFFFFF" },
  { x: -40, y: -60, r: 7, ph: 8, c: BASE },
  { x: 46, y: -74, r: 8, ph: 26, c: BASE },
];

/** Dấu chấm hỏi vàng khổng lồ phát sáng, lơ lửng nhún nhẹ, có đốm lấp lánh. */
const DauChamHoi: FC<PropProps> = ({ frame, seed }) => {
  const P = 64;
  const ph = (frame % P) / P;
  const bob = Math.sin(ph * Math.PI * 2) * 9;
  const dotBob = Math.sin(ph * Math.PI * 2 - 0.9) * 11;
  const squash = 1 + 0.03 * Math.cos(ph * Math.PI * 2);
  const tilt = 4 * wobble(frame, seed, 90);
  const glow = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(ph * Math.PI * 4));

  return (
    <g>
      <defs>
        <radialGradient id="mk-gen-qm-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={GLOW} stopOpacity={0.85} />
          <stop offset="60%" stopColor={GLOW} stopOpacity={0.3} />
          <stop offset="100%" stopColor={GLOW} stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse
        cx={0}
        cy={-180 + bob}
        rx={80}
        ry={108}
        fill="url(#mk-gen-qm-glow)"
        opacity={glow}
      />
      <g transform={`translate(0 ${bob.toFixed(2)}) rotate(${tilt.toFixed(2)} 0 -180) translate(0 -146) scale(${(2 - squash).toFixed(3)} ${squash.toFixed(3)}) translate(0 146)`}>
        <path d={HOOK} fill="none" stroke={ink} strokeWidth={46} strokeLinecap="round" strokeLinejoin="round" />
        <path d={HOOK} fill="none" stroke={SHADE} strokeWidth={34} strokeLinecap="round" strokeLinejoin="round" />
        <path
          d={HOOK}
          transform="translate(-2 -2)"
          fill="none"
          stroke={BASE}
          strokeWidth={26}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={HOOK}
          transform="translate(-7 -6)"
          pathLength={100}
          strokeDasharray="34 200"
          strokeDashoffset={-4}
          fill="none"
          stroke={LIGHT}
          strokeWidth={7}
          strokeLinecap="round"
          opacity={0.9}
        />
        <circle cx={-30} cy={-244} r={3.5} fill="#FFFFFF" opacity={0.9} />
      </g>
      <g transform={`translate(${(tilt * -0.6).toFixed(2)} ${dotBob.toFixed(2)})`}>
        <circle cx={0} cy={-98} r={21} fill={SHADE} stroke={ink} strokeWidth={6} />
        <circle cx={-2} cy={-100} r={15} fill={BASE} />
        <circle cx={-7} cy={-105} r={5} fill={LIGHT} opacity={0.95} />
      </g>
      {SPARKLES.map((s, i) => {
        const local = ((frame + s.ph + seed * 3) % 50) / 50;
        const pop = local < 0.5 ? easing.outBack(1.6)(local * 2) : 1 - easing.inOut((local - 0.5) * 2);
        const sc = 0.35 + 0.65 * Math.max(0, pop);
        const drift = 3 * wobble(frame, seed + i * 11, 70);
        return (
          <g
            key={i}
            transform={`translate(${s.x} ${(s.y + drift).toFixed(2)}) rotate(${(local * 45).toFixed(1)}) scale(${sc.toFixed(3)})`}
          >
            <path d={sparklePath(s.r)} fill={s.c} stroke={ink} strokeWidth={2.5} strokeLinejoin="round" />
          </g>
        );
      })}
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 82,
  height: 300,
  Component: DauChamHoi,
};
