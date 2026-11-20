import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, lerp, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";

const ink = PALETTE.ink;
const panelBase = "#3b82f6";
const panelDark = "#1e3a8a";
const panelLight = "#93c5fd";

const arcPath = (cy: number, r: number): string => {
  const a = (50 * Math.PI) / 180;
  const dx = r * Math.sin(a);
  const dy = r * Math.cos(a);
  return `M ${(-dx).toFixed(2)} ${(cy + dy).toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 0 ${dx.toFixed(2)} ${(cy + dy).toFixed(2)}`;
};

const Panel: FC<{ x: number; glint: number }> = ({ x, glint }) => (
  <g>
    <rect
      x={x}
      y={-172}
      width={50}
      height={44}
      rx={6}
      fill="url(#mk-gen-sat-panel)"
      stroke={ink}
      strokeWidth={5}
    />
    <line x1={x + 17} y1={-170} x2={x + 17} y2={-130} stroke={panelDark} strokeWidth={2.5} />
    <line x1={x + 33} y1={-170} x2={x + 33} y2={-130} stroke={panelDark} strokeWidth={2.5} />
    <line x1={x + 2} y1={-150} x2={x + 48} y2={-150} stroke={panelDark} strokeWidth={2.5} />
    <rect x={x + 5} y={-167} width={9} height={13} rx={2} fill={panelLight} opacity={0.55} />
    <rect
      x={x + 4 + glint * 36}
      y={-168}
      width={6}
      height={36}
      rx={3}
      fill="#ffffff"
      opacity={0.35 * Math.sin(glint * Math.PI)}
      transform={`skewX(-15)`}
    />
  </g>
);

/** Vệ tinh định vị: thân bạc, hai tấm pin xanh, ăng-ten phát sóng tròn lan rộng. */
const VeTinhDinhVi: FC<PropProps> = ({ frame, seed }) => {
  const bob = 4 * wobble(frame, seed, 90);
  const tilt = 2.5 * wobble(frame, seed + 3, 120);
  const blink = 0.5 + 0.5 * Math.sin(frame * 0.25);
  const glint = (frame % 80) / 80;
  const waveCy = -98;
  const waves = [0, 1, 2].map((i) => {
    const p = ((frame / 60 + i / 3) % 1 + 1) % 1;
    const r = lerp(12, 78, easing.out(p));
    const op = (1 - p) * (1 - p);
    return { r, op, key: i };
  });
  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-sat-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f1f5f9" />
          <stop offset="0.5" stopColor={PALETTE.metal} />
          <stop offset="1" stopColor={PALETTE.metalDark} />
        </linearGradient>
        <linearGradient id="mk-gen-sat-panel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={panelLight} />
          <stop offset="0.45" stopColor={panelBase} />
          <stop offset="1" stopColor={panelDark} />
        </linearGradient>
      </defs>
      {waves.map((w) => (
        <path
          key={w.key}
          d={arcPath(waveCy, w.r)}
          fill="none"
          stroke={PALETTE.ok}
          strokeWidth={6}
          strokeLinecap="round"
          opacity={w.op}
        />
      ))}
      <g transform={`translate(0 ${bob.toFixed(2)}) rotate(${tilt.toFixed(2)} 0 -150)`}>
        {/* struts */}
        <rect x={-38} y={-154} width={14} height={8} fill={PALETTE.metalDark} stroke={ink} strokeWidth={4} />
        <rect x={24} y={-154} width={14} height={8} fill={PALETTE.metalDark} stroke={ink} strokeWidth={4} />
        <Panel x={-86} glint={glint} />
        <Panel x={36} glint={(glint + 0.5) % 1} />
        {/* antenna below */}
        <line x1={0} y1={-122} x2={0} y2={-104} stroke={ink} strokeWidth={6} strokeLinecap="round" />
        <path d="M -14 -108 Q 0 -92 14 -108 Z" fill={PALETTE.metal} stroke={ink} strokeWidth={4} strokeLinejoin="round" />
        <circle cx={0} cy={waveCy} r={4} fill={PALETTE.ok} stroke={ink} strokeWidth={2.5} />
        <circle cx={0} cy={waveCy} r={9} fill={PALETTE.ok} opacity={0.3 * blink} />
        {/* body */}
        <rect
          x={-26}
          y={-182}
          width={52}
          height={62}
          rx={9}
          fill="url(#mk-gen-sat-body)"
          stroke={ink}
          strokeWidth={6}
        />
        <rect x={-19} y={-176} width={10} height={44} rx={5} fill="#ffffff" opacity={0.45} />
        <rect x={10} y={-176} width={10} height={50} rx={5} fill={PALETTE.metalDark} opacity={0.35} />
        <rect x={-12} y={-164} width={24} height={20} rx={4} fill={PALETTE.wood} stroke={ink} strokeWidth={3.5} />
        <line x1={-8} y1={-154} x2={8} y2={-154} stroke={PALETTE.woodDark} strokeWidth={2.5} />
        <circle cx={-18} cy={-128} r={2.5} fill={ink} />
        <circle cx={18} cy={-128} r={2.5} fill={ink} />
        <circle cx={-18} cy={-175} r={2.5} fill={ink} />
        <circle cx={18} cy={-175} r={2.5} fill={ink} />
        {/* top beacon */}
        <line x1={0} y1={-182} x2={0} y2={-192} stroke={ink} strokeWidth={4} strokeLinecap="round" />
        <circle cx={0} cy={-196} r={10} fill={PALETTE.alert} opacity={0.3 * blink} />
        <circle cx={0} cy={-196} r={5} fill={PALETTE.alert} stroke={ink} strokeWidth={3} opacity={0.6 + 0.4 * blink} />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 215,
  Component: VeTinhDinhVi,
};
