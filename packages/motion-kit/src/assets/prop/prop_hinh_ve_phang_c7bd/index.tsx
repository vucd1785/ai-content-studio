import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble, easing } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

const W = 84;
const TOP = -196;
const CABLE_Y = -44;
const CABLE_H = 26;

const Fish: FC<{ x: number; y: number; s: number; color: string; dark: string; tail: number; dir: number }> = ({
  x,
  y,
  s,
  color,
  dark,
  tail,
  dir,
}) => (
  <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${(s * dir).toFixed(3)} ${s.toFixed(3)})`}>
    <path
      d={`M -14 0 L -26 ${(-9 + tail).toFixed(2)} L -26 ${(9 + tail).toFixed(2)} Z`}
      fill={dark}
      stroke={ink}
      strokeWidth={3}
      strokeLinejoin="round"
    />
    <ellipse cx={0} cy={0} rx={17} ry={11} fill={color} stroke={ink} strokeWidth={3.5} />
    <path d="M -4 -10 Q 2 -17 8 -9" fill={dark} stroke={ink} strokeWidth={2.5} strokeLinejoin="round" />
    <ellipse cx={-2} cy={-4} rx={8} ry={3} fill="#ffffff" opacity={0.45} />
    <circle cx={8} cy={-2} r={3.2} fill="#ffffff" stroke={ink} strokeWidth={1.5} />
    <circle cx={8.8} cy={-2} r={1.6} fill={ink} />
  </g>
);

/** Ống cáp quang nằm dưới đáy biển: vệt sáng chạy dọc bên trong, cá nhỏ bơi ngang qua. */
const SubseaFiberCable: FC<PropProps> = ({ frame, seed }) => {
  const id = `mk-gen-sea-${seed}`;
  const sway = wobble(frame, seed, 60);
  const sway2 = wobble(frame, seed + 3, 75);
  const pulse = 0.5 + 0.5 * Math.sin(frame * 0.15);
  const span = 2 * W + 40;

  const streaks = [0, 1, 2, 3].map((i) => {
    const p = ((frame * 3.2 + i * (span / 4)) % span) / span;
    return { x: -W - 20 + easing.linear(p) * span, i };
  });

  const fishPhase = (speed: number, off: number) => {
    const p = ((frame * speed + off) % 260) / 260;
    return -W - 30 + p * (2 * W + 60);
  };
  const f1x = fishPhase(1.1, 30);
  const f2x = -fishPhase(0.8, 140);
  const f3x = fishPhase(1.4, 200);
  const tail = Math.sin(frame * 0.5) * 3;

  const bubbles = [0, 1, 2].map((i) => {
    const p = ((frame * 0.9 + i * 50) % 150) / 150;
    return { x: -50 + i * 42 + Math.sin(frame * 0.1 + i) * 4, y: -70 - p * 120, o: 1 - p, r: 3 + i };
  });

  return (
    <g>
      <defs>
        <linearGradient id={`${id}-water`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5fc7e8" />
          <stop offset="1" stopColor="#1f6fa8" />
        </linearGradient>
        <linearGradient id={`${id}-cable`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a6b82" />
          <stop offset="0.5" stopColor={PALETTE.metalDark} />
          <stop offset="1" stopColor="#1e2633" />
        </linearGradient>
        <clipPath id={`${id}-panel`}>
          <rect x={-W} y={TOP} width={2 * W} height={-TOP} rx={22} />
        </clipPath>
        <clipPath id={`${id}-core`}>
          <rect x={-W} y={CABLE_Y + 7} width={2 * W} height={CABLE_H - 14} rx={6} />
        </clipPath>
      </defs>
      <ContactShadow halfWidth={86} />
      <g clipPath={`url(#${id}-panel)`}>
        <rect x={-W} y={TOP} width={2 * W} height={-TOP} fill={`url(#${id}-water)`} />
        {/* light rays from top-left */}
        <path d={`M -70 ${TOP} L -40 ${TOP} L 10 -60 L -30 -60 Z`} fill="#ffffff" opacity={0.12 + 0.06 * pulse} />
        <path d={`M -20 ${TOP} L 0 ${TOP} L 50 -70 L 25 -70 Z`} fill="#ffffff" opacity={0.08} />
        {/* seaweed */}
        <path
          d={`M -62 -14 Q ${(-72 + sway * 8).toFixed(2)} -60 ${(-60 + sway * 12).toFixed(2)} -110`}
          fill="none"
          stroke={PALETTE.leaf}
          strokeWidth={9}
          strokeLinecap="round"
        />
        <path
          d={`M 64 -14 Q ${(74 + sway2 * 8).toFixed(2)} -50 ${(62 + sway2 * 12).toFixed(2)} -92`}
          fill="none"
          stroke="#2f8a4e"
          strokeWidth={8}
          strokeLinecap="round"
        />
        {/* fish */}
        <Fish x={f1x} y={-150 + wobble(frame, seed + 1, 40) * 5} s={0.9} color={PALETTE.warn} dark="#d9822b" tail={tail} dir={1} />
        <Fish x={f2x} y={-112 + wobble(frame, seed + 2, 50) * 5} s={0.7} color="#ff8fa3" dark="#d65a73" tail={-tail} dir={-1} />
        <Fish x={f3x} y={-176 + wobble(frame, seed + 4, 45) * 4} s={0.55} color={PALETTE.ok} dark="#2f8a4e" tail={tail} dir={1} />
        {/* bubbles */}
        {bubbles.map((b, i) => (
          <circle key={i} cx={b.x} cy={b.y} r={b.r} fill="#ffffff" opacity={0.5 * b.o} stroke="#ffffff" strokeWidth={1.5} />
        ))}
        {/* sand */}
        <path d={`M ${-W} -24 Q -40 -34 0 -26 Q 44 -18 ${W} -30 L ${W} 0 L ${-W} 0 Z`} fill="#f2d49b" />
        <path d={`M ${-W} -10 Q -30 -16 10 -8 Q 50 -2 ${W} -12 L ${W} 0 L ${-W} 0 Z`} fill="#c99a5b" opacity={0.6} />
        <circle cx={-30} cy={-14} r={4} fill="#c99a5b" />
        <circle cx={40} cy={-10} r={3} fill="#c99a5b" />
        {/* cable */}
        <rect x={-W - 10} y={CABLE_Y} width={2 * W + 20} height={CABLE_H} rx={13} fill={`url(#${id}-cable)`} stroke={ink} strokeWidth={5} />
        <rect x={-W} y={CABLE_Y + 7} width={2 * W} height={CABLE_H - 14} rx={6} fill="#123047" />
        <g clipPath={`url(#${id}-core)`}>
          {streaks.map((s) => (
            <g key={s.i}>
              <rect x={s.x - 22} y={CABLE_Y + 7} width={44} height={CABLE_H - 14} rx={6} fill={PALETTE.screen} opacity={0.35} />
              <rect x={s.x - 12} y={CABLE_Y + 10} width={24} height={CABLE_H - 20} rx={3} fill="#ffffff" opacity={0.9} />
            </g>
          ))}
        </g>
        <rect x={-W + 6} y={CABLE_Y + 3} width={2 * W - 12} height={3} rx={1.5} fill="#ffffff" opacity={0.35} />
        {/* cable bands */}
        {[-50, 0, 50].map((bx) => (
          <rect key={bx} x={bx - 4} y={CABLE_Y - 2} width={8} height={CABLE_H + 4} rx={3} fill={PALETTE.metal} stroke={ink} strokeWidth={3} />
        ))}
      </g>
      <rect x={-W} y={TOP} width={2 * W} height={-TOP} rx={22} fill="none" stroke={ink} strokeWidth={6} />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 200,
  Component: SubseaFiberCable,
};
