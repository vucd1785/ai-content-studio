import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

/** Núi băng trắng với sông băng xanh nhạt trượt xuống hồ nước lạnh, tuyết rơi nhẹ. */
const GlacierLake: FC<PropProps> = ({ frame, seed }) => {
  const flow = (frame * 0.6) % 24;
  const bob = wobble(frame, seed + 3, 60) * 2.5;
  const tilt = wobble(frame, seed + 5, 80) * 4;
  const ripple = 0.5 + 0.5 * wobble(frame, seed + 9, 45);
  const sparkleT = (frame % 50) / 50;
  const sparkle = easing.inOut(sparkleT < 0.5 ? sparkleT * 2 : 2 - sparkleT * 2);

  const flakes = [0, 1, 2, 3, 4].map((i) => {
    const period = 150 + i * 17;
    const p = ((frame + i * 37 + seed * 11) % period) / period;
    const y = -222 + p * 170;
    const x = -66 + i * 32 + wobble(frame, seed + 20 + i, 50 + i * 6) * 8;
    const op = p < 0.15 ? p / 0.15 : p > 0.85 ? (1 - p) / 0.15 : 1;
    const rot = frame * (1.2 + i * 0.3);
    return { x, y, op, rot, s: 4 + (i % 2) * 1.5 };
  });

  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-glacier-lake" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7cc4e8" />
          <stop offset="1" stopColor="#2f7fb5" />
        </linearGradient>
        <linearGradient id="mk-gen-glacier-ice" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e6f7ff" />
          <stop offset="1" stopColor="#8fd0ef" />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={86} />

      {/* back peak */}
      <path
        d="M 10 -40 L 52 -158 L 86 -40 Z"
        fill="#b9cde0"
        stroke={ink}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <path
        d="M 41 -127 L 52 -158 L 63 -128 L 57 -120 L 51 -128 L 46 -120 Z"
        fill="#f7fbff"
        stroke={ink}
        strokeWidth={3}
        strokeLinejoin="round"
      />

      {/* main mountain */}
      <path
        d="M -86 -30 L -14 -204 L 66 -30 Z"
        fill="#dbe7f2"
        stroke={ink}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* shade side */}
      <path d="M -14 -204 L 66 -30 L 6 -30 Z" fill="#9fb6cc" opacity={0.6} />
      {/* snow cap */}
      <path
        d="M -40 -140 L -14 -204 L 14 -142 L 4 -132 L -6 -144 L -16 -128 L -28 -142 Z"
        fill="#ffffff"
        stroke={ink}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      {/* highlight on lit side */}
      <path d="M -18 -194 L -34 -152 L -26 -156 Z" fill="#ffffff" opacity={0.8} />

      {/* glacier tongue */}
      <path
        d="M -12 -150 C -22 -110 -4 -90 -18 -60 C -26 -44 -36 -40 -40 -32 L 22 -32 C 14 -46 8 -64 10 -90 C 12 -116 2 -136 -2 -150 Z"
        fill="url(#mk-gen-glacier-ice)"
        stroke={ink}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      {/* flowing crevasse lines */}
      <path
        d="M -6 -144 C -14 -110 2 -88 -10 -60 C -16 -46 -22 -40 -24 -34"
        fill="none"
        stroke="#5aaed8"
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray="10 14"
        strokeDashoffset={-flow}
      />
      <path
        d="M 2 -130 C 4 -104 0 -80 4 -58 C 6 -46 8 -40 10 -34"
        fill="none"
        stroke="#ffffff"
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray="8 16"
        strokeDashoffset={-flow * 1.2}
        opacity={0.9}
      />

      {/* lake */}
      <ellipse
        cx={0}
        cy={-20}
        rx={84}
        ry={18}
        fill="url(#mk-gen-glacier-lake)"
        stroke={ink}
        strokeWidth={6}
      />
      <ellipse cx={-30} cy={-26} rx={30} ry={5} fill="#ffffff" opacity={0.25 + 0.2 * ripple} />
      <path
        d={`M 28 ${-16 + ripple} q 8 -4 16 0 q 8 4 16 0`}
        fill="none"
        stroke="#d8f1ff"
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.8}
      />
      <path
        d={`M -62 ${-14 - ripple} q 7 -3 14 0 q 7 3 14 0`}
        fill="none"
        stroke="#d8f1ff"
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.7}
      />

      {/* floating ice chunk */}
      <g transform={`translate(44 ${(-24 + bob).toFixed(2)}) rotate(${tilt.toFixed(2)})`}>
        <path
          d="M -12 2 L -8 -8 L 4 -11 L 12 -2 L 10 3 Z"
          fill="#f2fbff"
          stroke={ink}
          strokeWidth={3}
          strokeLinejoin="round"
        />
        <path d="M -6 -6 L 2 -9 L 0 -4 Z" fill="#9ad6f2" />
      </g>

      {/* sparkle on ice */}
      <g transform={`translate(-4 -100) scale(${(0.4 + 0.6 * sparkle).toFixed(3)})`} opacity={sparkle}>
        <path d="M 0 -8 L 2 -2 L 8 0 L 2 2 L 0 8 L -2 2 L -8 0 L -2 -2 Z" fill="#ffffff" stroke="#5aaed8" strokeWidth={1.5} />
      </g>

      {/* snowflakes */}
      {flakes.map((f, i) => (
        <g
          key={i}
          transform={`translate(${f.x.toFixed(2)} ${f.y.toFixed(2)}) rotate(${f.rot.toFixed(1)})`}
          opacity={f.op}
        >
          <line x1={-f.s} y1={0} x2={f.s} y2={0} stroke="#ffffff" strokeWidth={2.5} strokeLinecap="round" />
          <line x1={-f.s * 0.5} y1={-f.s * 0.87} x2={f.s * 0.5} y2={f.s * 0.87} stroke="#ffffff" strokeWidth={2.5} strokeLinecap="round" />
          <line x1={-f.s * 0.5} y1={f.s * 0.87} x2={f.s * 0.5} y2={-f.s * 0.87} stroke="#ffffff" strokeWidth={2.5} strokeLinecap="round" />
          <circle cx={0} cy={0} r={1.6} fill="#9ad6f2" />
        </g>
      ))}
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 228,
  Component: GlacierLake,
};
