import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { clamp, easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const RED = "#E0523F";
const RED_LIGHT = "#F58A72";
const RED_DARK = "#A8352A";
const WATER = "#5BB6E8";
const WATER_DARK = "#3A8CC4";
const LAMP = "#FFD45C";

const TOP = -205;
const DECK = -70;

/** Cây cầu treo bắc qua sông: dây cáp đung đưa nhẹ, đèn cầu sáng dần rồi lung linh. */
const SuspensionBridge: FC<PropProps> = ({ frame, t, seed }) => {
  const sway = 4 * wobble(frame, seed, 70);
  const lag = 3 * wobble(frame + 8, seed, 70);
  const midY = -88 + sway;
  const ctrlY = 2 * (midY + 102.5);
  const cableY = (x: number) => {
    const s = (x + 50) / 100;
    return (1 - s) * (1 - s) * TOP + 2 * s * (1 - s) * ctrlY + s * s * TOP;
  };
  const light = easing.inOut(clamp(t * 1.6, 0, 1));
  const wave = wobble(frame, seed + 3, 50);
  const hangers = [-40, -30, -20, -10, 0, 10, 20, 30, 40];
  const lamps = [-72, -25, 25, 72];

  const tower = (x: number) => (
    <g>
      <rect x={x - 9} y={TOP - 4} width={18} height={TOP * -1 - 16} rx={4} fill="url(#mk-gen-bridge-tower)" stroke={ink} strokeWidth={5} />
      <rect x={x - 6} y={TOP + 2} width={4} height={150} rx={2} fill="#FFFFFF" opacity={0.3} />
      <rect x={x - 12} y={-160} width={24} height={9} rx={3} fill={RED_DARK} stroke={ink} strokeWidth={4} />
      <rect x={x - 12} y={-118} width={24} height={9} rx={3} fill={RED_DARK} stroke={ink} strokeWidth={4} />
      <rect x={x - 13} y={TOP - 12} width={26} height={12} rx={4} fill={RED_LIGHT} stroke={ink} strokeWidth={5} />
      <circle cx={x} cy={TOP - 18} r={4} fill={PALETTE.alert} stroke={ink} strokeWidth={2} opacity={0.6 + 0.4 * light} />
      <rect x={x - 14} y={-30} width={28} height={22} rx={4} fill={PALETTE.metal} stroke={ink} strokeWidth={4} />
      <rect x={x - 11} y={-27} width={8} height={16} rx={2} fill="#FFFFFF" opacity={0.35} />
    </g>
  );

  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-bridge-tower" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={RED_LIGHT} />
          <stop offset="0.45" stopColor={RED} />
          <stop offset="1" stopColor={RED_DARK} />
        </linearGradient>
        <linearGradient id="mk-gen-bridge-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={WATER} />
          <stop offset="1" stopColor={WATER_DARK} />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={86} />
      {/* river */}
      <rect x={-86} y={-36} width={172} height={34} rx={12} fill="url(#mk-gen-bridge-water)" stroke={ink} strokeWidth={5} />
      <path
        d={`M ${-70 + wave * 4} -24 q 8 -5 16 0 q 8 5 16 0 M ${14 - wave * 4} -14 q 8 -5 16 0 q 8 5 16 0`}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.6}
      />
      {/* reflections of lamps */}
      {lamps.map((x) => (
        <ellipse key={`r${x}`} cx={x} cy={-18} rx={6} ry={2.5} fill={LAMP} opacity={0.5 * light} />
      ))}
      {/* hangers */}
      {hangers.map((x, i) => (
        <line
          key={`h${x}`}
          x1={x}
          y1={cableY(x)}
          x2={x + lag * (1 - Math.abs(x) / 50) * (i % 2 === 0 ? 0.3 : 0.2)}
          y2={DECK}
          stroke={ink}
          strokeWidth={2.5}
        />
      ))}
      {tower(-50)}
      {tower(50)}
      {/* main cables */}
      <path
        d={`M -84 ${DECK} Q -70 -120 -50 ${TOP} Q 0 ${ctrlY} 50 ${TOP} Q 70 -120 84 ${DECK}`}
        fill="none"
        stroke={ink}
        strokeWidth={8}
        strokeLinecap="round"
      />
      <path
        d={`M -84 ${DECK} Q -70 -120 -50 ${TOP} Q 0 ${ctrlY} 50 ${TOP} Q 70 -120 84 ${DECK}`}
        fill="none"
        stroke={RED_LIGHT}
        strokeWidth={3.5}
        strokeLinecap="round"
      />
      {/* deck */}
      <rect x={-86} y={DECK} width={172} height={16} rx={5} fill={PALETTE.metalDark} stroke={ink} strokeWidth={5} />
      <rect x={-82} y={DECK + 3} width={164} height={4} rx={2} fill="#FFFFFF" opacity={0.35} />
      <rect x={-82} y={DECK + 10} width={164} height={3} rx={1.5} fill={ink} opacity={0.25} />
      {/* lamps */}
      {lamps.map((x, i) => {
        const flick = 0.85 + 0.15 * wobble(frame, seed + i * 5, 24);
        const glow = light * flick;
        return (
          <g key={`l${x}`}>
            <circle cx={x} cy={-95} r={13} fill={LAMP} opacity={0.35 * glow} />
            <line x1={x} y1={DECK} x2={x} y2={-90} stroke={ink} strokeWidth={3.5} strokeLinecap="round" />
            <circle cx={x} cy={-95} r={5.5} fill={glow > 0.1 ? LAMP : PALETTE.metal} stroke={ink} strokeWidth={2.5} opacity={0.55 + 0.45 * glow} />
            <circle cx={x - 1.5} cy={-96.5} r={1.6} fill="#FFFFFF" opacity={0.8} />
          </g>
        );
      })}
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 230,
  Component: SuspensionBridge,
};
