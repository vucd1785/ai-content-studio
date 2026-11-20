import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { clamp, easing, lerp, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";

const ink = PALETTE.ink;

const SUN_X = -52;
const SUN_Y = -140;
const FLOWER_X = 52;
const PIVOT_Y = -232;

/** Mũi tên cong lắc giữa mặt trời đỏ rực và bông hoa, rồi dừng chỉ vào mặt trời. */
const CurvedArrowChoice: FC<PropProps> = ({ frame, t, seed }) => {
  // Arrow: swing between flower (-22deg) and sun (+30deg), then settle on the sun with overshoot.
  const swing = 4 + 26 * Math.sin(frame * 0.11);
  const s = clamp((t - 0.55) / 0.25, 0, 1);
  const settle = easing.outBack(1.6)(s);
  const idle = 1.5 * wobble(frame, seed + 3, 40) * s;
  const angle = lerp(swing, 30, settle) + idle;
  const sunFocus = s;

  // Sun life
  const pulse = 0.5 + 0.5 * wobble(frame, seed, 26);
  const rayRot = frame * 0.6;
  const sunScale = 1 + 0.04 * pulse + 0.06 * sunFocus * pulse;

  // Flower sway
  const sway = 5 * wobble(frame, seed + 11, 60);

  const rays = [0, 1, 2, 3, 4, 5, 6, 7];
  const petals = [0, 1, 2, 3, 4, 5];
  const heat = [0, 1, 2];

  return (
    <g>
      <defs>
        <radialGradient id="mk-gen-sun-core" cx="0.38" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#FFB199" />
          <stop offset="0.55" stopColor="#F04A3A" />
          <stop offset="1" stopColor="#B71C1C" />
        </radialGradient>
        <linearGradient id="mk-gen-arrow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7FBFFF" />
          <stop offset="1" stopColor="#2F6FC9" />
        </linearGradient>
      </defs>

      {/* Grass tuft under the flower */}
      <ellipse cx={FLOWER_X} cy={-2} rx={28} ry={7} fill={PALETTE.ink} opacity={0.18} />
      <path
        d={`M ${FLOWER_X - 24} 0 Q ${FLOWER_X - 20} -16 ${FLOWER_X - 12} 0 Q ${FLOWER_X - 6} -20 ${FLOWER_X} 0 Q ${FLOWER_X + 8} -18 ${FLOWER_X + 12} 0 Q ${FLOWER_X + 20} -14 ${FLOWER_X + 24} 0 Z`}
        fill={PALETTE.leaf}
        stroke={ink}
        strokeWidth={4}
        strokeLinejoin="round"
      />

      {/* Flower */}
      <g transform={`rotate(${sway.toFixed(2)} ${FLOWER_X} 0)`}>
        <path
          d={`M ${FLOWER_X} -4 Q ${FLOWER_X - 6} -50 ${FLOWER_X} -92`}
          fill="none"
          stroke={ink}
          strokeWidth={9}
          strokeLinecap="round"
        />
        <path
          d={`M ${FLOWER_X} -4 Q ${FLOWER_X - 6} -50 ${FLOWER_X} -92`}
          fill="none"
          stroke="#4CAF50"
          strokeWidth={4}
          strokeLinecap="round"
        />
        <path
          d={`M ${FLOWER_X - 3} -40 Q ${FLOWER_X - 26} -52 ${FLOWER_X - 30} -36 Q ${FLOWER_X - 16} -30 ${FLOWER_X - 3} -40 Z`}
          fill={PALETTE.leaf}
          stroke={ink}
          strokeWidth={4}
          strokeLinejoin="round"
        />
        <path
          d={`M ${FLOWER_X - 1} -58 Q ${FLOWER_X + 22} -72 ${FLOWER_X + 28} -56 Q ${FLOWER_X + 14} -48 ${FLOWER_X - 1} -58 Z`}
          fill={PALETTE.leaf}
          stroke={ink}
          strokeWidth={4}
          strokeLinejoin="round"
        />
        <g transform={`translate(${FLOWER_X} -104)`}>
          {petals.map((i) => (
            <ellipse
              key={i}
              cx={0}
              cy={-14}
              rx={9}
              ry={13}
              fill="#FF8FB8"
              stroke={ink}
              strokeWidth={4}
              transform={`rotate(${i * 60 + sway * 2})`}
            />
          ))}
          {petals.map((i) => (
            <ellipse
              key={`h${i}`}
              cx={-2}
              cy={-17}
              rx={3.5}
              ry={6}
              fill="#FFFFFF"
              opacity={0.45}
              transform={`rotate(${i * 60 + sway * 2})`}
            />
          ))}
          <circle cx={0} cy={0} r={10} fill="#FFC93C" stroke={ink} strokeWidth={4} />
          <circle cx={3} cy={3} r={6} fill="#E09A1A" opacity={0.5} />
          <circle cx={-3} cy={-3} r={3} fill="#FFFFFF" opacity={0.8} />
        </g>
      </g>

      {/* Heat waves under the sun */}
      {heat.map((i) => {
        const p = ((frame * 0.02 + i / 3) % 1 + 1) % 1;
        const y = SUN_Y + 46 - p * 14;
        const x = SUN_X - 16 + i * 16;
        return (
          <path
            key={i}
            d={`M ${x} ${y + 14} q 5 -4 0 -8 q -5 -4 0 -8`}
            fill="none"
            stroke="#FF7043"
            strokeWidth={3.5}
            strokeLinecap="round"
            opacity={Math.sin(p * Math.PI) * 0.85}
          />
        );
      })}

      {/* Sun */}
      <g transform={`translate(${SUN_X} ${SUN_Y}) scale(${sunScale.toFixed(3)})`}>
        <circle r={34} fill="#FF7043" opacity={0.18 + 0.2 * pulse + 0.15 * sunFocus} />
        <g transform={`rotate(${rayRot.toFixed(2)})`}>
          {rays.map((i) => (
            <path
              key={i}
              d="M -5 -25 L 0 -35 L 5 -25 Z"
              fill="#FF9800"
              stroke={ink}
              strokeWidth={3.5}
              strokeLinejoin="round"
              transform={`rotate(${i * 45})`}
            />
          ))}
        </g>
        <circle r={23} fill="url(#mk-gen-sun-core)" stroke={ink} strokeWidth={5} />
        <path d="M 8 18 A 20 20 0 0 0 20 6" fill="none" stroke="#8E1414" strokeWidth={4} strokeLinecap="round" opacity={0.45} />
        <ellipse cx={-8} cy={-9} rx={7} ry={4.5} fill="#FFFFFF" opacity={0.6} transform="rotate(-35 -8 -9)" />
        <circle cx={-14} cy={-1} r={2} fill="#FFFFFF" opacity={0.7} />
      </g>

      {/* Curved arrow on a pivot */}
      <g transform={`rotate(${angle.toFixed(2)} 0 ${PIVOT_Y})`}>
        <g transform={`translate(0 ${PIVOT_Y})`}>
          <path d="M 0 0 Q 22 30 0 56" fill="none" stroke={ink} strokeWidth={17} strokeLinecap="round" />
          <path d="M 0 0 Q 22 30 0 56" fill="none" stroke="url(#mk-gen-arrow)" strokeWidth={9} strokeLinecap="round" />
          <path d="M 2 6 Q 14 24 8 38" fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={0.55} />
          <path
            d="M -15 48 L 15 52 L -4 74 Z"
            fill="#4A90E2"
            stroke={ink}
            strokeWidth={5}
            strokeLinejoin="round"
          />
          <path d="M -8 52 L 4 54 L -3 62 Z" fill="#FFFFFF" opacity={0.45} />
        </g>
      </g>
      <circle cx={0} cy={PIVOT_Y} r={9} fill={PALETTE.metal} stroke={ink} strokeWidth={4} />
      <circle cx={-2.5} cy={PIVOT_Y - 2.5} r={3} fill="#FFFFFF" opacity={0.7} />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 245,
  Component: CurvedArrowChoice,
};
