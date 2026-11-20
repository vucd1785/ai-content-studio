import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const BLUE = "#2F80ED";
const BLUE_LIGHT = "#8EC5FF";
const ROAD = "#FFFFFF";
const MAP_BASE = "#F4F1E4";
const PARK = "#BFE3A5";
const WATER = "#A9DBF5";

/** Tấm bản đồ thành phố trên giá: chấm định vị xanh nhấp nháy, quầng sáng phập phồng. */
const CityMapLocator: FC<PropProps> = ({ frame, seed }) => {
  const period = 48;
  const ph = (frame % period) / period;
  const ph2 = ((frame + period / 2) % period) / period;
  const ring1 = easing.out(ph);
  const ring2 = easing.out(ph2);
  const beat = Math.max(0, Math.sin((frame / period) * Math.PI * 2));
  const dotScale = 1 + 0.12 * easing.inOut(beat);
  const blink = 0.75 + 0.25 * easing.inOut(beat);
  const sway = 0.8 * wobble(frame, seed, 120);
  const cx = 4;
  const cy = -122;

  const road = (d: string, w: number) => (
    <g>
      <path d={d} fill="none" stroke={ink} strokeWidth={w + 4} strokeLinecap="round" strokeLinejoin="round" opacity={0.55} />
      <path d={d} fill="none" stroke={ROAD} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );

  return (
    <g>
      <defs>
        <clipPath id="mk-gen-map5efd-clip">
          <rect x={-66} y={-192} width={132} height={128} rx={10} />
        </clipPath>
        <linearGradient id="mk-gen-map5efd-shade" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity={0.35} />
          <stop offset="0.55" stopColor="#FFFFFF" stopOpacity={0} />
          <stop offset="1" stopColor="#3A2E1F" stopOpacity={0.18} />
        </linearGradient>
        <radialGradient id="mk-gen-map5efd-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={BLUE_LIGHT} stopOpacity={0.9} />
          <stop offset="1" stopColor={BLUE_LIGHT} stopOpacity={0} />
        </radialGradient>
      </defs>
      <ContactShadow halfWidth={66} />
      {/* chân giá */}
      <path d="M -40 -60 L -52 0" stroke={ink} strokeWidth={14} strokeLinecap="round" />
      <path d="M -40 -60 L -52 0" stroke={PALETTE.wood} strokeWidth={7} strokeLinecap="round" />
      <path d="M 40 -60 L 52 0" stroke={ink} strokeWidth={14} strokeLinecap="round" />
      <path d="M 40 -60 L 52 0" stroke={PALETTE.woodDark} strokeWidth={7} strokeLinecap="round" />
      <g transform={`rotate(${sway.toFixed(2)} 0 -60)`}>
        {/* khung gỗ */}
        <rect x={-76} y={-202} width={152} height={148} rx={16} fill={PALETTE.wood} stroke={ink} strokeWidth={6} />
        <rect x={-76} y={-80} width={152} height={26} rx={12} fill={PALETTE.woodDark} opacity={0.45} />
        {/* bản đồ */}
        <rect x={-66} y={-192} width={132} height={128} rx={10} fill={MAP_BASE} />
        <g clipPath="url(#mk-gen-map5efd-clip)">
          {/* công viên */}
          <path d="M -70 -196 L -22 -196 Q -14 -170 -30 -156 Q -50 -146 -70 -152 Z" fill={PARK} stroke={ink} strokeWidth={3} />
          <circle cx={-48} cy={-176} r={7} fill={PALETTE.leaf} stroke={ink} strokeWidth={2.5} />
          <circle cx={-34} cy={-168} r={5} fill={PALETTE.leaf} stroke={ink} strokeWidth={2.5} />
          {/* dòng sông */}
          <path d="M 70 -170 Q 40 -150 50 -120 Q 60 -92 30 -60" fill="none" stroke={ink} strokeWidth={18} strokeLinecap="round" opacity={0.5} />
          <path d="M 70 -170 Q 40 -150 50 -120 Q 60 -92 30 -60" fill="none" stroke={WATER} strokeWidth={13} strokeLinecap="round" />
          {/* khối nhà */}
          <rect x={-58} y={-110} width={22} height={16} rx={4} fill="#F7C9A6" stroke={ink} strokeWidth={2.5} />
          <rect x={-30} y={-100} width={18} height={22} rx={4} fill="#FBE3A0" stroke={ink} strokeWidth={2.5} />
          <rect x={14} y={-182} width={20} height={16} rx={4} fill="#F7C9A6" stroke={ink} strokeWidth={2.5} />
          <rect x={-4} y={-90} width={20} height={16} rx={4} fill="#D9C8F0" stroke={ink} strokeWidth={2.5} />
          {/* đường phố */}
          {road("M -70 -136 L 70 -136", 8)}
          {road("M 4 -196 L 4 -60", 8)}
          {road("M -70 -84 Q -40 -88 -20 -118 L 4 -136", 5)}
          {road("M 4 -160 L 70 -150", 5)}
          {/* quầng sáng */}
          <circle cx={cx} cy={cy - 14} r={8 + 26 * ring1} fill="none" stroke={BLUE} strokeWidth={3} opacity={0.7 * (1 - ring1)} />
          <circle cx={cx} cy={cy - 14} r={8 + 26 * ring2} fill="none" stroke={BLUE} strokeWidth={3} opacity={0.7 * (1 - ring2)} />
        </g>
        <rect x={-66} y={-192} width={132} height={128} rx={10} fill="url(#mk-gen-map5efd-shade)" stroke={ink} strokeWidth={4} />
        {/* chấm định vị */}
        <g transform={`translate(${cx} ${cy - 14}) scale(${dotScale.toFixed(3)})`}>
          <circle cx={0} cy={0} r={24} fill="url(#mk-gen-map5efd-glow)" opacity={0.6 + 0.4 * beat} />
          <circle cx={0} cy={0} r={12} fill="#FFFFFF" stroke={ink} strokeWidth={4} />
          <circle cx={0} cy={0} r={8} fill={BLUE} opacity={blink} />
          <circle cx={-3} cy={-3} r={2.6} fill="#FFFFFF" opacity={0.85} />
        </g>
        {/* đinh vít & bóng sáng khung */}
        <circle cx={-68} cy={-194} r={3.5} fill={PALETTE.metal} stroke={ink} strokeWidth={2} />
        <circle cx={68} cy={-194} r={3.5} fill={PALETTE.metal} stroke={ink} strokeWidth={2} />
        <path d="M -62 -186 Q -60 -190 -50 -190" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" fill="none" opacity={0.7} />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 82,
  height: 210,
  Component: CityMapLocator,
};
