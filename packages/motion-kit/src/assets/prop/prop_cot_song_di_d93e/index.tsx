import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const TOP_Y = -200;
const BASE_W = 40;
const TOP_W = 12;
const BANDS = [0, 1, 2, 3, 4];
const WAVES = [0, 1, 2];

const widthAt = (y: number): number => BASE_W - (BASE_W - TOP_W) * (-y / -TOP_Y);

const arcPath = (cx: number, cy: number, r: number, dir: number): string => {
  const a = (40 * Math.PI) / 180;
  const x1 = cx + dir * r * Math.cos(a);
  const y1 = cy - r * Math.sin(a);
  const x2 = cx + dir * r * Math.cos(a);
  const y2 = cy + r * Math.sin(a);
  const sweep = dir > 0 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 ${sweep} ${x2.toFixed(2)} ${y2.toFixed(2)}`;
};

/** Cột sóng di động khung thép đỏ trắng, ăng-ten trên đỉnh phát các vòng sóng lan ra hai bên. */
const CellTower: FC<PropProps> = ({ frame, seed }) => {
  const sway = 1.2 * wobble(frame, seed, 90);
  const blink = 0.5 + 0.5 * Math.sin(frame * 0.18);
  const bandH = -TOP_Y / BANDS.length;
  const waveCy = -238;
  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-tower-shade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity={0.35} />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity={0} />
          <stop offset="1" stopColor="#000000" stopOpacity={0.2} />
        </linearGradient>
        <radialGradient id="mk-gen-tower-glow">
          <stop offset="0" stopColor={PALETTE.alert} stopOpacity={0.8} />
          <stop offset="1" stopColor={PALETTE.alert} stopOpacity={0} />
        </radialGradient>
      </defs>
      <ContactShadow halfWidth={70} />
      {/* bệ bê tông */}
      <rect x={-54} y={-14} width={108} height={14} rx={5} fill={PALETTE.metal} stroke={ink} strokeWidth={5} />
      <rect x={-48} y={-11} width={40} height={4} rx={2} fill="#ffffff" opacity={0.4} />

      {/* thanh giằng chéo */}
      {BANDS.map((i) => {
        const y0 = -i * bandH;
        const y1 = -(i + 1) * bandH;
        const w0 = widthAt(y0) - 4;
        const w1 = widthAt(y1) - 4;
        return (
          <g key={`b${i}`} stroke={PALETTE.metalDark} strokeWidth={4} strokeLinecap="round">
            <line x1={-w0} y1={y0} x2={w1} y2={y1} />
            <line x1={w0} y1={y0} x2={-w1} y2={y1} />
            <line x1={-w1} y1={y1} x2={w1} y2={y1} stroke={ink} strokeWidth={5} />
          </g>
        );
      })}

      {/* viền chân tháp */}
      <line x1={-BASE_W} y1={-10} x2={-TOP_W} y2={TOP_Y} stroke={ink} strokeWidth={16} strokeLinecap="round" />
      <line x1={BASE_W} y1={-10} x2={TOP_W} y2={TOP_Y} stroke={ink} strokeWidth={16} strokeLinecap="round" />
      {/* sọc đỏ trắng */}
      {BANDS.map((i) => {
        const y0 = Math.min(-10, -i * bandH);
        const y1 = -(i + 1) * bandH;
        const c = i % 2 === 0 ? PALETTE.alert : "#f6f2ea";
        return (
          <g key={`s${i}`} stroke={c} strokeWidth={8}>
            <line x1={-widthAt(y0)} y1={y0} x2={-widthAt(y1)} y2={y1} />
            <line x1={widthAt(y0)} y1={y0} x2={widthAt(y1)} y2={y1} />
          </g>
        );
      })}
      {/* sáng bên trái, tối bên phải */}
      <line x1={-BASE_W - 2} y1={-12} x2={-TOP_W - 2} y2={TOP_Y + 2} stroke="#ffffff" strokeWidth={3} opacity={0.55} strokeLinecap="round" />
      <line x1={BASE_W + 2} y1={-12} x2={TOP_W + 2} y2={TOP_Y + 2} stroke="#000000" strokeWidth={3} opacity={0.2} strokeLinecap="round" />
      {/* đinh tán */}
      {BANDS.map((i) => {
        const y = -(i + 1) * bandH;
        return (
          <g key={`r${i}`} fill={PALETTE.metalDark}>
            <circle cx={-widthAt(y)} cy={y} r={3} />
            <circle cx={widthAt(y)} cy={y} r={3} />
          </g>
        );
      })}

      {/* phần đỉnh lắc nhẹ */}
      <g transform={`rotate(${sway.toFixed(2)} 0 ${TOP_Y})`}>
        <rect x={-26} y={TOP_Y - 10} width={52} height={12} rx={4} fill={PALETTE.metal} stroke={ink} strokeWidth={5} />
        <rect x={-5} y={-262} width={10} height={54} fill={PALETTE.metalDark} stroke={ink} strokeWidth={5} />
        <rect x={-26} y={-252} width={12} height={34} rx={4} fill="#f6f2ea" stroke={ink} strokeWidth={5} />
        <rect x={14} y={-252} width={12} height={34} rx={4} fill="#f6f2ea" stroke={ink} strokeWidth={5} />
        <rect x={-26} y={-252} width={30} height={34} fill="url(#mk-gen-tower-shade)" opacity={0} />
        <rect x={-23} y={-248} width={3} height={24} rx={1.5} fill="#ffffff" opacity={0.8} />
        <rect x={20} y={-248} width={4} height={26} rx={2} fill="#000000" opacity={0.15} />
        <line x1={-14} y1={-235} x2={-5} y2={-235} stroke={ink} strokeWidth={4} />
        <line x1={5} y1={-235} x2={14} y2={-235} stroke={ink} strokeWidth={4} />
        <circle cx={0} cy={-270} r={18} fill="url(#mk-gen-tower-glow)" opacity={blink} />
        <circle cx={0} cy={-270} r={7} fill={PALETTE.alert} stroke={ink} strokeWidth={4} />
        <circle cx={-2} cy={-272} r={2.2} fill="#ffffff" opacity={0.5 + 0.5 * blink} />
      </g>

      {/* vòng sóng lan ra hai bên */}
      {WAVES.map((k) => {
        const p = (frame / 45 + k / WAVES.length) % 1;
        const r = 26 + 54 * easing.out(p);
        const op = Math.sin(Math.PI * p);
        return (
          <g key={`w${k}`} fill="none" stroke={PALETTE.screen} strokeWidth={6} strokeLinecap="round" opacity={op}>
            <path d={arcPath(0, waveCy, r, 1)} />
            <path d={arcPath(0, waveCy, r, -1)} />
          </g>
        );
      })}
      {/* lớp đổ bóng cả tháp */}
      <polygon
        points={`${-BASE_W},-10 ${BASE_W},-10 ${TOP_W},${TOP_Y} ${-TOP_W},${TOP_Y}`}
        fill="url(#mk-gen-tower-shade)"
        opacity={0.6}
      />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 290,
  Component: CellTower,
};
