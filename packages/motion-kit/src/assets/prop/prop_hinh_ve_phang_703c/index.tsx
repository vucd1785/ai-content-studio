import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const SAND = "#F2C14E";
const SAND_LIGHT = "#FCE39A";
const SAND_SHADE = "#D4913A";
const CRACK = "#8A5A2B";
const ROCK = "#B08968";
const ROCK_LIGHT = "#D6B999";
const ROCK_DARK = "#7A5A40";
const SUN = "#FFD23F";
const SUN_CORE = "#FFF1A8";

const waveD = (x0: number, y0: number, ph: number): string => {
  let d = `M ${x0.toFixed(2)} ${y0.toFixed(2)}`;
  for (let i = 1; i <= 6; i++) {
    const y = y0 - i * 7;
    const x = x0 + 5 * Math.sin(ph + i * 1.3);
    d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return d;
};

/** Sa mạc khô cằn: đồi cát, đất nứt, đá, mặt trời gay gắt và hơi nóng gợn lăn tăn. */
const DesertScene: FC<PropProps> = ({ frame, seed }) => {
  const sunPulse = 1 + 0.06 * wobble(frame, seed, 40);
  const sunSpin = (frame * 0.5) % 360;
  const halo = 0.25 + 0.15 * (0.5 + 0.5 * wobble(frame, seed + 3, 30));
  const rays = Array.from({ length: 10 }, (_, i) => (i * 360) / 10);
  const waves = [-50, -8, 26].map((x, i) => {
    const p = ((frame + i * 22) % 66) / 66;
    const rise = easing.out(p) * 22;
    const op = Math.sin(Math.PI * p) * 0.75;
    return { x, y: -88 - rise - i * 4, op, ph: frame * 0.25 + i * 2 };
  });
  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-desert-sand" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={SAND_LIGHT} />
          <stop offset="0.5" stopColor={SAND} />
          <stop offset="1" stopColor={SAND_SHADE} />
        </linearGradient>
        <radialGradient id="mk-gen-desert-sun" cx="0.38" cy="0.38" r="0.7">
          <stop offset="0" stopColor={SUN_CORE} />
          <stop offset="1" stopColor={SUN} />
        </radialGradient>
      </defs>
      <ContactShadow halfWidth={86} />

      {/* Mặt trời */}
      <g transform={`translate(40 -168) scale(${sunPulse.toFixed(3)})`}>
        <circle r={44} fill={PALETTE.warn} opacity={halo} />
        <g transform={`rotate(${sunSpin.toFixed(2)})`}>
          {rays.map((a, i) => (
            <path
              key={i}
              d="M -6 -32 L 0 -44 L 6 -32 Z"
              transform={`rotate(${a})`}
              fill={i % 2 === 0 ? PALETTE.warn : SUN}
              stroke={ink}
              strokeWidth={3}
              strokeLinejoin="round"
            />
          ))}
        </g>
        <circle r={27} fill="url(#mk-gen-desert-sun)" stroke={ink} strokeWidth={5} />
        <circle cx={-9} cy={-9} r={7} fill="#FFFFFF" opacity={0.55} />
      </g>

      {/* Đồi cát */}
      <path
        d="M -86 -6 C -84 -50 -50 -92 -10 -96 C 30 -98 62 -66 86 -40 L 86 -6 Q 0 8 -86 -6 Z"
        fill="url(#mk-gen-desert-sand)"
        stroke={ink}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <path
        d="M -74 -30 C -66 -60 -44 -84 -14 -88 C -36 -76 -54 -56 -62 -30 Z"
        fill={SAND_LIGHT}
        opacity={0.6}
      />
      <path d="M 20 -88 C 50 -78 70 -58 82 -40 L 82 -20 C 60 -40 44 -66 20 -88 Z" fill={SAND_SHADE} opacity={0.45} />
      <path d="M -30 -66 Q -10 -72 10 -66" stroke={SAND_SHADE} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.7} />
      <path d="M 10 -52 Q 30 -58 50 -50" stroke={SAND_SHADE} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.7} />

      {/* Đất nứt nẻ */}
      <ellipse cx={0} cy={-14} rx={80} ry={15} fill="#E0A552" stroke={ink} strokeWidth={5} />
      <ellipse cx={-14} cy={-18} rx={50} ry={6} fill={SAND_LIGHT} opacity={0.35} />
      <g stroke={CRACK} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M -60 -14 L -44 -18 L -32 -12 L -16 -16" />
        <path d="M -44 -18 L -40 -24" />
        <path d="M -16 -16 L 0 -10 L 14 -18 L 30 -12" />
        <path d="M 0 -10 L 4 -4" />
        <path d="M 14 -18 L 18 -25" />
        <path d="M 30 -12 L 46 -16 L 62 -10" />
        <path d="M 46 -16 L 50 -22" />
      </g>

      {/* Tảng đá */}
      <path
        d="M -74 -10 Q -76 -32 -60 -36 Q -44 -38 -40 -22 Q -38 -10 -56 -8 Z"
        fill={ROCK}
        stroke={ink}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <path d="M -68 -22 Q -66 -32 -58 -32" stroke={ROCK_LIGHT} strokeWidth={4} fill="none" strokeLinecap="round" />
      <path d="M -46 -24 Q -44 -14 -54 -12" stroke={ROCK_DARK} strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.7} />
      <path
        d="M 46 -12 Q 46 -30 60 -32 Q 76 -32 76 -16 Q 74 -8 60 -8 Z"
        fill={ROCK}
        stroke={ink}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <path d="M 52 -22 Q 54 -28 60 -28" stroke={ROCK_LIGHT} strokeWidth={3.5} fill="none" strokeLinecap="round" />
      <ellipse cx={26} cy={-10} rx={9} ry={6} fill={ROCK_DARK} stroke={ink} strokeWidth={4} />
      <ellipse cx={23} cy={-12} rx={3} ry={2} fill={ROCK_LIGHT} />

      {/* Hơi nóng gợn lăn tăn */}
      {waves.map((w, i) => (
        <path
          key={i}
          d={waveD(w.x, w.y, w.ph)}
          stroke="#FFFFFF"
          strokeWidth={3.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={w.op}
        />
      ))}
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 226,
  Component: DesertScene,
};
