import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { rnd, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";

const ink = PALETTE.ink;

/** Tầng trên tên lửa lao xuống khí quyển: mũi đỏ rực, quầng lửa cam, vệt sáng phía sau, rung nhẹ. */
const UpperStageReentry: FC<PropProps> = ({ frame, seed }) => {
  const jx = Math.sin(frame * 2.3) * 1.3;
  const jy = Math.cos(frame * 1.9) * 1.1;
  const rot = 22 + 1.5 * wobble(frame, seed, 60);
  const pulse = 0.5 + 0.5 * wobble(frame, seed + 3, 14);
  const flick = wobble(frame, seed + 9, 9);
  const trailLen = 62 + 8 * flick;
  const sparks = [0, 1, 2, 3, 4].map((i) => {
    const phase = (frame * 0.045 + i / 5) % 1;
    return {
      x: (rnd(seed, i) - 0.5) * 30,
      y: -246 - phase * 50,
      r: 2.5 + 2.5 * (1 - phase),
      o: 1 - phase,
    };
  });
  return (
    <g transform={`translate(${jx.toFixed(2)} ${jy.toFixed(2)}) rotate(${rot.toFixed(2)} 0 -160)`}>
      <defs>
        <linearGradient id="mk-gen-ttr-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#F4F6FA" />
          <stop offset="0.55" stopColor="#CDD3DD" />
          <stop offset="1" stopColor="#8E97A6" />
        </linearGradient>
        <linearGradient id="mk-gen-ttr-trail" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#FFE07A" stopOpacity="0.95" />
          <stop offset="0.5" stopColor="#FF8A2B" stopOpacity="0.6" />
          <stop offset="1" stopColor="#FF5A1F" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="mk-gen-ttr-heat" cx="0.5" cy="0.75" r="0.6">
          <stop offset="0" stopColor="#FFF2A8" />
          <stop offset="0.5" stopColor="#FFB23A" />
          <stop offset="1" stopColor="#FF5A1F" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* vệt sáng phía sau */}
      <path
        d={`M -18 -244 L 18 -244 L 6 ${(-244 - trailLen).toFixed(1)} L -6 ${(-244 - trailLen).toFixed(1)} Z`}
        fill="url(#mk-gen-ttr-trail)"
      />
      <path
        d={`M -8 -244 L 8 -244 L 0 ${(-250 - trailLen * 0.8).toFixed(1)} Z`}
        fill="#FFF6C8"
        opacity={0.7 + 0.3 * pulse}
      />
      {sparks.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#FFD25A" opacity={s.o} />
      ))}

      {/* luồng khí nóng dọc thân */}
      <path d="M -34 -110 Q -40 -170 -30 -225" fill="none" stroke="#FF8A2B" strokeWidth={5} strokeLinecap="round" opacity={0.35 + 0.3 * pulse} />
      <path d="M 34 -110 Q 40 -170 30 -225" fill="none" stroke="#FF8A2B" strokeWidth={5} strokeLinecap="round" opacity={0.35 + 0.3 * pulse} />

      {/* vây đuôi */}
      <path d="M -22 -196 L -40 -238 L -22 -230 Z" fill={PALETTE.accent} stroke={ink} strokeWidth={5} strokeLinejoin="round" />
      <path d="M 22 -196 L 40 -238 L 22 -230 Z" fill={PALETTE.accent} stroke={ink} strokeWidth={5} strokeLinejoin="round" />

      {/* vòi phun */}
      <path d="M -13 -230 L -18 -246 L 18 -246 L 13 -230 Z" fill={PALETTE.metalDark} stroke={ink} strokeWidth={5} strokeLinejoin="round" />

      {/* thân */}
      <rect x={-22} y={-232} width={44} height={114} rx={6} fill="url(#mk-gen-ttr-body)" stroke={ink} strokeWidth={6} />
      <rect x={-22} y={-178} width={44} height={11} fill={PALETTE.accent} stroke={ink} strokeWidth={3} />
      <rect x={-15} y={-226} width={6} height={44} rx={3} fill="#FFFFFF" opacity={0.7} />
      <rect x={10} y={-226} width={7} height={100} rx={3} fill={ink} opacity={0.12} />
      <circle cx={0} cy={-202} r={9} fill={PALETTE.screen} stroke={ink} strokeWidth={4} />
      <circle cx={-3} cy={-205} r={3} fill="#FFFFFF" />
      <circle cx={-14} cy={-150} r={2.5} fill={ink} />
      <circle cx={14} cy={-150} r={2.5} fill={ink} />
      <circle cx={-14} cy={-132} r={2.5} fill={ink} />
      <circle cx={14} cy={-132} r={2.5} fill={ink} />

      {/* quầng lửa quanh mũi */}
      <path
        d="M -38 -132 Q -42 -56 0 -40 Q 42 -56 38 -132 Q 0 -112 -38 -132 Z"
        fill="url(#mk-gen-ttr-heat)"
        opacity={0.65 + 0.35 * pulse}
        transform={`translate(0 ${(-3 * flick).toFixed(2)})`}
      />

      {/* mũi đỏ rực */}
      <path d="M -22 -120 Q -20 -78 0 -62 Q 20 -78 22 -120 Z" fill="#E2412B" stroke={ink} strokeWidth={6} strokeLinejoin="round" />
      <path d="M -14 -116 Q -12 -88 -2 -74" fill="none" stroke="#FFB36B" strokeWidth={4} strokeLinecap="round" opacity={0.85} />
      <path d="M 8 -116 Q 10 -92 3 -76 Q 16 -88 16 -116 Z" fill="#8E1E14" opacity={0.4} />
      <circle cx={0} cy={-70} r={5 + 2 * pulse} fill="#FFF2A8" opacity={0.8} />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 85,
  height: 310,
  Component: UpperStageReentry,
};
