import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { clamp, easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const CYCLE = 150;
const BARS = 5;

const sparkle = (x: number, y: number, r: number) =>
  `M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`;

/** Điện thoại thông minh cắm sạc: các vạch pin xanh nảy lên lần lượt cho tới khi đầy, có tia sét nhấp nháy. */
const PhoneCharging: FC<PropProps> = ({ frame, seed }) => {
  const p = (((frame % CYCLE) + CYCLE) % CYCLE) / CYCLE;
  const full = clamp((p - 0.82) / 0.05, 0, 1) * (1 - clamp((p - 0.95) / 0.05, 0, 1));
  const boltGlow = 0.6 + 0.4 * wobble(frame, seed + 3, 18);

  let bump = 0;
  const bars = [] as { s: number; o: number }[];
  for (let i = 0; i < BARS; i++) {
    const local = clamp((p - 0.04 - i * 0.16) / 0.07, 0, 1);
    const s = local <= 0 ? 0 : easing.outBack(1.8)(local);
    if (local > 0 && local < 1) bump = Math.max(bump, Math.sin(local * Math.PI) * 0.025);
    bars.push({ s, o: local > 0 ? 1 : 0 });
  }
  const sx = 1 + bump;
  const sy = 1 - bump * 0.8;

  const bx = -18;
  const by = -168;
  const bw = 36;
  const bh = 72;
  const inner = bh - 8;
  const barH = (inner - 4 * 2.5) / BARS;

  const tw = (i: number) => 0.5 + 0.5 * wobble(frame, seed + 11 + i * 5, 26 + i * 4);

  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-phone6549-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5b6478" />
          <stop offset="1" stopColor="#2c3140" />
        </linearGradient>
        <linearGradient id="mk-gen-phone6549-screen" x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#3d5a8a" />
          <stop offset="1" stopColor="#1d2b4a" />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={62} />

      {/* cable on floor */}
      <path
        d="M40 -8 C56 -8 54 -4 66 -4"
        fill="none"
        stroke={ink}
        strokeWidth={9}
        strokeLinecap="round"
      />
      <path
        d="M40 -8 C56 -8 54 -4 66 -4"
        fill="none"
        stroke="#f2f2f2"
        strokeWidth={4}
        strokeLinecap="round"
      />
      <rect x={64} y={-12} width={14} height={14} rx={3} fill="#f2f2f2" stroke={ink} strokeWidth={4} />
      <rect x={66} y={-9} width={4} height={3} rx={1} fill={PALETTE.metal} opacity={0.8} />

      {/* glow when full */}
      <rect
        x={-52}
        y={-232}
        width={104}
        height={224}
        rx={26}
        fill={PALETTE.ok}
        opacity={0.28 * full * (0.7 + 0.3 * boltGlow)}
      />

      <g transform={`translate(0 -14) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(0 14)`}>
        {/* phone body */}
        <rect
          x={-40}
          y={-222}
          width={80}
          height={206}
          rx={16}
          fill="url(#mk-gen-phone6549-body)"
          stroke={ink}
          strokeWidth={6}
        />
        <rect
          x={-32}
          y={-210}
          width={64}
          height={180}
          rx={9}
          fill="url(#mk-gen-phone6549-screen)"
          stroke={ink}
          strokeWidth={3}
        />
        {/* camera notch */}
        <rect x={-10} y={-216} width={20} height={6} rx={3} fill={ink} />
        <circle cx={6} cy={-213} r={1.6} fill={PALETTE.bitLight} opacity={0.8} />

        {/* battery icon */}
        <rect x={-7} y={by - 7} width={14} height={8} rx={2} fill={ink} />
        <rect
          x={bx}
          y={by}
          width={bw}
          height={bh}
          rx={6}
          fill="#16203a"
          stroke="#e8eef8"
          strokeWidth={4}
        />
        {bars.map((b, i) => {
          const yTop = by + bh - 4 - (i + 1) * barH - i * 2.5;
          const cy = yTop + barH / 2;
          return (
            <g
              key={i}
              opacity={b.o}
              transform={`translate(0 ${cy.toFixed(2)}) scale(${b.s.toFixed(3)}) translate(0 ${(-cy).toFixed(2)})`}
            >
              <rect x={bx + 5} y={yTop} width={bw - 10} height={barH} rx={2.5} fill={PALETTE.ok} />
              <rect
                x={bx + 6}
                y={yTop + 1}
                width={(bw - 10) * 0.45}
                height={barH * 0.4}
                rx={1.5}
                fill="#ffffff"
                opacity={0.45}
              />
            </g>
          );
        })}

        {/* lightning bolt */}
        <circle cx={0} cy={-70} r={16} fill={PALETTE.warn} opacity={0.25 * boltGlow} />
        <path
          d="M4 -86 L-9 -67 L-1 -67 L-5 -54 L10 -73 L2 -73 Z"
          fill={PALETTE.warn}
          stroke={ink}
          strokeWidth={2.5}
          strokeLinejoin="round"
          opacity={0.65 + 0.35 * boltGlow}
        />

        {/* home bar */}
        <rect x={-12} y={-40} width={24} height={4} rx={2} fill="#e8eef8" opacity={0.7} />

        {/* glass highlight (top-left light) */}
        <path d="M-30 -150 L-6 -208 L8 -208 L-30 -118 Z" fill="#ffffff" opacity={0.12} />
        <rect x={-36} y={-212} width={4} height={60} rx={2} fill="#ffffff" opacity={0.35} />
        {/* right side shade */}
        <rect x={33} y={-206} width={4} height={180} rx={2} fill={ink} opacity={0.3} />
        {/* side button */}
        <rect x={40} y={-180} width={5} height={22} rx={2} fill={PALETTE.metalDark} stroke={ink} strokeWidth={2} />
      </g>

      {/* wooden stand */}
      <rect x={-48} y={-22} width={96} height={20} rx={8} fill={PALETTE.wood} stroke={ink} strokeWidth={5} />
      <rect x={-42} y={-19} width={60} height={4} rx={2} fill="#ffffff" opacity={0.3} />
      <rect x={-44} y={-9} width={88} height={5} rx={2.5} fill={PALETTE.woodDark} opacity={0.5} />

      {/* sparkles */}
      <path d={sparkle(-58, -190, 7 + 5 * full)} fill={PALETTE.warn} opacity={0.35 + 0.65 * Math.max(full, tw(0) * 0.5)} />
      <path d={sparkle(58, -150, 6 + 5 * full)} fill="#ffffff" opacity={0.25 + 0.75 * Math.max(full, tw(1) * 0.4)} />
      <path d={sparkle(54, -222, 5 + 4 * full)} fill={PALETTE.ok} opacity={0.3 + 0.7 * Math.max(full, tw(2) * 0.4)} />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 82,
  height: 236,
  Component: PhoneCharging,
};
