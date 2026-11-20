import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";

const ink = PALETTE.ink;

const CY = -16;
const OUTER = 82;
const BAND = 9;
const INNER = OUTER - BAND * 7;
const BANDS = ["#E53935", "#FB8C00", "#FDD835", "#43A047", "#1E88E5", "#3949AB", "#8E24AA"];

const arc = (r: number) => `M ${-r} ${CY} A ${r} ${r} 0 0 1 ${r} ${CY}`;

const ring = `M ${-OUTER} ${CY} A ${OUTER} ${OUTER} 0 0 1 ${OUTER} ${CY} L ${INNER} ${CY} A ${INNER} ${INNER} 0 0 0 ${-INNER} ${CY} Z`;

const star = (s: number) =>
  `M 0 ${-s} Q ${s * 0.2} ${-s * 0.2} ${s} 0 Q ${s * 0.2} ${s * 0.2} 0 ${s} Q ${-s * 0.2} ${s * 0.2} ${-s} 0 Q ${-s * 0.2} ${-s * 0.2} 0 ${-s} Z`;

const Cloud: FC<{ x: number; y: number; flip: number }> = ({ x, y, flip }) => (
  <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${flip} 1)`}>
    <g stroke={ink} strokeWidth={5}>
      <ellipse cx={0} cy={0} rx={30} ry={14} fill={PALETTE.paper} />
      <circle cx={-10} cy={-10} r={13} fill={PALETTE.paper} />
      <circle cx={10} cy={-13} r={15} fill={PALETTE.paper} />
    </g>
    <ellipse cx={0} cy={2} rx={27} ry={11} fill={PALETTE.paper} />
    <circle cx={-10} cy={-9} r={10.5} fill={PALETTE.paper} />
    <circle cx={10} cy={-12} r={12.5} fill={PALETTE.paper} />
    <ellipse cx={6} cy={6} rx={20} ry={5} fill="#C9D6E6" opacity={0.8} />
    <ellipse cx={4} cy={-17} rx={6} ry={3.5} fill="#FFFFFF" opacity={0.9} />
    <ellipse cx={-13} cy={-14} rx={4} ry={2.5} fill="#FFFFFF" opacity={0.8} />
  </g>
);

/** Cầu vồng bảy màu tựa trên hai cụm mây, khẽ phồng lên theo nhịp thở, có vệt sáng lướt và sao lấp lánh. */
const RainbowArc: FC<PropProps> = ({ frame, seed }) => {
  const breathe = 1 + 0.012 * wobble(frame, seed, 60);
  const p = (frame % 96) / 96;
  const sweep = easing.inOut(p);
  const len = Math.PI * (OUTER - 14);
  const dashOff = (1 - sweep) * (len + 30) - 30;
  const sweepOpacity = Math.sin(p * Math.PI);
  const bobL = 2 * wobble(frame, seed + 3, 50);
  const bobR = 2 * wobble(frame, seed + 9, 56);
  const sparkles = [
    { a: 150, r: OUTER + 8, s: 7, ph: 0 },
    { a: 95, r: OUTER + 10, s: 8, ph: 0.33 },
    { a: 40, r: OUTER + 7, s: 6, ph: 0.66 },
    { a: 120, r: INNER + 30, s: 5, ph: 0.5 },
    { a: 62, r: INNER + 22, s: 5, ph: 0.15 },
  ];
  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-rainbow-gloss" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity={0.45} />
          <stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.05} />
          <stop offset="1" stopColor="#1A1030" stopOpacity={0.25} />
        </linearGradient>
      </defs>
      <g transform={`translate(0 ${CY}) scale(${breathe.toFixed(4)}) translate(0 ${-CY})`}>
        {BANDS.map((c, i) => (
          <path
            key={c}
            d={arc(OUTER - BAND / 2 - i * BAND)}
            fill="none"
            stroke={c}
            strokeWidth={BAND + 0.6}
          />
        ))}
        <path d={ring} fill="url(#mk-gen-rainbow-gloss)" />
        {BANDS.map((c, i) => (
          <path
            key={`h${c}`}
            d={arc(OUTER - 2 - i * BAND)}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={1.6}
            opacity={0.35}
          />
        ))}
        <path
          d={arc(OUTER - 14)}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`26 ${(len + 60).toFixed(1)}`}
          strokeDashoffset={dashOff.toFixed(2)}
          opacity={0.55 * sweepOpacity}
        />
        <path d={ring} fill="none" stroke={ink} strokeWidth={6} strokeLinejoin="round" />
      </g>
      <Cloud x={-58} y={CY + 6 + bobL} flip={1} />
      <Cloud x={58} y={CY + 6 + bobR} flip={-1} />
      {sparkles.map((sp, i) => {
        const ph = (frame / 48 + sp.ph) % 1;
        const tw = Math.max(0, Math.sin(ph * Math.PI * 2));
        const sc = easing.outBack(1.6)(tw);
        const rad = (sp.a * Math.PI) / 180;
        const x = Math.cos(rad) * sp.r;
        const y = CY - Math.sin(rad) * sp.r;
        return (
          <g
            key={i}
            transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${(0.2 + sc).toFixed(3)}) rotate(${(ph * 90).toFixed(1)})`}
            opacity={0.3 + 0.7 * tw}
          >
            <path d={star(sp.s)} fill="#FFF7C2" stroke={ink} strokeWidth={2} strokeLinejoin="round" />
            <circle cx={0} cy={0} r={sp.s * 0.25} fill="#FFFFFF" />
          </g>
        );
      })}
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 120,
  Component: RainbowArc,
};
