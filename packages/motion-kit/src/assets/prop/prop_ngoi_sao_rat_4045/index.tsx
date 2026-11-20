import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, lerp, clamp, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";

const ink = PALETTE.ink;
const CY = -100;
const PERIOD = 180;

/** Ngôi sao đỏ cam khổng lồ phồng lên rồi co rút thành chấm tối có viền sáng (hố đen), lặp lại. */
const NgoiSaoCoRut: FC<PropProps> = ({ frame, seed }) => {
  const c = (((frame % PERIOD) + PERIOD) % PERIOD) / PERIOD;
  let R = 58;
  let m = 0;
  if (c < 0.35) {
    R = lerp(58, 76, easing.inOut(c / 0.35));
  } else if (c < 0.6) {
    const k = (c - 0.35) / 0.25;
    R = lerp(76, 16, easing.in(k));
    m = clamp((k - 0.55) / 0.45, 0, 1);
  } else if (c < 0.9) {
    R = 16;
    m = 1;
  } else {
    const k = (c - 0.9) / 0.1;
    R = lerp(16, 58, easing.outBack(1.4)(k));
    m = 1 - easing.inOut(k);
  }
  const pulse = 1 + 0.025 * wobble(frame, seed, 24);
  const r = Math.max(R * pulse, 6);
  const starOp = 1 - m;
  const spin = frame * 0.6;
  const glow = 0.5 + 0.5 * wobble(frame, seed + 3, 30);
  const gid = `mk-gen-star-${seed}`;
  const hid = `mk-gen-hole-${seed}`;

  const rays = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
    const a = (i / 8) * Math.PI * 2;
    const len = r * (0.22 + 0.06 * Math.sin(frame * 0.12 + i * 1.7));
    const r0 = r + 4;
    const r1 = r0 + len;
    const w = 0.14;
    const p1 = `${(Math.cos(a - w) * r0).toFixed(2)},${(Math.sin(a - w) * r0).toFixed(2)}`;
    const p2 = `${(Math.cos(a) * r1).toFixed(2)},${(Math.sin(a) * r1).toFixed(2)}`;
    const p3 = `${(Math.cos(a + w) * r0).toFixed(2)},${(Math.sin(a + w) * r0).toFixed(2)}`;
    return (
      <polygon
        key={i}
        points={`${p1} ${p2} ${p3}`}
        fill="#FFB547"
        stroke={ink}
        strokeWidth={4}
        strokeLinejoin="round"
      />
    );
  });

  const sparkles = [0, 1, 2].map((i) => {
    const a = frame * 0.05 + i * 2.1;
    const d = 30 + 4 * Math.sin(frame * 0.1 + i);
    const tw = 0.5 + 0.5 * Math.sin(frame * 0.2 + i * 2);
    return (
      <circle
        key={i}
        cx={(Math.cos(a) * d).toFixed(2)}
        cy={(Math.sin(a) * d * 0.35).toFixed(2)}
        r={2 + 2 * tw}
        fill="#FFF3C4"
        opacity={0.5 + 0.5 * tw}
      />
    );
  });

  return (
    <g>
      <defs>
        <radialGradient id={gid} cx="0.38" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#FFE08A" />
          <stop offset="0.45" stopColor="#FF8A3D" />
          <stop offset="1" stopColor="#D2382A" />
        </radialGradient>
        <radialGradient id={hid} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFD27A" stopOpacity={0.9} />
          <stop offset="1" stopColor="#FF8A3D" stopOpacity={0} />
        </radialGradient>
      </defs>
      <g transform={`translate(0 ${CY})`}>
        <g opacity={starOp}>
          <circle cx={0} cy={0} r={r * 1.12} fill="#FF8A3D" opacity={0.18 + 0.12 * glow} />
          <g transform={`rotate(${spin.toFixed(2)})`}>{rays}</g>
          <circle cx={0} cy={0} r={r} fill={`url(#${gid})`} stroke={ink} strokeWidth={6} />
          <path
            d={`M ${(r * 0.55).toFixed(2)} ${(-r * 0.7).toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 1 ${(-r * 0.7).toFixed(2)} ${(r * 0.6).toFixed(2)} A ${(r * 0.85).toFixed(2)} ${(r * 0.85).toFixed(2)} 0 0 0 ${(r * 0.55).toFixed(2)} ${(-r * 0.7).toFixed(2)} Z`}
            fill="#8E1F1A"
            opacity={0.28}
          />
          <ellipse
            cx={-r * 0.38}
            cy={-r * 0.42}
            rx={r * 0.26}
            ry={r * 0.15}
            transform={`rotate(-35 ${(-r * 0.38).toFixed(2)} ${(-r * 0.42).toFixed(2)})`}
            fill="#FFF6D6"
            opacity={0.75}
          />
          <circle cx={-r * 0.58} cy={-r * 0.12} r={r * 0.06} fill="#FFF6D6" opacity={0.8} />
          <circle cx={r * 0.3} cy={r * 0.25} r={r * 0.12} fill="#B8322A" opacity={0.55} />
          <circle cx={r * 0.05} cy={r * 0.5} r={r * 0.07} fill="#B8322A" opacity={0.5} />
          <circle cx={r * 0.48} cy={-r * 0.15} r={r * 0.05} fill="#B8322A" opacity={0.5} />
        </g>
        <g opacity={m}>
          <circle cx={0} cy={0} r={46 + 6 * glow} fill={`url(#${hid})`} />
          <ellipse
            cx={0}
            cy={0}
            rx={40}
            ry={11}
            transform="rotate(-15)"
            fill="none"
            stroke={ink}
            strokeWidth={9}
          />
          <ellipse
            cx={0}
            cy={0}
            rx={40}
            ry={11}
            transform="rotate(-15)"
            fill="none"
            stroke="#FFB547"
            strokeWidth={4}
          />
          <circle cx={0} cy={0} r={r + 5} fill="#FFE9A8" stroke={ink} strokeWidth={5} opacity={0.7 + 0.3 * glow} />
          <circle cx={0} cy={0} r={r} fill="#14101F" />
          <circle cx={-r * 0.35} cy={-r * 0.35} r={r * 0.18} fill="#4A3A6A" opacity={0.6} />
          <path
            d="M -36 6 A 40 11 0 0 0 36 -16"
            transform="rotate(-15)"
            fill="none"
            stroke="#FFF3C4"
            strokeWidth={3}
            strokeLinecap="round"
            opacity={0.6 + 0.4 * glow}
          />
          {sparkles}
        </g>
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 200,
  Component: NgoiSaoCoRut,
};
