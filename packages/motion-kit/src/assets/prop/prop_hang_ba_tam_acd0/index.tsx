import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble, clamp } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const CARD_W = 50;
const CARD_H = 88;
const CARD_TOP = -100;

const Smudge: FC<{ x: number; y: number; w: number }> = ({ x, y, w }) => (
  <g>
    <rect x={x - 1} y={y - 2} width={w + 2} height={8} rx={4} fill="#9aa3b5" opacity={0.25} />
    <rect x={x} y={y} width={w} height={5} rx={2.5} fill="#7d8799" opacity={0.75} />
  </g>
);

const Card: FC<{ cx: number; tilt: number; children?: React.ReactNode; dashed?: boolean; dashOffset?: number; dashOpacity?: number }> = ({
  cx,
  tilt,
  children,
  dashed,
  dashOffset = 0,
  dashOpacity = 1,
}) => {
  const x = cx - CARD_W / 2;
  return (
    <g transform={`rotate(${tilt.toFixed(2)} ${cx} -12)`}>
      <rect x={x + 4} y={CARD_TOP + 4} width={CARD_W} height={CARD_H} rx={8} fill={ink} opacity={0.18} />
      <rect
        x={x}
        y={CARD_TOP}
        width={CARD_W}
        height={CARD_H}
        rx={8}
        fill="url(#mk-gen-card-paper)"
        stroke={dashed ? "none" : ink}
        strokeWidth={5}
      />
      {dashed ? (
        <rect
          x={x}
          y={CARD_TOP}
          width={CARD_W}
          height={CARD_H}
          rx={8}
          fill="none"
          stroke={ink}
          strokeWidth={5}
          strokeDasharray="9 7"
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          opacity={dashOpacity}
        />
      ) : null}
      <rect x={x + 5} y={CARD_TOP + 5} width={6} height={CARD_H - 20} rx={3} fill="#ffffff" opacity={0.7} />
      <path
        d={`M ${x + CARD_W - 14} ${CARD_TOP + CARD_H - 3} L ${x + CARD_W - 3} ${CARD_TOP + CARD_H - 14}`}
        stroke="#c9cfdb"
        strokeWidth={3}
        strokeLinecap="round"
      />
      {children}
    </g>
  );
};

/** Ba tấm thẻ giấy: hai tấm có chữ nhòe, tấm cuối trống viền nét đứt, dấu chấm hỏi nảy lên phía trên. */
const HangBaTamThe: FC<PropProps> = ({ frame, seed }) => {
  const period = 36;
  const p = (frame % period) / period;
  const up = p < 0.5 ? easing.out(p * 2) : 1 - easing.in((p - 0.5) * 2);
  const qY = -112 - up * 26;
  const land = clamp(1 - Math.min(p, 1 - p) * 8, 0, 1);
  const sx = 1 + 0.18 * land;
  const sy = 1 - 0.2 * land;
  const blink = 0.45 + 0.55 * (0.5 + 0.5 * Math.cos((frame / 24) * Math.PI * 2));
  const dashOffset = -(frame * 0.8);
  const tilt1 = 1.5 * wobble(frame, seed, 80);
  const tilt2 = 1.2 * wobble(frame, seed + 3, 90);
  const tilt3 = 2 * wobble(frame, seed + 5, 70);
  const glow = 0.5 + 0.5 * wobble(frame, seed + 9, 30);

  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-card-paper" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.6" stopColor={PALETTE.paper} />
          <stop offset="1" stopColor="#dfe3ec" />
        </linearGradient>
        <linearGradient id="mk-gen-card-ledge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={PALETTE.wood} />
          <stop offset="1" stopColor={PALETTE.woodDark} />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={86} />

      <Card cx={-58} tilt={tilt1}>
        <Smudge x={-76} y={-88} w={34} />
        <Smudge x={-76} y={-74} w={26} />
        <Smudge x={-76} y={-60} w={32} />
        <Smudge x={-76} y={-46} w={20} />
      </Card>
      <Card cx={0} tilt={tilt2}>
        <Smudge x={-18} y={-88} w={30} />
        <Smudge x={-18} y={-74} w={34} />
        <Smudge x={-18} y={-60} w={22} />
        <Smudge x={-18} y={-46} w={30} />
      </Card>
      <Card cx={58} tilt={tilt3} dashed dashOffset={dashOffset} dashOpacity={blink}>
        <circle cx={58} cy={-56} r={16} fill={PALETTE.accent} opacity={0.12 + 0.12 * glow} />
      </Card>

      <rect x={-86} y={-16} width={172} height={14} rx={6} fill="url(#mk-gen-card-ledge)" stroke={ink} strokeWidth={5} />
      <rect x={-80} y={-13} width={150} height={3} rx={1.5} fill="#ffffff" opacity={0.3} />

      <g transform={`translate(58 ${qY.toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)})`}>
        <circle cx={0} cy={-14} r={20} fill={PALETTE.warn} opacity={0.15 + 0.15 * glow} />
        <path
          d="M -9 -24 C -9 -38, 11 -38, 11 -25 C 11 -16, 1 -16, 1 -7"
          fill="none"
          stroke={ink}
          strokeWidth={11}
          strokeLinecap="round"
        />
        <path
          d="M -9 -24 C -9 -38, 11 -38, 11 -25 C 11 -16, 1 -16, 1 -7"
          fill="none"
          stroke={PALETTE.accent}
          strokeWidth={5}
          strokeLinecap="round"
        />
        <circle cx={1} cy={3} r={5.5} fill={PALETTE.accent} stroke={ink} strokeWidth={3} />
        <circle cx={-6} cy={-30} r={1.8} fill="#ffffff" opacity={0.8} />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 180,
  Component: HangBaTamThe,
};
