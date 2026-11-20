import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

type ChipProps = {
  x: number;
  frame: number;
  phase: number;
  base: string;
  light: string;
  dark: string;
  gid: string;
};

const RunningChip: FC<ChipProps> = ({ x, frame, phase, base, light, dark, gid }) => {
  const p = frame * 0.35 + phase;
  const s = Math.sin(p);
  const bounce = Math.abs(Math.sin(p)) * 7;
  const squash = 1 - 0.05 * Math.cos(p * 2);
  const blink = 0.5 + 0.5 * Math.sin(frame * 0.3 + phase * 2);
  const blink2 = 0.5 + 0.5 * Math.sin(frame * 0.3 + phase * 2 + 2.1);
  const hipY = -34 - bounce;
  const frontFootX = 12 * s;
  const backFootX = -12 * s;
  const frontLift = Math.max(0, s) * 7;
  const backLift = Math.max(0, -s) * 7;
  const eyeBlink = Math.sin(frame * 0.05 + phase) > 0.97 ? 0.15 : 1;
  return (
    <g transform={`translate(${x} 0)`}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="0.55" stopColor={base} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
      </defs>
      <line
        x1={-7}
        y1={hipY}
        x2={-7 + backFootX}
        y2={-4 - backLift}
        stroke={ink}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <ellipse cx={-4 + backFootX} cy={-4 - backLift} rx={6} ry={3.5} fill={dark} stroke={ink} strokeWidth={3} />
      <line
        x1={7}
        y1={hipY}
        x2={7 + frontFootX}
        y2={-4 - frontLift}
        stroke={ink}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <ellipse cx={10 + frontFootX} cy={-4 - frontLift} rx={6} ry={3.5} fill={dark} stroke={ink} strokeWidth={3} />
      <g transform={`translate(0 ${(-bounce).toFixed(2)}) rotate(7 0 -56) translate(0 -34) scale(${(2 - squash).toFixed(3)} ${squash.toFixed(3)}) translate(0 34)`}>
        <rect x={-28} y={-74} width={8} height={5} rx={1.5} fill={PALETTE.metal} stroke={ink} strokeWidth={2.5} />
        <rect x={-28} y={-60} width={8} height={5} rx={1.5} fill={PALETTE.metal} stroke={ink} strokeWidth={2.5} />
        <rect x={-28} y={-46} width={8} height={5} rx={1.5} fill={PALETTE.metal} stroke={ink} strokeWidth={2.5} />
        <rect x={20} y={-74} width={8} height={5} rx={1.5} fill={PALETTE.metal} stroke={ink} strokeWidth={2.5} />
        <rect x={20} y={-60} width={8} height={5} rx={1.5} fill={PALETTE.metal} stroke={ink} strokeWidth={2.5} />
        <rect x={20} y={-46} width={8} height={5} rx={1.5} fill={PALETTE.metal} stroke={ink} strokeWidth={2.5} />
        <rect x={-22} y={-82} width={44} height={48} rx={8} fill={`url(#${gid})`} stroke={ink} strokeWidth={5} />
        <rect x={-17} y={-78} width={20} height={6} rx={3} fill="#FFFFFF" opacity={0.4} />
        <rect x={-18} y={-40} width={36} height={4} rx={2} fill={dark} opacity={0.35} />
        <path
          d="M -16 -66 H -10 V -58 M 16 -48 H 10 V -54 M -4 -78 V -70"
          fill="none"
          stroke="#FFF3A0"
          strokeWidth={2.5}
          strokeLinecap="round"
          opacity={0.35 + 0.65 * blink}
        />
        <rect x={-10} y={-70} width={20} height={22} rx={4} fill={dark} stroke={ink} strokeWidth={3} />
        <ellipse cx={-3} cy={-59} rx={2.6} ry={4 * eyeBlink} fill="#FFFFFF" />
        <ellipse cx={5} cy={-59} rx={2.6} ry={4 * eyeBlink} fill="#FFFFFF" />
        <circle cx={-2.3} cy={-59} r={1.3} fill={ink} />
        <circle cx={5.7} cy={-59} r={1.3} fill={ink} />
        <circle cx={-10} cy={-58} r={2.2} fill="#FFF3A0" opacity={blink} />
        <circle cx={16} cy={-48} r={2.2} fill="#FFF3A0" opacity={blink2} />
        <circle cx={-4} cy={-78} r={2} fill="#FFFFFF" opacity={blink2} />
      </g>
    </g>
  );
};

/** Ba con chip đối thủ (tím, cam, đỏ) chạy nối đuôi nhau, mạch điện nhấp nháy. */
const BaConChip: FC<PropProps> = ({ frame, seed }) => {
  const dash = (frame * 3) % 20;
  const windA = 0.4 + 0.3 * wobble(frame, seed, 18);
  return (
    <g>
      <ContactShadow halfWidth={86} />
      <g opacity={windA}>
        <line x1={-88} y1={-70} x2={-76 + dash * 0.2} y2={-70} stroke={ink} strokeWidth={3} strokeLinecap="round" />
        <line x1={-88} y1={-54} x2={-80 + dash * 0.2} y2={-54} stroke={ink} strokeWidth={3} strokeLinecap="round" />
        <line x1={-86} y1={-38} x2={-78 + dash * 0.2} y2={-38} stroke={ink} strokeWidth={3} strokeLinecap="round" />
      </g>
      <RunningChip
        x={-52}
        frame={frame}
        phase={0}
        base="#8E5BD9"
        light="#C4A2F5"
        dark="#5E3A9E"
        gid="mk-gen-chip-tim"
      />
      <RunningChip
        x={0}
        frame={frame}
        phase={1.1}
        base="#F39A2B"
        light="#FFCB80"
        dark="#B8661A"
        gid="mk-gen-chip-cam"
      />
      <RunningChip
        x={52}
        frame={frame}
        phase={2.2}
        base="#E8504A"
        light="#FF9A90"
        dark="#A82E2A"
        gid="mk-gen-chip-do"
      />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 100,
  Component: BaConChip,
};
