import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const foldInk = "#C2477A";

const BRAIN_PATH =
  "M -62 -100 C -78 -130 -58 -170 -20 -172 C 0 -188 40 -182 52 -160 C 76 -150 78 -118 66 -100 C 72 -82 58 -66 40 -70 C 28 -58 6 -60 -4 -70 C -24 -62 -50 -70 -56 -84 C -66 -88 -66 -96 -62 -100 Z";

const qb = (a: number, b: number, c: number, u: number): number =>
  (1 - u) * (1 - u) * a + 2 * (1 - u) * u * b + u * u * c;

type SparkProps = {
  frame: number;
  offset: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

const Spark: FC<SparkProps> = ({ frame, offset, x0, y0, x1, y1, x2, y2 }) => {
  const raw = ((frame + offset) % 48) / 48;
  const u = easing.inOut(raw);
  const x = qb(x0, x1, x2, u);
  const y = qb(y0, y1, y2, u);
  const fade = Math.sin(Math.PI * raw);
  const tx = qb(x0, x1, x2, Math.max(0, u - 0.12));
  const ty = qb(y0, y1, y2, Math.max(0, u - 0.12));
  return (
    <g opacity={fade}>
      <line
        x1={tx.toFixed(2)}
        y1={ty.toFixed(2)}
        x2={x.toFixed(2)}
        y2={y.toFixed(2)}
        stroke="#FFF6B0"
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.6}
      />
      <circle cx={x.toFixed(2)} cy={y.toFixed(2)} r={7} fill="#FFF6B0" opacity={0.45} />
      <circle cx={x.toFixed(2)} cy={y.toFixed(2)} r={3.5} fill="#FFFFFF" />
    </g>
  );
};

/** Bộ não người màu hồng phát sáng nhẹ, tia sáng chạy qua các nếp não. */
const BrainHuman: FC<PropProps> = ({ frame, seed }) => {
  const bob = 4 * wobble(frame, seed, 70);
  const breath = 0.5 + 0.5 * Math.sin((frame / 40) * Math.PI * 2);
  const sx = 1 + 0.02 * breath;
  const sy = 1 - 0.015 * breath;
  const glow = 0.5 + 0.5 * wobble(frame, seed + 3, 36);
  const twinkle = 0.5 + 0.5 * Math.sin(frame * 0.25);
  return (
    <g>
      <defs>
        <radialGradient id="mk-gen-brain-fill" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#FFD3E2" />
          <stop offset="0.55" stopColor="#F79BBE" />
          <stop offset="1" stopColor="#E06A94" />
        </radialGradient>
        <radialGradient id="mk-gen-brain-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFB3CF" stopOpacity="0.8" />
          <stop offset="1" stopColor="#FFB3CF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ContactShadow halfWidth={56} />
      <g transform={`translate(0 ${bob.toFixed(2)})`}>
        <ellipse
          cx={0}
          cy={-118}
          rx={78}
          ry={74}
          fill="url(#mk-gen-brain-glow)"
          opacity={0.45 + 0.4 * glow}
        />
        <g transform={`translate(0 -115) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(0 115)`}>
          <path
            d="M 6 -72 C 8 -60 10 -52 14 -44 L 28 -46 C 24 -56 24 -64 26 -72 Z"
            fill="#E9849F"
            stroke={ink}
            strokeWidth={5}
            strokeLinejoin="round"
          />
          <ellipse cx={42} cy={-74} rx={22} ry={14} fill="#E06A94" stroke={ink} strokeWidth={5} />
          <path d="M 28 -76 Q 42 -70 56 -78" fill="none" stroke={foldInk} strokeWidth={3} strokeLinecap="round" />
          <path
            d={BRAIN_PATH}
            fill="url(#mk-gen-brain-fill)"
            stroke={ink}
            strokeWidth={6}
            strokeLinejoin="round"
          />
          <path
            d="M 66 -100 C 72 -82 58 -66 40 -70 C 28 -58 6 -60 -4 -70 C -24 -62 -50 -70 -56 -84 C -30 -78 10 -80 40 -90 C 54 -95 62 -104 70 -118 C 72 -110 70 -104 66 -100 Z"
            fill="#B8436F"
            opacity={0.22}
          />
          <g fill="none" stroke={foldInk} strokeWidth={4} strokeLinecap="round">
            <path d="M -50 -120 Q -30 -142 -10 -126" />
            <path d="M -32 -158 Q -6 -144 12 -166" />
            <path d="M 0 -120 Q 22 -142 46 -130" />
            <path d="M 26 -162 Q 46 -152 58 -140" />
            <path d="M -46 -92 Q -20 -108 6 -94" />
            <path d="M 16 -100 Q 36 -112 58 -100" />
            <path d="M -8 -176 Q -14 -150 -4 -132 Q 4 -112 -2 -96" />
          </g>
          <ellipse cx={-36} cy={-148} rx={18} ry={9} fill="#FFFFFF" opacity={0.4} transform="rotate(-30 -36 -148)" />
          <circle cx={-56} cy={-128} r={4} fill="#FFFFFF" opacity={0.55} />
          <Spark frame={frame} offset={0} x0={-50} y0={-120} x1={-30} y1={-142} x2={-10} y2={-126} />
          <Spark frame={frame} offset={16} x0={0} y0={-120} x1={22} y1={-142} x2={46} y2={-130} />
          <Spark frame={frame} offset={32} x0={-46} y0={-92} x1={-20} y1={-108} x2={6} y2={-94} />
          <Spark frame={frame} offset={24} x0={-32} y0={-158} x1={-6} y1={-144} x2={12} y2={-166} />
        </g>
        <g opacity={twinkle}>
          <path d="M 62 -176 L 65 -168 L 73 -165 L 65 -162 L 62 -154 L 59 -162 L 51 -165 L 59 -168 Z" fill="#FFF6B0" stroke={ink} strokeWidth={2} />
        </g>
        <g opacity={1 - twinkle}>
          <path d="M -66 -164 L -64 -158 L -58 -156 L -64 -154 L -66 -148 L -68 -154 L -74 -156 L -68 -158 Z" fill="#FFF6B0" stroke={ink} strokeWidth={2} />
        </g>
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 80,
  height: 210,
  Component: BrainHuman,
};
