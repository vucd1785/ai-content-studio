import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const HAT = "#FFFFFF";
const HAT_SHADE = "#D9E2EA";
const BOARD = "#E8B878";

const ROWS = [3, 2, 1, 0];
const COLS = [-2, -1, 0, 1, 2];

const chopLift = (frame: number, delay: number): number => {
  const period = 14;
  const raw = (((frame - delay) % period) + period) % period;
  const p = raw / period;
  if (p < 0.6) return easing.inOut(p / 0.6);
  return 1 - easing.in((p - 0.6) / 0.4);
};

/** Một phụ bếp người que đứng sau quầy, tay phải cầm dao chặt xuống thớt. */
const Cook: FC<{ x: number; y: number; s: number; lift: number; lag: number; sway: number }> = ({
  x,
  y,
  s,
  lift,
  lag,
  sway,
}) => {
  const handY = -7 - lift * 13;
  const knifeRot = -lift * 28;
  const squash = 1 - (1 - lift) * 0.04;
  const hatTilt = (lag - lift) * 10 + sway * 2;
  const sliceHop = (1 - lift) * (1 - lift) * 2;
  return (
    <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${s.toFixed(3)})`}>
      {/* thớt */}
      <rect x={-13} y={-4} width={28} height={5} rx={2} fill={BOARD} stroke={ink} strokeWidth={2.5} />
      <rect x={-11} y={-3.5} width={14} height={1.5} rx={0.75} fill="#FFFFFF" opacity={0.45} />
      {/* rau & lát rau */}
      <ellipse cx={-6} cy={-7} rx={6} ry={3.2} fill={PALETTE.leaf} stroke={ink} strokeWidth={2} />
      <ellipse cx={-7.5} cy={-8} rx={2.5} ry={1} fill="#FFFFFF" opacity={0.5} />
      <circle cx={6} cy={-5.5 - sliceHop} r={2} fill={PALETTE.leaf} stroke={ink} strokeWidth={1.2} />
      <circle cx={10} cy={-5.5} r={2} fill={PALETTE.leaf} stroke={ink} strokeWidth={1.2} />
      <g transform={`scale(1 ${squash.toFixed(3)})`}>
        {/* thân */}
        <line x1={0} y1={-5} x2={sway * 0.8} y2={-31} stroke={ink} strokeWidth={3.5} strokeLinecap="round" />
        {/* tay trái giữ rau */}
        <polyline
          points={`${sway * 0.8},-27 -9,-18 -8,-9`}
          fill="none"
          stroke={ink}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* tay phải cầm dao */}
        <polyline
          points={`${sway * 0.8},-27 10,${(-20 - lift * 6).toFixed(2)} 7,${handY.toFixed(2)}`}
          fill="none"
          stroke={ink}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <g transform={`translate(7 ${handY.toFixed(2)}) rotate(${knifeRot.toFixed(2)})`}>
          <rect x={-1} y={-1.5} width={4} height={3} rx={1} fill={PALETTE.woodDark} stroke={ink} strokeWidth={1.2} />
          <path d="M3 -2 L12 -2 L12 1 Q8 4 3 2 Z" fill={PALETTE.metal} stroke={ink} strokeWidth={1.5} strokeLinejoin="round" />
          <line x1={4} y1={-1} x2={10} y2={-1} stroke="#FFFFFF" strokeWidth={0.8} opacity={0.7} />
        </g>
        {/* đầu */}
        <circle cx={sway * 0.8} cy={-38} r={7.5} fill={PALETTE.tiSkin} stroke={ink} strokeWidth={2.5} />
        <circle cx={sway * 0.8 + 3} cy={-38} r={1.2} fill={ink} />
        <circle cx={sway * 0.8 - 2.5} cy={-40.5} r={2} fill="#FFFFFF" opacity={0.45} />
        {/* mũ đầu bếp */}
        <g transform={`translate(${(sway * 0.8).toFixed(2)} -45) rotate(${hatTilt.toFixed(2)})`}>
          <rect x={-6.5} y={-5} width={13} height={5} rx={1.5} fill={HAT} stroke={ink} strokeWidth={2} />
          <path
            d="M-6 -5 Q-11 -9 -7 -14 Q-5 -19 0 -16 Q5 -19 7 -14 Q11 -9 6 -5 Z"
            fill={HAT}
            stroke={ink}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <path d="M2 -6 Q7 -9 6 -13" fill="none" stroke={HAT_SHADE} strokeWidth={2.5} strokeLinecap="round" />
          <ellipse cx={-3.5} cy={-13} rx={2} ry={1.4} fill="#FFFFFF" opacity={0.9} />
        </g>
      </g>
    </g>
  );
};

/** Hàng trăm phụ bếp que tí hon đội mũ trắng xếp lưới, cùng lúc thái rau trên thớt nhỏ. */
const TinyCookGrid: FC<PropProps> = ({ frame, seed }) => {
  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-cookgrid-counter" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={PALETTE.wood} />
          <stop offset="1" stopColor={PALETTE.woodDark} />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={88} />
      {ROWS.map((i) => {
        const s = 1 - i * 0.13;
        const g = -i * 40;
        const top = g - 24 * s;
        const half = 86 * s;
        const spacing = 33 * s;
        const delay = i * 1.2;
        const lift = chopLift(frame, delay);
        const lag = chopLift(frame, delay + 2);
        return (
          <g key={`row-${i}`}>
            {COLS.map((c) => {
              const sway = wobble(frame, seed + i * 11 + c * 3, 60);
              return (
                <Cook
                  key={`cook-${i}-${c}`}
                  x={c * spacing}
                  y={top}
                  s={s}
                  lift={lift}
                  lag={lag}
                  sway={sway}
                />
              );
            })}
            {/* mặt trước quầy */}
            <rect
              x={-half}
              y={top}
              width={half * 2}
              height={g - top}
              rx={4 * s}
              fill="url(#mk-gen-cookgrid-counter)"
              stroke={ink}
              strokeWidth={5}
            />
            <rect
              x={-half + 6 * s}
              y={top + 3 * s}
              width={half * 1.1}
              height={3.5 * s}
              rx={1.75 * s}
              fill="#FFFFFF"
              opacity={0.35}
            />
            <rect
              x={-half + 4}
              y={g - 7 * s}
              width={half * 2 - 8}
              height={4 * s}
              fill={ink}
              opacity={0.18}
            />
            {COLS.map((c) => (
              <circle
                key={`knob-${i}-${c}`}
                cx={c * spacing}
                cy={top + 14 * s}
                r={2.2 * s}
                fill={PALETTE.woodDark}
                stroke={ink}
                strokeWidth={1.5}
              />
            ))}
          </g>
        );
      })}
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 200,
  Component: TinyCookGrid,
};
