import type { FC, ReactElement } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, rnd, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const BASE = "#6F8FA6";
const LIGHT = "#A3BCCD";
const SHADE = "#4C677C";
const WIN_ON = "#FFE08A";
const WIN_OFF = "#3A5266";

/** Tòa nhà cao tầng xanh xám, cửa sổ sáng, lắc lư như đang rơi với vệt gió hai bên. */
const ToaNhaCao: FC<PropProps> = ({ frame, seed }) => {
  const w = wobble(frame, seed, 56);
  const tilt = 3.2 * (w < 0 ? -easing.inOut(-w) : easing.inOut(w));
  const bob = 2 * wobble(frame, seed + 3, 28);
  const beacon = 0.5 + 0.5 * Math.sin(frame * 0.25);

  const windows: ReactElement[] = [];
  const cols = 3;
  const rows = 9;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const idx = r * cols + c;
      const lit = rnd(seed, idx) > 0.3;
      const flick = 0.75 + 0.25 * Math.sin(frame * 0.12 + idx * 1.7);
      const wx = -34 + c * 24;
      const wy = -262 + r * 26;
      windows.push(
        <g key={`w${idx}`}>
          <rect
            x={wx}
            y={wy}
            width={18}
            height={16}
            rx={3}
            fill={lit ? WIN_ON : WIN_OFF}
            opacity={lit ? flick : 1}
            stroke={ink}
            strokeWidth={3}
          />
          <rect x={wx + 3} y={wy + 3} width={5} height={6} rx={1.5} fill="#FFFFFF" opacity={lit ? 0.6 : 0.2} />
        </g>,
      );
    }
  }

  const streaks: ReactElement[] = [];
  for (let i = 0; i < 6; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const speed = 7 + rnd(seed + 11, i) * 4;
    const off = rnd(seed + 5, i) * 260;
    const p = ((frame * speed + off) % 260) / 260;
    const y = -20 - p * 250;
    const len = 26 + rnd(seed + 9, i) * 22;
    const x = side * (58 + rnd(seed + 2, i) * 8);
    const fade = Math.sin(p * Math.PI);
    streaks.push(
      <line
        key={`s${i}`}
        x1={x}
        y1={y}
        x2={x}
        y2={y + len}
        stroke="#FFFFFF"
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.85 * fade}
      />,
    );
  }

  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-toa-nha-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={LIGHT} />
          <stop offset="0.45" stopColor={BASE} />
          <stop offset="1" stopColor={SHADE} />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={58} />
      <g transform={`translate(0 ${bob.toFixed(2)}) rotate(${tilt.toFixed(2)})`}>
        <rect x={-46} y={-280} width={92} height={280} rx={8} fill="url(#mk-gen-toa-nha-body)" stroke={ink} strokeWidth={6} />
        <rect x={-40} y={-274} width={8} height={262} rx={4} fill="#FFFFFF" opacity={0.22} />
        <rect x={26} y={-274} width={14} height={262} rx={5} fill={SHADE} opacity={0.35} />
        {windows}
        <rect x={-14} y={-30} width={28} height={30} rx={4} fill={PALETTE.woodDark} stroke={ink} strokeWidth={4} />
        <rect x={-10} y={-26} width={9} height={22} rx={2} fill="#FFFFFF" opacity={0.18} />
        <rect x={-52} y={-292} width={104} height={16} rx={6} fill={SHADE} stroke={ink} strokeWidth={5} />
        <rect x={-48} y={-290} width={60} height={4} rx={2} fill={LIGHT} opacity={0.7} />
        <rect x={-24} y={-306} width={22} height={14} rx={3} fill={PALETTE.metal} stroke={ink} strokeWidth={4} />
        <line x1={20} y1={-292} x2={20} y2={-310} stroke={ink} strokeWidth={5} strokeLinecap="round" />
        <circle cx={20} cy={-312} r={9} fill={PALETTE.alert} opacity={0.3 * beacon} />
        <circle cx={20} cy={-312} r={4.5} fill={PALETTE.alert} stroke={ink} strokeWidth={2} opacity={0.5 + 0.5 * beacon} />
      </g>
      {streaks}
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 72,
  height: 320,
  Component: ToaNhaCao,
};
