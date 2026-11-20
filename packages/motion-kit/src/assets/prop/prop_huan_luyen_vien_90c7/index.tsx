import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, lerp, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const coachShirt = "#3f5b8c";
const coachShirtDark = "#2c4068";

type FigProps = { x: number; frame: number; phase: number };

const Player: FC<FigProps> = ({ x, frame, phase }) => {
  const p = ((frame + phase) % 30) / 30;
  const up = Math.sin(Math.PI * p);
  const hop = 11 * easing.out(up);
  const land = Math.pow(1 - up, 4);
  const sy = 1 + 0.05 * up - 0.08 * land;
  const sx = 1 / sy;
  const handY = lerp(-56, -100, easing.inOut(up));
  const handX = lerp(20, 18, up);
  const footX = lerp(8, 15, up);
  return (
    <g transform={`translate(${x} ${(-hop).toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)})`}>
      <line x1={-5} y1={-44} x2={-footX} y2={0} stroke={ink} strokeWidth={6} strokeLinecap="round" />
      <line x1={5} y1={-44} x2={footX} y2={0} stroke={ink} strokeWidth={6} strokeLinecap="round" />
      <ellipse cx={-footX - 2} cy={-1} rx={6} ry={3.5} fill={PALETTE.woodDark} stroke={ink} strokeWidth={2.5} />
      <ellipse cx={footX + 2} cy={-1} rx={6} ry={3.5} fill={PALETTE.woodDark} stroke={ink} strokeWidth={2.5} />
      <line x1={-11} y1={-74} x2={-handX} y2={handY} stroke={ink} strokeWidth={5} strokeLinecap="round" />
      <line x1={11} y1={-74} x2={handX} y2={handY} stroke={ink} strokeWidth={5} strokeLinecap="round" />
      <circle cx={-handX} cy={handY} r={3.5} fill={PALETTE.tiSkin} stroke={ink} strokeWidth={2} />
      <circle cx={handX} cy={handY} r={3.5} fill={PALETTE.tiSkin} stroke={ink} strokeWidth={2} />
      <path
        d="M -14 -76 Q 0 -82 14 -76 L 12 -42 Q 0 -39 -12 -42 Z"
        fill="url(#mk-gen-hlv-jersey)"
        stroke={ink}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <rect x={-2.5} y={-74} width={5} height={30} fill="#2f7d3a" opacity={0.7} />
      <path d="M -10 -72 L -9 -48" stroke="#ffffff" strokeWidth={3} strokeLinecap="round" opacity={0.35} />
      <circle cx={0} cy={-94} r={12} fill={PALETTE.tiSkin} stroke={ink} strokeWidth={5} />
      <path d="M -7 -101 A 9 9 0 0 1 4 -104" stroke="#ffffff" strokeWidth={2.5} fill="none" opacity={0.5} strokeLinecap="round" />
      <circle cx={-4} cy={-95} r={1.8} fill={ink} />
      <circle cx={4} cy={-95} r={1.8} fill={ink} />
      <path d="M -4 -89 Q 0 -86 4 -89" stroke={ink} strokeWidth={2} fill="none" strokeLinecap="round" />
    </g>
  );
};

