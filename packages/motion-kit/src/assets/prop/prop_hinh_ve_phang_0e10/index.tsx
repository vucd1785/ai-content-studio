import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";

const ink = PALETTE.ink;
const SHELL = "#e2553a";
const SHELL_DARK = "#a8352a";
const BODY = "#4a3528";
const BODY_LIGHT = "#6e5241";
const LANTERN_OFF = "#cfc58e";
const LANTERN_ON = "#fff27a";
const GLOW = "#ffe95a";
const WING = "#d8ecff";

const CYCLE = 72;

/** Nhịp nháy mượt: một "bướu" sáng trong khoảng 0..0.32 của chu kỳ. */
const flashEnv = (p: number): number => {
  const q = ((p % 1) + 1) % 1;
  if (q > 0.32) return 0;
  const s = Math.sin((Math.PI * q) / 0.32);
  return s * s;
};

/** Độ lan của vòng sáng sau mỗi lần nháy (0..1), hoặc -1 nếu không có. */
const ringPhase = (p: number): number => {
  const q = ((p % 1) + 1) % 1;
  if (q < 0.1 || q > 0.45) return -1;
  return (q - 0.1) / 0.35;
};

const firefly = (
  key: string,
  x: number,
  y: number,
  facing: number,
  glow: number,
  ring: number,
  flap: number,
  tilt: number,
) => {
  return (
    <g key={key} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${(0.85 * facing).toFixed(3)} 0.85) rotate(${tilt.toFixed(2)})`}>
      {/* halo glow */}
      <circle cx={-30} cy={2} r={20} fill="url(#mk-gen-ff-halo)" opacity={glow} />
      {ring >= 0 ? (
        <circle
          cx={-30}
          cy={2}
          r={10 + 10 * ring}
          fill="none"
          stroke={GLOW}
          strokeWidth={3}
          opacity={(1 - ring) * 0.8}
        />
      ) : null}
      {/* back wing */}
      <g transform={`rotate(${(-flap * 0.7 - 10).toFixed(2)} 0 -8)`}>
        <ellipse cx={-10} cy={-24} rx={18} ry={9} fill={WING} opacity={0.45} stroke={ink} strokeWidth={3} />
      </g>
      {/* legs */}
      <path d="M -4 8 L -8 18 M 4 9 L 4 20 M 12 8 L 16 18" stroke={ink} strokeWidth={3.5} strokeLinecap="round" fill="none" />
      {/* abdomen */}
      <ellipse cx={-14} cy={0} rx={22} ry={13} fill={BODY} stroke={ink} strokeWidth={5} />
      <ellipse cx={-12} cy={-5} rx={12} ry={4} fill={BODY_LIGHT} opacity={0.7} />
      {/* lantern tail */}
      <ellipse cx={-30} cy={2} rx={12} ry={11} fill={LANTERN_OFF} stroke={ink} strokeWidth={5} />
      <ellipse cx={-30} cy={2} rx={12} ry={11} fill="url(#mk-gen-ff-lantern)" opacity={glow} />
      <ellipse cx={-28} cy={8} rx={7} ry={3} fill="#9c9060" opacity={0.35 * (1 - glow)} />
      <ellipse cx={-33} cy={-3} rx={4} ry={2.5} fill="#ffffff" opacity={0.6 + 0.4 * glow} />
      {/* segment line */}
      <path d="M -20 -11 Q -16 0 -20 11" stroke={ink} strokeWidth={3} fill="none" strokeLinecap="round" />
      {/* thorax shield */}
      <circle cx={6} cy={-2} r={12} fill={SHELL} stroke={ink} strokeWidth={5} />
      <path d="M 10 -12 A 12 12 0 0 1 16 6" stroke={SHELL_DARK} strokeWidth={4} fill="none" opacity={0.7} />
      <circle cx={2} cy={-6} r={3.5} fill="#ff9b7a" opacity={0.8} />
      {/* head */}
      <circle cx={20} cy={0} r={10} fill={BODY} stroke={ink} strokeWidth={5} />
      <circle cx={23} cy={-2} r={4.5} fill="#ffffff" />
      <circle cx={24.5} cy={-2} r={2.5} fill={ink} />
      <circle cx={23.5} cy={-3.5} r={1} fill="#ffffff" />
      {/* antennae */}
      <path d="M 22 -8 Q 26 -18 34 -20 M 18 -9 Q 20 -20 27 -25" stroke={ink} strokeWidth={3} fill="none" strokeLinecap="round" />
      <circle cx={34} cy={-20} r={2.5} fill={ink} />
      <circle cx={27} cy={-25} r={2.5} fill={ink} />
      {/* front wing */}
      <g transform={`rotate(${(-flap - 18).toFixed(2)} 0 -8)`}>
        <ellipse cx={-12} cy={-22} rx={20} ry={9} fill={WING} opacity={0.6} stroke={ink} strokeWidth={3} />
        <ellipse cx={-16} cy={-25} rx={9} ry={3} fill="#ffffff" opacity={0.6} />
      </g>
    </g>
  );
};

/** Hai con đom đóm đối diện nhau, thay nhau nháy bụng như đang trò chuyện bằng ánh sáng. */
const FirefliesTalk: FC<PropProps> = ({ frame, seed }) => {
  const p = frame / CYCLE;
  const glowL = flashEnv(p);
  const glowR = flashEnv(p - 0.5);
  const ringL = ringPhase(p);
  const ringR = ringPhase(p - 0.5);
  const flapA = Math.sin(frame * 1.7) * 22;
  const flapB = Math.sin(frame * 1.7 + 1.3) * 22;
  const bobL = Math.sin(frame * 0.09) * 6 + 2 * wobble(frame, seed, 50);
  const bobR = Math.sin(frame * 0.09 + 2.2) * 6 + 2 * wobble(frame, seed + 5, 50);
  const tiltL = Math.sin(frame * 0.09 + 0.6) * 5 - 4 * glowL;
  const tiltR = Math.sin(frame * 0.09 + 2.8) * 5 - 4 * glowR;
  const tw = 0.5 + 0.5 * Math.sin(frame * 0.2);
  return (
    <g>
      <defs>
        <radialGradient id="mk-gen-ff-halo" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={GLOW} stopOpacity={0.9} />
          <stop offset="0.6" stopColor={GLOW} stopOpacity={0.35} />
          <stop offset="1" stopColor={GLOW} stopOpacity={0} />
        </radialGradient>
        <radialGradient id="mk-gen-ff-lantern" cx="0.38" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.45" stopColor={LANTERN_ON} />
          <stop offset="1" stopColor="#f2c23a" />
        </radialGradient>
      </defs>
      {/* sparkles drifting between them */}
      <circle cx={-6} cy={-158 + tw * 6} r={3} fill={GLOW} opacity={0.3 + 0.6 * glowL} />
      <circle cx={8} cy={-96 - tw * 5} r={2.5} fill={GLOW} opacity={0.3 + 0.6 * glowR} />
      <circle cx={0} cy={-130} r={2} fill="#ffffff" opacity={0.2 + 0.5 * tw} />
      {firefly("l", -45, -118 + bobL, 1, glowL, ringL, flapA, tiltL)}
      {firefly("r", 45, -128 + bobR, -1, glowR, ringR, flapB, tiltR)}
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 200,
  Component: FirefliesTalk,
};
