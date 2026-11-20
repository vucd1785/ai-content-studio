import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";

const ink = PALETTE.ink;
const BLUE_LIGHT = "#CDEEFF";
const BLUE = "#86CDF3";
const BLUE_DARK = "#3F8FC8";
const WHITE = "#FFFFFF";
const CY = -92;
const PERIOD = 66;
const RINGS = 4;

const easeOut = (p: number): number => 1 - (1 - p) ** 2.4;

const arcPath = (r: number, a0: number, a1: number): string => {
  const d0 = (a0 * Math.PI) / 180;
  const d1 = (a1 * Math.PI) / 180;
  const x0 = r * Math.cos(d0);
  const y0 = CY + r * Math.sin(d0);
  const x1 = r * Math.cos(d1);
  const y1 = CY + r * Math.sin(d1);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};

const sparklePath = (s: number): string =>
  `M 0 ${-s} Q ${s * 0.2} ${-s * 0.2} ${s} 0 Q ${s * 0.2} ${s * 0.2} 0 ${s} Q ${-s * 0.2} ${s * 0.2} ${-s} 0 Q ${-s * 0.2} ${-s * 0.2} 0 ${-s} Z`;

/** Vòng sóng âm của tiếng sấm: các vòng tròn đồng tâm lan rộng dần từ tâm rồi mờ đi. */
const SoundRings: FC<PropProps> = ({ frame, seed }) => {
  const base = frame / PERIOD + (seed % 7) * 0.013;
  const rings = [];
  for (let i = 0; i < RINGS; i++) {
    const raw = base + i / RINGS;
    const p = raw - Math.floor(raw);
    const r = 24 + 56 * easeOut(p);
    const fadeIn = Math.min(1, p / 0.12);
    const op = fadeIn * (1 - p) ** 1.1;
    const band = 13 - 5 * p;
    rings.push({ r, op, band, key: i });
  }
  rings.sort((a, b) => b.r - a.r);

  const beat = Math.sin(frame * ((2 * Math.PI) / PERIOD) * RINGS);
  const sx = 1 + 0.07 * beat;
  const sy = 1 - 0.07 * beat;
  const glow = 0.5 + 0.5 * wobble(frame, seed, 24);
  const tw1 = 0.5 + 0.5 * Math.sin(frame * 0.21 + seed);
  const tw2 = 0.5 + 0.5 * Math.sin(frame * 0.17 + seed + 2.1);
  const tw3 = 0.5 + 0.5 * Math.sin(frame * 0.25 + seed + 4.2);
  const spin = (frame * 2) % 360;

  return (
    <g>
      <defs>
        <radialGradient id="mk-gen-sound-core" cx="0.38" cy="0.35" r="0.7">
          <stop offset="0%" stopColor={WHITE} />
          <stop offset="45%" stopColor={BLUE_LIGHT} />
          <stop offset="100%" stopColor={BLUE} />
        </radialGradient>
      </defs>

      {/* hào quang mờ */}
      <circle cx={0} cy={CY} r={46} fill={BLUE_LIGHT} opacity={0.18 + 0.12 * glow} />

      {/* các vòng sóng */}
      {rings.map((rg) => (
        <g key={rg.key} opacity={rg.op.toFixed(3)}>
          <circle cx={0} cy={CY} r={rg.r} fill="none" stroke={ink} strokeWidth={rg.band} />
          <circle cx={0} cy={CY} r={rg.r} fill="none" stroke={BLUE} strokeWidth={rg.band - 6} />
          <path
            d={arcPath(rg.r + (rg.band - 6) * 0.18, 20, 110)}
            fill="none"
            stroke={BLUE_DARK}
            strokeWidth={Math.max(1.5, (rg.band - 6) * 0.45)}
            strokeLinecap="round"
            opacity={0.6}
          />
          <path
            d={arcPath(rg.r - (rg.band - 6) * 0.15, 195, 255)}
            fill="none"
            stroke={WHITE}
            strokeWidth={Math.max(1.5, (rg.band - 6) * 0.45)}
            strokeLinecap="round"
            opacity={0.85}
          />
        </g>
      ))}

      {/* tâm phát âm nảy nhịp */}
      <g transform={`translate(0 ${CY}) scale(${sx.toFixed(3)} ${sy.toFixed(3)})`}>
        <circle cx={0} cy={0} r={20} fill="url(#mk-gen-sound-core)" stroke={ink} strokeWidth={6} />
        <path
          d="M 14 -6 A 15 15 0 0 1 -6 14"
          fill="none"
          stroke={BLUE_DARK}
          strokeWidth={4}
          strokeLinecap="round"
          opacity={0.45}
        />
        <ellipse
          cx={-7}
          cy={-8}
          rx={6}
          ry={4}
          fill={WHITE}
          opacity={0.9}
          transform="rotate(-35 -7 -8)"
        />
        <circle cx={6} cy={-11} r={2} fill={WHITE} opacity={0.8} />
      </g>

      {/* tia lấp lánh */}
      <g
        transform={`translate(-58 ${CY - 52}) rotate(${spin.toFixed(1)}) scale(${(0.6 + 0.4 * tw1).toFixed(3)})`}
        opacity={0.4 + 0.6 * tw1}
      >
        <path d={sparklePath(9)} fill={PALETTE.warn} stroke={ink} strokeWidth={2.5} />
      </g>
      <g
        transform={`translate(62 ${CY - 44}) rotate(${(-spin).toFixed(1)}) scale(${(0.6 + 0.4 * tw2).toFixed(3)})`}
        opacity={0.4 + 0.6 * tw2}
      >
        <path d={sparklePath(7)} fill={WHITE} stroke={ink} strokeWidth={2.5} />
      </g>
      <g
        transform={`translate(56 ${CY + 58}) rotate(${spin.toFixed(1)}) scale(${(0.6 + 0.4 * tw3).toFixed(3)})`}
        opacity={0.4 + 0.6 * tw3}
      >
        <path d={sparklePath(8)} fill={BLUE_LIGHT} stroke={ink} strokeWidth={2.5} />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 182,
  Component: SoundRings,
};
