import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { clamp, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";

const ink = PALETTE.ink;
const BASE = "#3cc8b4";
const LIGHT = "#9af2e3";
const DARK = "#1f8f86";
const BELLY = "#ffe7a3";
const HORN = "#ffd36b";
const BLUSH = "#ff9db0";

const SEGS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

type Pt = { x: number; y: number; r: number };

const spine = (u: number, ph: number): Pt => {
  const x = -68 + 98 * u;
  const amp = 15 * (1 - 0.45 * u);
  const y = -112 + amp * Math.sin(ph - u * 5.6);
  const r = 8 + 9 * u;
  return { x, y, r };
};

/** Rồng Việt nhỏ xanh ngọc, thân uốn lượn như con sông, bay nhấp nhô. */
const RiverDragon: FC<PropProps> = ({ frame, seed }) => {
  const ph = frame * 0.13 + seed * 0.37;
  const bob = 6 * Math.sin(frame * 0.065 + seed);
  const pts = SEGS.map((i) => spine(i / 10, ph));
  const head = spine(1, ph);
  const neck = spine(0.9, ph);
  const tilt = clamp(
    (Math.atan2(head.y - neck.y, head.x - neck.x) * 180) / Math.PI,
    -16,
    16,
  );
  const hx = head.x + 12;
  const hy = head.y - 8;
  const tail = spine(0, ph);
  const tailSwing = 10 * Math.sin(ph - 0.6);
  const cyc = Math.abs(Math.floor(frame + seed * 13)) % 96;
  const blink = cyc < 5 ? 0.15 : 1;
  const whisk = 5 * wobble(frame, seed + 3, 40);
  const legA = spine(0.32, ph);
  const legB = spine(0.68, ph);
  const paddle = 5 * Math.sin(frame * 0.2);
  const tw1 = 0.5 + 0.5 * Math.sin(frame * 0.15);
  const tw2 = 0.5 + 0.5 * Math.sin(frame * 0.15 + 2.1);
  const tw3 = 0.5 + 0.5 * Math.sin(frame * 0.15 + 4.2);

  const star = (cx: number, cy: number, s: number, o: number) => (
    <path
      d={`M ${cx} ${cy - s} Q ${cx} ${cy} ${cx + s} ${cy} Q ${cx} ${cy} ${cx} ${cy + s} Q ${cx} ${cy} ${cx - s} ${cy} Q ${cx} ${cy} ${cx} ${cy - s} Z`}
      fill={HORN}
      stroke={ink}
      strokeWidth={2}
      opacity={0.35 + 0.65 * o}
      transform={`translate(${cx} ${cy}) scale(${(0.7 + 0.3 * o).toFixed(3)}) translate(${-cx} ${-cy})`}
    />
  );

  return (
    <g>
      <defs>
        <radialGradient id="mk-gen-dragon-body" cx="35%" cy="28%" r="75%">
          <stop offset="0%" stopColor={LIGHT} />
          <stop offset="55%" stopColor={BASE} />
          <stop offset="100%" stopColor={DARK} />
        </radialGradient>
      </defs>

      {star(-60, -178, 8, tw1)}
      {star(66, -170, 7, tw2)}
      {star(-14, -52, 6, tw3)}

      <g transform={`translate(0 ${bob.toFixed(2)})`}>
        {/* legs */}
        {[legA, legB].map((p, k) => (
          <g key={`leg${k}`}>
            <path
              d={`M ${p.x - 4} ${p.y + p.r - 4} Q ${p.x - 6 + (k ? -paddle : paddle)} ${p.y + p.r + 12} ${p.x + 4 + (k ? -paddle : paddle)} ${p.y + p.r + 16}`}
              stroke={ink}
              strokeWidth={10}
              strokeLinecap="round"
              fill="none"
            />
            <path
              d={`M ${p.x - 4} ${p.y + p.r - 4} Q ${p.x - 6 + (k ? -paddle : paddle)} ${p.y + p.r + 12} ${p.x + 4 + (k ? -paddle : paddle)} ${p.y + p.r + 16}`}
              stroke={DARK}
              strokeWidth={5}
              strokeLinecap="round"
              fill="none"
            />
          </g>
        ))}

        {/* dorsal spikes */}
        {pts.map((p, i) =>
          i > 0 && i < 10 ? (
            <path
              key={`sp${i}`}
              d={`M ${p.x - 6} ${p.y - p.r + 3} L ${p.x - 1} ${p.y - p.r - 10} L ${p.x + 6} ${p.y - p.r + 3} Z`}
              fill={HORN}
              stroke={ink}
              strokeWidth={3}
              strokeLinejoin="round"
            />
          ) : null,
        )}

        {/* tail fin */}
        <path
          d={`M ${tail.x + 4} ${tail.y - 2} Q ${tail.x - 14} ${tail.y - 22 + tailSwing} ${tail.x - 18} ${tail.y - 8 + tailSwing} Q ${tail.x - 10} ${tail.y - 4} ${tail.x - 18} ${tail.y + 10 + tailSwing * 0.5} Q ${tail.x - 4} ${tail.y + 12} ${tail.x + 4} ${tail.y + 4} Z`}
          fill={DARK}
          stroke={ink}
          strokeWidth={4}
          strokeLinejoin="round"
        />

        {/* body outline pass */}
        {pts.map((p, i) => (
          <circle key={`o${i}`} cx={p.x} cy={p.y} r={p.r + 3.5} fill={ink} />
        ))}
        {/* body fill pass */}
        {pts.map((p, i) => (
          <circle key={`f${i}`} cx={p.x} cy={p.y} r={p.r} fill="url(#mk-gen-dragon-body)" />
        ))}
        {/* belly scales */}
        {pts.map((p, i) => (
          <ellipse
            key={`b${i}`}
            cx={p.x}
            cy={p.y + p.r * 0.5}
            rx={p.r * 0.62}
            ry={p.r * 0.36}
            fill={BELLY}
            opacity={0.9}
          />
        ))}
        {/* shade + highlight layers */}
        {pts.map((p, i) => (
          <circle
            key={`s${i}`}
            cx={p.x + p.r * 0.35}
            cy={p.y + p.r * 0.2}
            r={p.r * 0.55}
            fill={DARK}
            opacity={0.18}
          />
        ))}
        {pts.map((p, i) => (
          <circle
            key={`h${i}`}
            cx={p.x - p.r * 0.32}
            cy={p.y - p.r * 0.4}
            r={p.r * 0.3}
            fill="#ffffff"
            opacity={0.4}
          />
        ))}

        {/* head */}
        <g transform={`translate(${hx.toFixed(2)} ${hy.toFixed(2)}) rotate(${tilt.toFixed(2)})`}>
          <path
            d="M -18 -8 L -30 -14 L -22 -2 L -34 2 L -20 8 L -28 16 L -12 12 Z"
            fill={DARK}
            stroke={ink}
            strokeWidth={4}
            strokeLinejoin="round"
          />
          <path
            d="M -8 -14 Q -14 -30 -26 -36 Q -16 -24 -14 -10 Z"
            fill={HORN}
            stroke={ink}
            strokeWidth={4}
            strokeLinejoin="round"
          />
          <path
            d="M 4 -15 Q 2 -32 -8 -40 Q 4 -30 10 -14 Z"
            fill={HORN}
            stroke={ink}
            strokeWidth={4}
            strokeLinejoin="round"
          />
          <ellipse cx={0} cy={0} rx={21} ry={17} fill="url(#mk-gen-dragon-body)" stroke={ink} strokeWidth={5} />
          <ellipse cx={20} cy={5} rx={14} ry={10} fill={LIGHT} stroke={ink} strokeWidth={5} />
          <ellipse cx={-7} cy={-8} rx={7} ry={4} fill="#ffffff" opacity={0.45} />
          <circle cx={28} cy={2} r={2.2} fill={ink} />
          <path d="M 14 10 Q 21 15 28 10" stroke={ink} strokeWidth={3} fill="none" strokeLinecap="round" />
          <circle cx={2} cy={7} r={5} fill={BLUSH} opacity={0.55} />
          <ellipse cx={6} cy={-5} rx={7} ry={7 * blink} fill="#ffffff" stroke={ink} strokeWidth={3} />
          {blink > 0.5 ? (
            <g>
              <circle cx={8} cy={-5} r={4} fill={ink} />
              <circle cx={9.5} cy={-6.5} r={1.4} fill="#ffffff" />
            </g>
          ) : null}
          <path
            d={`M 30 0 Q 40 ${-8 + whisk} 46 ${-2 + whisk * 1.4}`}
            stroke={ink}
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
          />
          <path
            d={`M 28 8 Q 38 ${16 - whisk} 44 ${12 - whisk * 1.4}`}
            stroke={ink}
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
          />
        </g>
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 200,
  Component: RiverDragon,
};
