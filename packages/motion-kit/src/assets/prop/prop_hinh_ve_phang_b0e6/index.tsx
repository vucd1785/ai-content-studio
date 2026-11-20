import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, lerp, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

const arcPath = (cx: number, cy: number, r: number): string => {
  const a1 = (-60 * Math.PI) / 180;
  const a2 = (50 * Math.PI) / 180;
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const x2 = cx + r * Math.cos(a2);
  const y2 = cy + r * Math.sin(a2);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
};

/** Phi hành gia cầm bộ đàm, sóng vô tuyến tỏa ra từ ăng-ten. */
const AstronautRadio: FC<PropProps> = ({ frame, seed }) => {
  const breathe = Math.sin((frame / 48) * Math.PI * 2);
  const bob = -1.5 * breathe;
  const tilt = 2 * wobble(frame, seed, 90);
  const glint = 6 * wobble(frame, seed + 3, 70);
  const led = 0.5 + 0.5 * Math.sin((frame / 10) * Math.PI);
  const ax = 50;
  const ay = -212;
  const waves = [0, 1, 2].map((i) => {
    const p = ((frame / 36 + i / 3) % 1 + 1) % 1;
    const r = lerp(8, 28, easing.out(p));
    const op = 1 - easing.inOut(p);
    return { r, op, key: i };
  });
  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-astro-suit" x1="0" y1="0" x2="1" y2="0.4">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.55" stopColor="#ECEFF4" />
          <stop offset="1" stopColor="#B9C2D0" />
        </linearGradient>
        <linearGradient id="mk-gen-astro-visor" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5FB4E8" />
          <stop offset="1" stopColor="#1B2F55" />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={60} />
      {/* boots */}
      <ellipse cx={-28} cy={-10} rx={19} ry={11} fill={PALETTE.metalDark} stroke={ink} strokeWidth={5} />
      <ellipse cx={10} cy={-10} rx={19} ry={11} fill={PALETTE.metalDark} stroke={ink} strokeWidth={5} />
      <g transform={`translate(0 ${bob.toFixed(2)})`}>
        {/* legs */}
        <rect x={-39} y={-72} width={23} height={62} rx={9} fill="url(#mk-gen-astro-suit)" stroke={ink} strokeWidth={5} />
        <rect x={-1} y={-72} width={23} height={62} rx={9} fill="url(#mk-gen-astro-suit)" stroke={ink} strokeWidth={5} />
        <rect x={-39} y={-36} width={23} height={7} fill={PALETTE.accent} opacity={0.85} />
        <rect x={-1} y={-36} width={23} height={7} fill={PALETTE.accent} opacity={0.85} />
        {/* backpack */}
        <rect x={-62} y={-168} width={30} height={84} rx={10} fill={PALETTE.metal} stroke={ink} strokeWidth={5} />
        <rect x={-58} y={-160} width={8} height={66} rx={4} fill="#FFFFFF" opacity={0.35} />
        {/* left arm hanging */}
        <path d="M -40 -140 Q -56 -118 -50 -92" fill="none" stroke={ink} strokeWidth={26} strokeLinecap="round" />
        <path d="M -40 -140 Q -56 -118 -50 -92" fill="none" stroke="#E6EAF0" strokeWidth={16} strokeLinecap="round" />
        <circle cx={-50} cy={-88} r={10} fill={PALETTE.metalDark} stroke={ink} strokeWidth={4} />
        {/* torso */}
        <rect x={-48} y={-158} width={76} height={94} rx={26} fill="url(#mk-gen-astro-suit)" stroke={ink} strokeWidth={6} />
        <path d="M 18 -150 Q 26 -112 18 -72" fill="none" stroke="#8E99AB" strokeWidth={6} opacity={0.35} strokeLinecap="round" />
        <ellipse cx={-32} cy={-132} rx={6} ry={16} fill="#FFFFFF" opacity={0.7} />
        {/* chest panel */}
        <rect x={-24} y={-132} width={36} height={24} rx={6} fill={PALETTE.metalDark} stroke={ink} strokeWidth={4} />
        <circle cx={-14} cy={-120} r={4} fill={PALETTE.ok} />
        <circle cx={-3} cy={-120} r={4} fill={PALETTE.warn} />
        <circle cx={8} cy={-120} r={4} fill={PALETTE.alert} opacity={0.4 + 0.6 * led} />
        <rect x={-46} y={-82} width={72} height={8} rx={4} fill={PALETTE.metal} stroke={ink} strokeWidth={3} />
        {/* helmet */}
        <g transform={`rotate(${tilt.toFixed(2)} -10 -160)`}>
          <rect x={-36} y={-162} width={52} height={14} rx={7} fill={PALETTE.metal} stroke={ink} strokeWidth={5} />
          <circle cx={-10} cy={-195} r={40} fill="url(#mk-gen-astro-suit)" stroke={ink} strokeWidth={6} />
          <ellipse cx={-6} cy={-193} rx={29} ry={23} fill="url(#mk-gen-astro-visor)" stroke={ink} strokeWidth={5} />
          <ellipse cx={-16 + glint} cy={-202} rx={9} ry={5} fill="#FFFFFF" opacity={0.75} transform={`rotate(-25 ${(-16 + glint).toFixed(2)} -202)`} />
          <circle cx={6 + glint * 0.5} cy={-184} r={3} fill="#FFFFFF" opacity={0.6} />
          <path d="M -40 -205 Q -36 -228 -14 -233" fill="none" stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" opacity={0.8} />
        </g>
        {/* right arm raised holding radio */}
        <path d="M 18 -140 Q 54 -124 48 -160" fill="none" stroke={ink} strokeWidth={26} strokeLinecap="round" />
        <path d="M 18 -140 Q 54 -124 48 -160" fill="none" stroke="#E6EAF0" strokeWidth={16} strokeLinecap="round" />
        {/* radio */}
        <line x1={ax} y1={-188} x2={ax} y2={ay} stroke={ink} strokeWidth={5} strokeLinecap="round" />
        <circle cx={ax} cy={ay} r={4.5} fill={PALETTE.alert} stroke={ink} strokeWidth={3} />
        <rect x={36} y={-190} width={22} height={38} rx={6} fill="#3B4252" stroke={ink} strokeWidth={5} />
        <rect x={40} y={-185} width={14} height={11} rx={3} fill={PALETTE.screen} />
        <circle cx={47} cy={-164} r={3} fill={PALETTE.ok} opacity={0.3 + 0.7 * led} />
        <rect x={38} y={-188} width={4} height={30} rx={2} fill="#FFFFFF" opacity={0.25} />
        <circle cx={46} cy={-158} r={10} fill={PALETTE.metalDark} stroke={ink} strokeWidth={4} />
        {/* radio waves */}
        {waves.map((w) => (
          <path
            key={w.key}
            d={arcPath(ax, ay, w.r)}
            fill="none"
            stroke={PALETTE.accent}
            strokeWidth={5}
            strokeLinecap="round"
            opacity={w.op}
          />
        ))}
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 80,
  height: 250,
  Component: AstronautRadio,
};
