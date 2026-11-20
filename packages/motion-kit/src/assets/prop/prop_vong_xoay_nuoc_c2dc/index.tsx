import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble, easing } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const CY = -50;
const RX = 80;
const RY = 40;

const spiralPath = (a0: number): string => {
  const n = 48;
  let d = "";
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const r = 74 * (1 - k) + 5;
    const a = a0 + k * Math.PI * 2.4;
    const x = r * Math.cos(a);
    const y = r * Math.sin(a);
    d += `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return d;
};

const ARMS = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map(spiralPath);

/** Vòng xoáy nước xanh cuộn vào tâm, phao nhỏ nổi yên ở mép ngoài. */
const VongXoayNuoc: FC<PropProps> = ({ frame, seed }) => {
  const gid = `mk-gen-vortex-${seed}`;
  const rot = (frame * 2.4) % 360;
  const eyePulse = 0.5 + 0.5 * Math.sin((frame / 40) * Math.PI * 2);
  const eyeR = 12 + 3 * easing.inOut(eyePulse);

  const bob = 2.5 * wobble(frame, seed + 3, 50);
  const tilt = 6 * wobble(frame, seed + 9, 64);
  const ripplePhase = (frame % 45) / 45;
  const rippleR = 16 + 10 * easing.out(ripplePhase);

  const foam = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const r = 70 - i * 9;
    const speed = 0.02 + (80 - r) * 0.0012;
    const a = i * 1.9 + frame * speed;
    return {
      x: r * Math.cos(a),
      y: CY + r * Math.sin(a) * 0.5,
      s: 3 + (r / 70) * 3,
      o: 0.35 + 0.55 * (r / 70),
    };
  });

  const sparkles = [
    { x: -52, y: -72, p: 0 },
    { x: -20, y: -84, p: 15 },
    { x: 30, y: -80, p: 30 },
  ];

  return (
    <g>
      <ContactShadow halfWidth={84} />
      <defs>
        <radialGradient id={gid} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0B2F5C" />
          <stop offset="35%" stopColor="#1F6FB8" />
          <stop offset="75%" stopColor="#3FA4E0" />
          <stop offset="100%" stopColor="#7FD3F2" />
        </radialGradient>
      </defs>

      {/* water body */}
      <ellipse cx={0} cy={CY} rx={RX} ry={RY} fill={`url(#${gid})`} stroke={ink} strokeWidth={6} />

      {/* rotating spiral arms */}
      <g transform={`translate(0 ${CY}) scale(1 0.5)`}>
        <g transform={`rotate(${rot.toFixed(2)})`}>
          {ARMS.map((d, i) => (
            <path
              key={`a${i}`}
              d={d}
              fill="none"
              stroke="#BFEFFF"
              strokeWidth={7}
              strokeLinecap="round"
              opacity={0.7}
            />
          ))}
          {ARMS.map((d, i) => (
            <path
              key={`b${i}`}
              d={d}
              fill="none"
              stroke="#155A9C"
              strokeWidth={4}
              strokeLinecap="round"
              opacity={0.55}
              transform="rotate(25)"
            />
          ))}
        </g>
      </g>

      {/* shade on bottom-right lip, highlight on top-left */}
      <path
        d={`M ${RX - 6} ${CY + 4} A ${RX - 6} ${RY - 4} 0 0 1 ${-RX + 20} ${CY + 24}`}
        fill="none"
        stroke="#0E3E72"
        strokeWidth={6}
        strokeLinecap="round"
        opacity={0.35}
      />
      <path
        d={`M ${-RX + 12} ${CY - 6} A ${RX - 12} ${RY - 8} 0 0 1 ${-10} ${CY - RY + 7}`}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={5}
        strokeLinecap="round"
        opacity={0.6}
      />

      {/* foam bits swirling inward */}
      {foam.map((f, i) => (
        <ellipse key={`f${i}`} cx={f.x} cy={f.y} rx={f.s * 1.4} ry={f.s * 0.7} fill="#FFFFFF" opacity={f.o} />
      ))}

      {/* dark eye */}
      <ellipse cx={0} cy={CY} rx={eyeR + 6} ry={(eyeR + 6) * 0.5} fill="#0B2F5C" opacity={0.45} />
      <ellipse cx={0} cy={CY} rx={eyeR} ry={eyeR * 0.5} fill="#061A36" stroke={ink} strokeWidth={3} />

      {/* sparkles */}
      {sparkles.map((s, i) => {
        const tw = Math.max(0, Math.sin(((frame + s.p) / 45) * Math.PI * 2));
        const k = 2 + 4 * tw;
        return (
          <path
            key={`s${i}`}
            d={`M ${s.x} ${s.y - k} L ${s.x + k * 0.4} ${s.y} L ${s.x} ${s.y + k} L ${s.x - k * 0.4} ${s.y} Z`}
            fill="#FFFFFF"
            opacity={0.3 + 0.7 * tw}
          />
        );
      })}

      {/* buoy at the far outer edge */}
      <g transform={`translate(60 ${(-30 + bob).toFixed(2)})`}>
        <ellipse cx={0} cy={4} rx={rippleR} ry={rippleR * 0.4} fill="none" stroke="#FFFFFF" strokeWidth={2.5} opacity={0.8 * (1 - ripplePhase)} />
        <g transform={`rotate(${tilt.toFixed(2)})`}>
          <ellipse cx={0} cy={0} rx={15} ry={9} fill={PALETTE.alert} stroke={ink} strokeWidth={4} />
          <path d="M -9 -7 L -4 -8.5 L -6 0 L -14 -1 Z" fill="#FFFFFF" />
          <path d="M 9 -7 L 4 -8.5 L 6 0 L 14 -1 Z" fill="#FFFFFF" />
          <path d="M -4 8.5 L 4 8.5 L 3 3 L -3 3 Z" fill="#FFFFFF" />
          <ellipse cx={0} cy={-1} rx={6} ry={3.2} fill="#1F6FB8" stroke={ink} strokeWidth={3} />
          <ellipse cx={6} cy={3} rx={7} ry={3} fill="#7A1F1F" opacity={0.3} />
          <ellipse cx={-7} cy={-4} rx={4} ry={1.6} fill="#FFFFFF" opacity={0.75} />
        </g>
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 86,
  height: 100,
  Component: VongXoayNuoc,
};
