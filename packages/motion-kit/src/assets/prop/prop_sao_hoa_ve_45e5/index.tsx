import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";

const ink = PALETTE.ink;
const R = 66;
const PERIOD = 220;

const MARS_BASE = "#E2673A";
const MARS_LIGHT = "#F79A62";
const MARS_DARK = "#A63B22";
const MARS_DEEP = "#7E2A1A";
const ICE = "#F4FAFF";
const ICE_SHADE = "#C9DDF0";

type Patch = { x: number; y: number; rx: number; ry: number; rot: number };
const PATCHES: Patch[] = [
  { x: -80, y: -18, rx: 26, ry: 10, rot: -12 },
  { x: -30, y: 14, rx: 34, ry: 9, rot: 8 },
  { x: 20, y: -30, rx: 18, ry: 8, rot: -20 },
  { x: 60, y: 24, rx: 28, ry: 11, rot: 14 },
  { x: 100, y: -6, rx: 22, ry: 8, rot: -6 },
];
const CRATERS: { x: number; y: number; r: number }[] = [
  { x: -55, y: 34, r: 7 },
  { x: 5, y: -8, r: 5 },
  { x: 45, y: -42, r: 6 },
  { x: 85, y: 40, r: 5 },
];
const STARS: { x: number; y: number; s: number; ph: number }[] = [
  { x: -74, y: -232, s: 7, ph: 0 },
  { x: 74, y: -212, s: 6, ph: 13 },
  { x: -78, y: -92, s: 5, ph: 27 },
  { x: 76, y: -100, s: 6, ph: 41 },
];

/** Sao Hỏa phẳng: quả cầu đỏ cam có vệt sẫm, chỏm băng hai cực, xoay chậm và lơ lửng. */
const SaoHoa: FC<PropProps> = ({ frame, seed }) => {
  const bob = 6 * wobble(frame, seed, 90);
  const tilt = 3 * wobble(frame, seed + 3, 140);
  const cy = -158 + bob;
  const shift = (frame * 0.45) % PERIOD;
  const glowPhase = (frame % 80) / 80;
  const glow = 0.5 + 0.5 * Math.sin(glowPhase * Math.PI * 2);
  const clipId = `mk-gen-mars-clip-${seed}`;
  const gradId = `mk-gen-mars-grad-${seed}`;

  const copies = [-shift, -shift + PERIOD];

  return (
    <g>
      <defs>
        <radialGradient id={gradId} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor={MARS_LIGHT} />
          <stop offset="55%" stopColor={MARS_BASE} />
          <stop offset="100%" stopColor={MARS_DARK} />
        </radialGradient>
        <clipPath id={clipId}>
          <circle cx={0} cy={0} r={R} />
        </clipPath>
      </defs>

      {STARS.map((st, i) => {
        const k = easing.inOut(0.5 + 0.5 * Math.sin(((frame + st.ph) / 50) * Math.PI * 2));
        const s = st.s * (0.6 + 0.5 * k);
        return (
          <path
            key={`s${i}`}
            d={`M ${st.x} ${st.y - s} Q ${st.x} ${st.y} ${st.x + s} ${st.y} Q ${st.x} ${st.y} ${st.x} ${st.y + s} Q ${st.x} ${st.y} ${st.x - s} ${st.y} Q ${st.x} ${st.y} ${st.x} ${st.y - s} Z`}
            fill={PALETTE.warn}
            opacity={0.4 + 0.6 * k}
          />
        );
      })}

      <g transform={`translate(0 ${cy.toFixed(2)}) rotate(${tilt.toFixed(2)})`}>
        <circle cx={0} cy={0} r={R + 10} fill={MARS_LIGHT} opacity={0.12 + 0.1 * glow} />

        <circle cx={0} cy={0} r={R} fill={`url(#${gradId})`} />

        <g clipPath={`url(#${clipId})`}>
          {copies.map((off, c) => (
            <g key={`c${c}`} transform={`translate(${off.toFixed(2)} 0)`}>
              {PATCHES.map((p, i) => (
                <ellipse
                  key={`p${i}`}
                  cx={p.x}
                  cy={p.y}
                  rx={p.rx}
                  ry={p.ry}
                  transform={`rotate(${p.rot} ${p.x} ${p.y})`}
                  fill={MARS_DEEP}
                  opacity={0.55}
                />
              ))}
              {CRATERS.map((cr, i) => (
                <g key={`k${i}`}>
                  <circle cx={cr.x} cy={cr.y} r={cr.r} fill={MARS_DARK} />
                  <circle cx={cr.x - 1.5} cy={cr.y - 1.5} r={cr.r * 0.55} fill={MARS_LIGHT} opacity={0.6} />
                </g>
              ))}
            </g>
          ))}

          <ellipse cx={0} cy={-R + 6} rx={34} ry={16} fill={ICE} />
          <ellipse cx={8} cy={-R + 12} rx={22} ry={6} fill={ICE_SHADE} opacity={0.8} />
          <ellipse cx={0} cy={R - 5} rx={28} ry={13} fill={ICE} />
          <ellipse cx={-6} cy={R - 10} rx={18} ry={4} fill={ICE_SHADE} opacity={0.8} />

          <circle cx={30} cy={22} r={R} fill={MARS_DEEP} opacity={0.28} />
          <ellipse cx={-26} cy={-30} rx={22} ry={12} transform="rotate(-35 -26 -30)" fill="#FFFFFF" opacity={0.28} />
        </g>

        <circle cx={0} cy={0} r={R} fill="none" stroke={ink} strokeWidth={6} />
        <path
          d={`M ${-R + 14} -18 A ${R - 12} ${R - 12} 0 0 1 -18 ${-R + 14}`}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={5}
          strokeLinecap="round"
          opacity={0.7}
        />
        <circle cx={-46} cy={-10} r={3} fill="#FFFFFF" opacity={0.75} />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 86,
  height: 250,
  Component: SaoHoa,
};
