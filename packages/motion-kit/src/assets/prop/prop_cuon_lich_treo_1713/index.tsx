import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { rnd, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const ice = "#bfe6f7";
const iceDeep = "#7cc4e4";

/** Lịch treo dừng ở một trang và đồng hồ đóng băng, tuyết rơi nhẹ quanh. */
const FrozenCalendarClock: FC<PropProps> = ({ frame, seed }) => {
  const swing = 2.2 * wobble(frame, seed, 90);
  const glint = 0.5 + 0.5 * wobble(frame, seed + 3, 40);
  const shiver = 0.6 * wobble(frame, seed + 9, 24);

  const cells = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      cells.push(
        <rect
          key={`c${r}-${c}`}
          x={-68 + c * 15}
          y={-150 + r * 13}
          width={11}
          height={9}
          rx={2}
          fill={r === 3 && c > 2 ? "#e9e4da" : "#f3efe6"}
          stroke="#c9c1b2"
          strokeWidth={1.5}
        />,
      );
    }
  }

  const flakes = [];
  for (let i = 0; i < 7; i++) {
    const baseX = -78 + rnd(seed, i) * 156;
    const speed = 0.5 + rnd(seed + 1, i) * 0.4;
    const span = 220;
    const y = -235 + ((frame * speed + rnd(seed + 2, i) * span) % span);
    const x = baseX + 5 * wobble(frame, seed + 20 + i, 50 + i * 7);
    const rot = (frame * (1 + i * 0.3)) % 360;
    const fade = Math.min(1, (y + 235) / 30, (-15 - y) / 30);
    const s = 3.5 + rnd(seed + 4, i) * 2.5;
    flakes.push(
      <g
        key={`f${i}`}
        transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${rot.toFixed(1)})`}
        opacity={Math.max(0, fade) * 0.9}
      >
        <line x1={-s} y1={0} x2={s} y2={0} stroke="#ffffff" strokeWidth={2.2} strokeLinecap="round" />
        <line x1={-s / 2} y1={-s * 0.87} x2={s / 2} y2={s * 0.87} stroke="#ffffff" strokeWidth={2.2} strokeLinecap="round" />
        <line x1={-s / 2} y1={s * 0.87} x2={s / 2} y2={-s * 0.87} stroke="#ffffff" strokeWidth={2.2} strokeLinecap="round" />
        <circle cx={0} cy={0} r={1.4} fill={iceDeep} />
      </g>,
    );
  }

  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-cal-ice" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity={0.9} />
          <stop offset="0.5" stopColor={ice} stopOpacity={0.7} />
          <stop offset="1" stopColor={iceDeep} stopOpacity={0.8} />
        </linearGradient>
        <linearGradient id="mk-gen-cal-page" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#ece6d8" />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={82} />

      {/* wooden stand */}
      <rect x={-62} y={-12} width={58} height={12} rx={5} fill={PALETTE.woodDark} stroke={ink} strokeWidth={5} />
      <rect x={-39} y={-220} width={12} height={210} rx={4} fill={PALETTE.wood} stroke={ink} strokeWidth={5} />
      <rect x={-36} y={-215} width={3} height={196} rx={1.5} fill="#ffffff" opacity={0.3} />
      <circle cx={-33} cy={-212} r={5} fill={PALETTE.metal} stroke={ink} strokeWidth={3} />

      {/* hanging calendar */}
      <g transform={`rotate(${swing.toFixed(2)} -33 -212)`}>
        <path d="M -60 -190 L -33 -212 L -6 -190" fill="none" stroke={ink} strokeWidth={3} strokeLinejoin="round" />
        <rect x={-76} y={-192} width={86} height={108} rx={8} fill="url(#mk-gen-cal-page)" stroke={ink} strokeWidth={6} />
        <path d="M -76 -184 Q -76 -192 -68 -192 L 2 -192 Q 10 -192 10 -184 L 10 -160 L -76 -160 Z" fill={PALETTE.alert} stroke={ink} strokeWidth={5} strokeLinejoin="round" />
        <rect x={-70} y={-187} width={40} height={6} rx={3} fill="#ffffff" opacity={0.35} />
        <rect x={-76} y={-166} width={86} height={6} fill={ink} opacity={0.15} />
        <circle cx={-55} cy={-192} r={5} fill={PALETTE.metal} stroke={ink} strokeWidth={3} />
        <circle cx={-11} cy={-192} r={5} fill={PALETTE.metal} stroke={ink} strokeWidth={3} />
        {cells}
        <circle cx={-32.5} cy={-123.5} r={9} fill="none" stroke={PALETTE.alert} strokeWidth={3} />
        {/* frost on the calendar edge */}
        <path d="M -76 -100 Q -60 -94 -48 -100 Q -36 -92 -22 -98 Q -8 -92 10 -100 L 10 -92 Q 10 -84 2 -84 L -68 -84 Q -76 -84 -76 -92 Z" fill="url(#mk-gen-cal-ice)" opacity={0.85} />
        <path d="M 10 -110 L -2 -84 L 10 -84 Z" fill="#d9d1bf" stroke={ink} strokeWidth={3} strokeLinejoin="round" />
        <rect x={-74} y={-158} width={4} height={60} rx={2} fill={ink} opacity={0.08} />
      </g>

      {/* frozen alarm clock */}
      <g transform={`translate(${shiver.toFixed(2)} 0)`}>
        <line x1={34} y1={-30} x2={28} y2={-6} stroke={ink} strokeWidth={6} strokeLinecap="round" />
        <line x1={70} y1={-30} x2={76} y2={-6} stroke={ink} strokeWidth={6} strokeLinecap="round" />
        <path d="M 30 -88 A 11 11 0 0 1 46 -100 Z" fill={PALETTE.warn} stroke={ink} strokeWidth={4} strokeLinejoin="round" />
        <path d="M 74 -88 A 11 11 0 0 0 58 -100 Z" fill={PALETTE.warn} stroke={ink} strokeWidth={4} strokeLinejoin="round" />
        <circle cx={52} cy={-58} r={30} fill={PALETTE.accent} stroke={ink} strokeWidth={6} />
        <circle cx={52} cy={-58} r={22} fill={PALETTE.paper} stroke={ink} strokeWidth={3} />
        <circle cx={52} cy={-77} r={2} fill={ink} />
        <circle cx={71} cy={-58} r={2} fill={ink} />
        <circle cx={52} cy={-39} r={2} fill={ink} />
        <circle cx={33} cy={-58} r={2} fill={ink} />
        <line x1={52} y1={-58} x2={52} y2={-73} stroke={ink} strokeWidth={4} strokeLinecap="round" />
        <line x1={52} y1={-58} x2={63} y2={-52} stroke={ink} strokeWidth={4} strokeLinecap="round" />
        <circle cx={52} cy={-58} r={3} fill={PALETTE.alert} />
        {/* ice shell */}
        <circle cx={52} cy={-58} r={31} fill="url(#mk-gen-cal-ice)" opacity={0.5} />
        <path d="M 30 -78 Q 46 -92 66 -84" fill="none" stroke="#ffffff" strokeWidth={4} strokeLinecap="round" opacity={0.85} />
        <path d="M 40 -50 L 46 -60 L 44 -66" fill="none" stroke="#ffffff" strokeWidth={2} strokeLinecap="round" opacity={0.7} />
        <path d="M 66 -46 L 60 -52 L 64 -60" fill="none" stroke="#ffffff" strokeWidth={2} strokeLinecap="round" opacity={0.7} />
        <path d="M 30 -46 Q 52 -24 74 -46 L 70 -38 L 66 -24 L 62 -34 L 56 -20 L 50 -32 L 44 -22 L 40 -36 L 35 -28 Z" fill={ice} stroke={iceDeep} strokeWidth={2.5} strokeLinejoin="round" />
        <path d="M 66 -64 Q 74 -58 70 -48" fill="none" stroke={ink} strokeWidth={3} opacity={0.15} />
        {/* glint sparkle */}
        <g transform="translate(38 -74)" opacity={glint}>
          <path d="M 0 -8 L 2 -2 L 8 0 L 2 2 L 0 8 L -2 2 L -8 0 L -2 -2 Z" fill="#ffffff" />
        </g>
      </g>

      {flakes}
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 85,
  height: 240,
  Component: FrozenCalendarClock,
};
