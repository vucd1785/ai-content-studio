import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

/** Cây nghiêng rạp trong gió mạnh với vệt gió trắng, cạnh con sóng biển xanh cuộn cao. */
const WindTreeWave: FC<PropProps> = ({ frame, seed }) => {
  const phase = (frame % 60) / 60;
  const tri = phase < 0.5 ? phase * 2 : 2 - phase * 2;
  const gust = easing.inOut(tri);
  const flutter = wobble(frame, seed + 3, 14);
  const treeRot = 8 + 7 * gust + 1.2 * flutter;
  const waveScale = 1 + 0.04 * easing.inOut(1 - tri);
  const foamBob = 2 * wobble(frame, seed + 11, 24);
  const gid = `mk-gen-wave-${seed}`;
  const lid = `mk-gen-leaf-${seed}`;

  const streaks = [0, 1, 2].map((i) => {
    const p = ((frame * 2.2 + i * 33) % 100) / 100;
    const x = -88 + p * 86;
    const y = -190 + i * 52;
    const op = Math.sin(Math.PI * p);
    return { x, y, op, i };
  });

  return (
    <g>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6fd3f5" />
          <stop offset="0.55" stopColor="#2f93d6" />
          <stop offset="1" stopColor="#1c5fa3" />
        </linearGradient>
        <radialGradient id={lid} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#9be07a" />
          <stop offset="1" stopColor={PALETTE.leaf} />
        </radialGradient>
      </defs>
      <ContactShadow halfWidth={86} />

      {/* Sóng biển */}
      <g transform={`scale(1 ${waveScale.toFixed(3)})`}>
        <path
          d="M -2 0 C 10 -50, 4 -118, 28 -160 C 44 -190, 80 -196, 86 -160 L 86 0 Z"
          fill={`url(#${gid})`}
          stroke={ink}
          strokeWidth={6}
          strokeLinejoin="round"
        />
        <path
          d="M 30 -150 C 40 -176, 70 -180, 74 -158 C 76 -142, 58 -136, 52 -148"
          fill="none"
          stroke="#bff0ff"
          strokeWidth={6}
          strokeLinecap="round"
          opacity={0.85}
        />
        <path d="M 60 -120 C 74 -110, 80 -70, 80 -10 L 86 -10 L 86 -130 Z" fill="#164f8a" opacity={0.35} />
        <path d="M 14 -40 C 18 -80, 20 -110, 30 -140" fill="none" stroke="#ffffff" strokeWidth={5} strokeLinecap="round" opacity={0.45} />
        <g transform={`translate(0 ${foamBob.toFixed(2)})`}>
          <path
            d="M 24 -160 C 30 -174, 40 -182, 48 -178 C 52 -190, 66 -192, 70 -182 C 78 -188, 88 -180, 84 -168 C 70 -176, 50 -174, 34 -158 Z"
            fill={PALETTE.paper}
            stroke={ink}
            strokeWidth={4}
            strokeLinejoin="round"
          />
          <circle cx={20} cy={-170} r={4} fill={PALETTE.paper} stroke={ink} strokeWidth={2.5} />
          <circle cx={12} cy={-160} r={2.6} fill={PALETTE.paper} stroke={ink} strokeWidth={2} />
        </g>
        <path
          d="M 4 -22 C 20 -34, 34 -12, 50 -24 C 64 -34, 76 -16, 86 -24"
          fill="none"
          stroke={PALETTE.paper}
          strokeWidth={5}
          strokeLinecap="round"
          opacity={0.8}
        />
      </g>

      {/* Cây nghiêng */}
      <g transform={`rotate(${treeRot.toFixed(2)} -55 0)`}>
        <path
          d="M -64 0 C -62 -50, -58 -90, -46 -128 L -34 -126 C -42 -90, -44 -46, -44 0 Z"
          fill={PALETTE.wood}
          stroke={ink}
          strokeWidth={6}
          strokeLinejoin="round"
        />
        <path d="M -50 -8 C -50 -50, -46 -90, -38 -120" fill="none" stroke={PALETTE.woodDark} strokeWidth={4} opacity={0.6} />
        <path d="M -52 -80 C -40 -96, -30 -100, -20 -104" fill="none" stroke={ink} strokeWidth={6} strokeLinecap="round" />
        <path d="M -52 -80 C -40 -96, -30 -100, -20 -104" fill="none" stroke={PALETTE.wood} strokeWidth={2.5} strokeLinecap="round" />
        <g transform={`rotate(${(3 * flutter).toFixed(2)} -40 -130)`}>
          <ellipse cx={-62} cy={-150} rx={22} ry={18} fill={`url(#${lid})`} stroke={ink} strokeWidth={5} />
          <ellipse cx={-14} cy={-140} rx={24} ry={18} fill={`url(#${lid})`} stroke={ink} strokeWidth={5} />
          <ellipse cx={-38} cy={-168} rx={32} ry={24} fill={`url(#${lid})`} stroke={ink} strokeWidth={6} />
          <ellipse cx={-48} cy={-176} rx={12} ry={7} fill="#ffffff" opacity={0.35} />
          <ellipse cx={-22} cy={-150} rx={16} ry={8} fill="#2f7a2c" opacity={0.3} />
          <ellipse cx={-6} cy={-120} rx={8} ry={5} fill={PALETTE.leaf} stroke={ink} strokeWidth={3} />
        </g>
      </g>

      {/* Vệt gió và lá bay */}
      {streaks.map((s) => (
        <g key={s.i} opacity={s.op}>
          <path
            d={`M ${s.x.toFixed(2)} ${s.y} q 18 -6 36 0 q 8 3 4 8`}
            fill="none"
            stroke={ink}
            strokeWidth={7}
            strokeLinecap="round"
          />
          <path
            d={`M ${s.x.toFixed(2)} ${s.y} q 18 -6 36 0 q 8 3 4 8`}
            fill="none"
            stroke={PALETTE.paper}
            strokeWidth={3.5}
            strokeLinecap="round"
          />
          <ellipse
            cx={s.x + 10}
            cy={s.y + 14}
            rx={5}
            ry={3}
            fill={PALETTE.leaf}
            stroke={ink}
            strokeWidth={2}
            transform={`rotate(${(frame * 9 + s.i * 60) % 360} ${(s.x + 10).toFixed(2)} ${s.y + 14})`}
          />
        </g>
      ))}
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 210,
  Component: WindTreeWave,
};
