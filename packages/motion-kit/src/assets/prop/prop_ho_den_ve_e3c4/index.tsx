import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, lerp, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";

const ink = PALETTE.ink;
const CY = -95;

const ARM =
  "M 0 -66 C 38 -64 62 -34 56 -2 C 50 24 28 36 6 34";
const ARM_HI =
  "M 4 -58 C 34 -54 52 -30 48 -4";

/** Hố đen phẳng: lõi đen, đĩa xoáy tím, viền cam vàng phát sáng, vệt sáng cuộn vào tâm. */
const BlackHole: FC<PropProps> = ({ frame, seed }) => {
  const rot = (frame * 0.7) % 360;
  const pulse = 0.5 + 0.5 * wobble(frame, seed, 48);
  const breathe = 1 + 0.025 * wobble(frame, seed + 3, 64);
  const streaks = [0, 1, 2, 3, 4, 5].map((i) => {
    const p = (frame / 70 + i / 6) % 1;
    const e = easing.in(p);
    const r = lerp(68, 30, e);
    const a = ((i * 60 + e * 280 + rot) * Math.PI) / 180;
    const x = r * Math.cos(a);
    const y = r * Math.sin(a);
    const op = p < 0.15 ? p / 0.15 : 1 - easing.in(p);
    const len = lerp(4, 9, e);
    return { x, y, op, len, ang: (a * 180) / Math.PI + 90 };
  });
  const sparkles = [0, 1, 2, 3].map((i) => {
    const a = i * 1.7 + 0.4;
    const tw = 0.5 + 0.5 * wobble(frame, seed + 11 + i, 26 + i * 6);
    return { x: 80 * Math.cos(a), y: 80 * Math.sin(a), s: 2 + 3 * tw, op: 0.4 + 0.6 * tw };
  });
  return (
    <g>
      <defs>
        <radialGradient id="mk-gen-hd-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.55" stopColor="#ffb347" stopOpacity={0.9} />
          <stop offset="0.8" stopColor="#ff7a2f" stopOpacity={0.45} />
          <stop offset="1" stopColor="#ff7a2f" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="mk-gen-hd-disk" cx="0.4" cy="0.38" r="0.62">
          <stop offset="0" stopColor="#6b3fa0" />
          <stop offset="0.6" stopColor="#3d1f63" />
          <stop offset="1" stopColor="#1e0d36" />
        </radialGradient>
      </defs>
      <g transform={`translate(0 ${CY}) scale(${breathe.toFixed(4)})`}>
        <circle r={88} fill="url(#mk-gen-hd-glow)" opacity={0.55 + 0.35 * pulse} />
        <circle r={72} fill="#ff9a3c" stroke={ink} strokeWidth={6} />
        <circle r={66} fill="url(#mk-gen-hd-disk)" />
        <g transform={`rotate(${rot.toFixed(2)})`}>
          {[0, 120, 240].map((d) => (
            <g key={d} transform={`rotate(${d})`}>
              <path d={ARM} fill="none" stroke="#8a5cc4" strokeWidth={12} strokeLinecap="round" opacity={0.75} />
              <path d={ARM_HI} fill="none" stroke="#ffd36b" strokeWidth={3.5} strokeLinecap="round" opacity={0.55 + 0.35 * pulse} />
            </g>
          ))}
        </g>
        <path
          d="M -52 -38 A 64 64 0 0 1 -10 -62"
          fill="none"
          stroke="#fff3c4"
          strokeWidth={5}
          strokeLinecap="round"
          opacity={0.7}
        />
        <path
          d="M 50 40 A 64 64 0 0 1 10 62"
          fill="none"
          stroke="#120822"
          strokeWidth={6}
          strokeLinecap="round"
          opacity={0.45}
        />
        {streaks.map((s, i) => (
          <g key={i} transform={`translate(${s.x.toFixed(2)} ${s.y.toFixed(2)}) rotate(${s.ang.toFixed(2)})`}>
            <ellipse rx={2.6} ry={s.len} fill="#ffe08a" opacity={Math.max(0, s.op)} />
          </g>
        ))}
        <circle r={36} fill="#ffcc4d" opacity={0.35 + 0.4 * pulse} />
        <circle r={31} fill="#0b0414" stroke="#ffb030" strokeWidth={4} />
        <circle r={31} fill="none" stroke={ink} strokeWidth={2} opacity={0.6} />
        <circle cx={-8} cy={-9} r={12} fill="#2a1446" opacity={0.6} />
        {sparkles.map((s, i) => (
          <path
            key={i}
            d={`M ${s.x} ${s.y - s.s * 1.6} L ${s.x + s.s * 0.5} ${s.y} L ${s.x} ${s.y + s.s * 1.6} L ${s.x - s.s * 0.5} ${s.y} Z`}
            fill="#fff6d6"
            opacity={s.op}
          />
        ))}
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 186,
  Component: BlackHole,
};