/** Huấn luyện viên cầm bảng chiến thuật cạnh ba cầu thủ áo xanh lá đang bật nhảy khởi động. */
const CoachTeam: FC<PropProps> = ({ frame, seed }) => {
  const nod = 3 * wobble(frame, seed, 50);
  const boardBob = 2 * wobble(frame, seed + 3, 36);
  const arrowGlow = 0.55 + 0.45 * Math.sin(frame * 0.15);
  const cx = -64;
  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-hlv-jersey" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7fd88a" />
          <stop offset="0.55" stopColor={PALETTE.leaf} />
          <stop offset="1" stopColor="#2f7d3a" />
        </linearGradient>
        <linearGradient id="mk-gen-hlv-coach" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5a7bb3" />
          <stop offset="1" stopColor={coachShirtDark} />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={86} />

      {/* Huấn luyện viên */}
      <g transform={`translate(${cx} 0)`}>
        <line x1={-5} y1={-48} x2={-9} y2={0} stroke={ink} strokeWidth={6} strokeLinecap="round" />
        <line x1={5} y1={-48} x2={9} y2={0} stroke={ink} strokeWidth={6} strokeLinecap="round" />
        <ellipse cx={-11} cy={-1} rx={7} ry={3.5} fill={PALETTE.woodDark} stroke={ink} strokeWidth={2.5} />
        <ellipse cx={11} cy={-1} rx={7} ry={3.5} fill={PALETTE.woodDark} stroke={ink} strokeWidth={2.5} />
        <path
          d="M -15 -84 Q 0 -90 15 -84 L 13 -46 Q 0 -43 -13 -46 Z"
          fill="url(#mk-gen-hlv-coach)"
          stroke={ink}
          strokeWidth={5}
          strokeLinejoin="round"
        />
        <path d="M -11 -80 L -10 -52" stroke="#ffffff" strokeWidth={3} strokeLinecap="round" opacity={0.3} />
        <path d="M -5 -86 L 0 -76 L 5 -86" stroke={ink} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
        <circle cx={0} cy={-72} r={3} fill={PALETTE.metal} stroke={ink} strokeWidth={1.5} />
        <g transform={`translate(0 ${boardBob.toFixed(2)})`}>
          <line x1={-12} y1={-82} x2={-12} y2={-62} stroke={ink} strokeWidth={5} strokeLinecap="round" />
          <line x1={12} y1={-82} x2={14} y2={-62} stroke={ink} strokeWidth={5} strokeLinecap="round" />
          <rect x={-15} y={-76} width={34} height={30} rx={4} fill={PALETTE.wood} stroke={ink} strokeWidth={4} transform="rotate(-8 2 -61)" />
          <g transform="rotate(-8 2 -61)">
            <rect x={-11} y={-71} width={26} height={21} rx={2} fill={PALETTE.paper} />
            <rect x={-3} y={-79} width={10} height={6} rx={2} fill={PALETTE.metalDark} stroke={ink} strokeWidth={2} />
            <circle cx={-6} cy={-65} r={2.5} fill={PALETTE.leaf} />
            <circle cx={-6} cy={-56} r={2.5} fill={PALETTE.leaf} />
            <circle cx={10} cy={-62} r={2.5} fill={PALETTE.alert} />
            <path d="M -3 -60 Q 3 -68 8 -57" stroke={PALETTE.accent} strokeWidth={2} fill="none" strokeDasharray="2 2" opacity={arrowGlow} />
          </g>
          <circle cx={-13} cy={-63} r={3.5} fill={PALETTE.tiSkin} stroke={ink} strokeWidth={2} />
          <circle cx={15} cy={-61} r={3.5} fill={PALETTE.tiSkin} stroke={ink} strokeWidth={2} />
        </g>
        <g transform={`rotate(${nod.toFixed(2)} 0 -88)`}>
          <circle cx={0} cy={-101} r={13} fill={PALETTE.tiSkin} stroke={ink} strokeWidth={5} />
          <path d="M -15 -104 Q -14 -120 0 -120 Q 14 -120 15 -104 Z" fill={coachShirt} stroke={ink} strokeWidth={4} strokeLinejoin="round" />
          <path d="M 10 -105 L 24 -103" stroke={ink} strokeWidth={5} strokeLinecap="round" />
          <path d="M -8 -114 Q -3 -118 3 -117" stroke="#ffffff" strokeWidth={2.5} fill="none" opacity={0.45} strokeLinecap="round" />
          <circle cx={-4} cy={-99} r={1.8} fill={ink} />
          <circle cx={5} cy={-99} r={1.8} fill={ink} />
          <path d="M -3 -93 L 4 -93" stroke={ink} strokeWidth={2} strokeLinecap="round" />
        </g>
      </g>

      {/* Ba cầu thủ khởi động */}
      <Player x={-12} frame={frame} phase={0} />
      <Player x={28} frame={frame} phase={10} />
      <Player x={66} frame={frame} phase={20} />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 130,
  Component: CoachTeam,
};
