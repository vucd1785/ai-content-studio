import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { clamp, easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const BODY = "#1f6b3a";
const BODY_LIGHT = "#3fa45f";
const BODY_DARK = "#124a27";
const CORE_OFF = "#0e3a20";
const CORE_ON = "#7dff9a";

const PIN_POS = [-40, -24, -8, 8, 24, 40];
const CELL = 15;
const GAP = 4;

/** Chip GPU xanh lá: lưới lõi sáng lần lượt như đang tính toán song song, chip nhún nhẹ. */
const ChipGpu: FC<PropProps> = ({ frame, seed }) => {
  const bobRaw = 0.5 + 0.5 * Math.sin(frame * 0.08);
  const bob = -4 * easing.inOut(bobRaw);
  const squash = 1 + 0.015 * Math.sin(frame * 0.08 + Math.PI);
  const halo = 0.5 + 0.5 * wobble(frame, seed, 50);
  const sparkle = clamp(Math.sin(frame * 0.12 + seed) * 1.6 - 0.4, 0, 1);
  const cy = -80;

  const cells = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const i = r * 4 + c;
      const wave = Math.sin(frame * 0.2 - (r + c) * 0.9 - (i % 3) * 0.35);
      const on = easing.inOut(clamp(wave * 0.5 + 0.5, 0, 1));
      const x = -36 + c * (CELL + GAP);
      const y = cy - 36 + r * (CELL + GAP);
      cells.push(
        <g key={i}>
          <rect x={x} y={y} width={CELL} height={CELL} rx={3} fill={CORE_OFF} />
          <rect
            x={x - 2}
            y={y - 2}
            width={CELL + 4}
            height={CELL + 4}
            rx={5}
            fill={CORE_ON}
            opacity={0.3 * on}
          />
          <rect
            x={x + 1.5}
            y={y + 1.5}
            width={CELL - 3}
            height={CELL - 3}
            rx={2}
            fill={CORE_ON}
            opacity={0.15 + 0.85 * on}
          />
          <rect x={x + 3} y={y + 3} width={4} height={3} rx={1} fill="#ffffff" opacity={0.6 * on} />
        </g>,
      );
    }
  }

  return (
    <g>
      <ContactShadow halfWidth={66} />
      <defs>
        <linearGradient id="mk-gen-gpu-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={BODY_LIGHT} />
          <stop offset="0.5" stopColor={BODY} />
          <stop offset="1" stopColor={BODY_DARK} />
        </linearGradient>
        <radialGradient id="mk-gen-gpu-halo" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={CORE_ON} stopOpacity={0.55} />
          <stop offset="1" stopColor={CORE_ON} stopOpacity={0} />
        </radialGradient>
      </defs>
      <g transform={`translate(0 ${bob.toFixed(2)}) scale(${(2 - squash).toFixed(4)} ${squash.toFixed(4)})`}>
        <circle cx={0} cy={cy} r={78} fill="url(#mk-gen-gpu-halo)" opacity={0.4 + 0.5 * halo} />
        {PIN_POS.map((p) => (
          <g key={`p${p}`}>
            <rect x={p - 4} y={cy - 70} width={8} height={16} rx={2} fill={PALETTE.metal} stroke={ink} strokeWidth={3} />
            <rect x={p - 4} y={cy + 54} width={8} height={16} rx={2} fill={PALETTE.metalDark} stroke={ink} strokeWidth={3} />
            <rect x={-70} y={cy + p - 4} width={16} height={8} rx={2} fill={PALETTE.metal} stroke={ink} strokeWidth={3} />
            <rect x={54} y={cy + p - 4} width={16} height={8} rx={2} fill={PALETTE.metalDark} stroke={ink} strokeWidth={3} />
          </g>
        ))}
        <rect
          x={-56}
          y={cy - 56}
          width={112}
          height={112}
          rx={12}
          fill="url(#mk-gen-gpu-body)"
          stroke={ink}
          strokeWidth={6}
        />
        <path
          d={`M ${-48} ${cy + 40} L ${-48} ${cy - 40} Q ${-48} ${cy - 48} ${-40} ${cy - 48} L ${40} ${cy - 48}`}
          fill="none"
          stroke="#ffffff"
          strokeWidth={4}
          strokeLinecap="round"
          opacity={0.35}
        />
        <path
          d={`M ${50} ${cy - 30} L ${50} ${cy + 42} Q ${50} ${cy + 50} ${42} ${cy + 50} L ${-30} ${cy + 50}`}
          fill="none"
          stroke={BODY_DARK}
          strokeWidth={5}
          strokeLinecap="round"
          opacity={0.6}
        />
        <rect
          x={-42}
          y={cy - 42}
          width={84}
          height={84}
          rx={8}
          fill={BODY_DARK}
          stroke={ink}
          strokeWidth={4}
        />
        {cells}
        <circle cx={-46} cy={cy - 46} r={4} fill={PALETTE.metal} stroke={ink} strokeWidth={2} />
        <circle cx={46} cy={cy + 46} r={3} fill={BODY_LIGHT} opacity={0.8} />
        <g transform={`translate(${-34} ${cy - 50}) scale(${(0.4 + 0.6 * sparkle).toFixed(3)})`} opacity={sparkle}>
          <path d="M 0 -10 L 2.5 -2.5 L 10 0 L 2.5 2.5 L 0 10 L -2.5 2.5 L -10 0 L -2.5 -2.5 Z" fill="#ffffff" />
        </g>
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 80,
  height: 170,
  Component: ChipGpu,
};
