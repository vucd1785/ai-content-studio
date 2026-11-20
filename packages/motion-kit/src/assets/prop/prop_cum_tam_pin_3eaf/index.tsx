import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

const BLADE = "M -4 0 Q -8 -16 -1 -29 Q 6 -15 4 0 Z";

type TurbineProps = { cx: number; hubY: number; angle: number; sway: number };

const Turbine: FC<TurbineProps> = ({ cx, hubY, angle, sway }) => (
  <g>
    <polygon
      points={`${cx - 6},0 ${cx + 6},0 ${cx + 3},${hubY} ${cx - 3},${hubY}`}
      fill={PALETTE.paper}
      stroke={ink}
      strokeWidth={5}
      strokeLinejoin="round"
    />
    <polygon
      points={`${cx + 1},-3 ${cx + 4},-3 ${cx + 2},${hubY + 6} ${cx + 1},${hubY + 6}`}
      fill={PALETTE.metal}
      opacity={0.45}
    />
    <rect x={cx - 9} y={hubY - 6} width={18} height={11} rx={5} fill={PALETTE.paper} stroke={ink} strokeWidth={4} />
    <g transform={`translate(${cx} ${hubY}) rotate(${(angle + sway).toFixed(2)})`}>
      {[0, 120, 240].map((a) => (
        <g key={a} transform={`rotate(${a})`}>
          <path d={BLADE} fill={PALETTE.paper} stroke={ink} strokeWidth={4} strokeLinejoin="round" />
          <path d="M 1 -4 Q 3 -14 0 -24" fill="none" stroke={PALETTE.metal} strokeWidth={2.5} opacity={0.6} strokeLinecap="round" />
        </g>
      ))}
      <circle cx={0} cy={0} r={5.5} fill={PALETTE.metal} stroke={ink} strokeWidth={3.5} />
      <circle cx={-1.5} cy={-1.5} r={1.8} fill={PALETTE.paper} />
    </g>
  </g>
);

type PanelProps = { x0: number; x1: number; inset: number; glints: number[] };

const Panel: FC<PanelProps> = ({ x0, x1, inset, glints }) => {
  const yb = -30;
  const yt = -78;
  const bl = x0;
  const br = x1;
  const tl = x0 + inset;
  const tr = x1 + inset * 0.2;
  const pt = (u: number, v: number): [number, number] => {
    const lx = bl + (tl - bl) * v;
    const rx = br + (tr - br) * v;
    return [lx + (rx - lx) * u, yb + (yt - yb) * v];
  };
  const cols = [0.25, 0.5, 0.75];
  const rows = [0.33, 0.66];
  return (
    <g>
      <line x1={pt(0.15, 0)[0]} y1={yb} x2={pt(0.15, 0)[0]} y2={0} stroke={ink} strokeWidth={5} strokeLinecap="round" />
      <line x1={pt(0.85, 0)[0]} y1={yb} x2={pt(0.85, 0)[0]} y2={0} stroke={ink} strokeWidth={5} strokeLinecap="round" />
      <line x1={pt(0.5, 0.5)[0]} y1={pt(0.5, 0.5)[1]} x2={pt(0.5, 0)[0]} y2={0} stroke={PALETTE.metalDark} strokeWidth={4} strokeLinecap="round" />
      <polygon
        points={`${bl},${yb} ${br},${yb} ${tr},${yt} ${tl},${yt}`}
        fill="url(#mk-gen-solar-panel)"
        stroke={ink}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      {cols.map((u) => {
        const a = pt(u, 0);
        const b = pt(u, 1);
        return <line key={`c${u}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#1E3A8A" strokeWidth={2} opacity={0.7} />;
      })}
      {rows.map((v) => {
        const a = pt(0, v);
        const b = pt(1, v);
        return <line key={`r${v}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#1E3A8A" strokeWidth={2} opacity={0.7} />;
      })}
      <polygon
        points={`${pt(0.05, 0.6)[0]},${pt(0.05, 0.6)[1]} ${pt(0.3, 0.95)[0]},${pt(0.3, 0.95)[1]} ${pt(0.42, 0.95)[0]},${pt(0.42, 0.95)[1]} ${pt(0.12, 0.45)[0]},${pt(0.12, 0.45)[1]}`}
        fill="#FFFFFF"
        opacity={0.35}
      />
      <rect x={bl - 2} y={yb - 1} width={br - bl + 4} height={5} rx={2} fill={PALETTE.metalDark} stroke={ink} strokeWidth={3} />
      {glints.map((g, i) => {
        const p = pt(0.3 + 0.4 * i, 0.55 + 0.2 * (i % 2));
        const s = 0.2 + 0.8 * g;
        return (
          <g key={i} transform={`translate(${p[0].toFixed(2)} ${p[1].toFixed(2)}) scale(${s.toFixed(3)})`} opacity={g}>
            <path d="M 0 -8 L 2 -2 L 8 0 L 2 2 L 0 8 L -2 2 L -8 0 L -2 -2 Z" fill="#FFFFFF" />
          </g>
        );
      })}
    </g>
  );
};

/** Hai tấm pin quang điện lấp lánh cạnh hai tua-bin gió quay chậm. */
const SolarWindCluster: FC<PropProps> = ({ frame, seed }) => {
  const angle = (frame * 1.6 + seed * 37) % 360;
  const angle2 = (frame * 1.3 + seed * 53 + 50) % 360;
  const sway = 3 * wobble(frame, seed, 90);
  const glint = (offset: number) => {
    const ph = ((frame + offset) % 60) / 60;
    const tri = ph < 0.5 ? ph * 2 : 2 - ph * 2;
    return easing.inOut(Math.max(0, tri * 1.6 - 0.6) / 1);
  };
  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-solar-panel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7DD3FC" />
          <stop offset="0.5" stopColor="#3B82F6" />
          <stop offset="1" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={86} />
      <Turbine cx={-56} hubY={-200} angle={angle} sway={sway} />
      <Turbine cx={60} hubY={-168} angle={angle2} sway={-sway} />
      <Panel x0={-78} x1={-8} inset={10} glints={[glint(0), glint(30)]} />
      <Panel x0={6} x1={76} inset={10} glints={[glint(15), glint(45)]} />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 236,
  Component: SolarWindCluster,
};
