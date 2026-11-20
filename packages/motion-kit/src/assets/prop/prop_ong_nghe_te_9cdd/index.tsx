import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const tube = "#2BB3A3";
const tubeLight = "#8FE6DA";
const tubeDark = "#1A7F74";

/** Ống nghe y tế: dây xanh mềm khẽ đung đưa, mặt nghe bạc lấp lánh. */
const OngNghe: FC<PropProps> = ({ frame, seed }) => {
  const sway = 3 * wobble(frame, seed, 90);
  const bend = 8 * wobble(frame, seed + 3, 70);
  const phase = (frame % 60) / 60;
  const tw = phase < 0.5 ? easing.inOut(phase * 2) : easing.inOut((1 - phase) * 2);
  const glint = 0.35 + 0.4 * tw;
  const sp = 0.5 + 0.6 * easing.outBack(1.6)(tw);
  const mainTube = `M 22 -50 C 24 -90 ${(-40 + bend).toFixed(2)} -88 -18 -118 C -8 -132 0 -134 0 -140`;
  const leftTube = "M 0 -140 C -6 -152 -22 -160 -26 -176";
  const rightTube = "M 0 -140 C 6 -152 22 -160 26 -176";
  return (
    <g>
      <defs>
        <radialGradient id="mk-gen-ongnghe-silver" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#F4F7FA" />
          <stop offset="0.55" stopColor={PALETTE.metal} />
          <stop offset="1" stopColor={PALETTE.metalDark} />
        </radialGradient>
      </defs>
      <ContactShadow halfWidth={58} />
      <g transform={`rotate(${sway.toFixed(2)} 22 -26)`}>
        {/* dây chính */}
        <path d={mainTube} fill="none" stroke={ink} strokeWidth={17} strokeLinecap="round" />
        <path d={mainTube} fill="none" stroke={tube} strokeWidth={10} strokeLinecap="round" />
        <path d={mainTube} fill="none" stroke={tubeDark} strokeWidth={4} strokeLinecap="round" opacity={0.35} transform="translate(2 1)" />
        <path d={mainTube} fill="none" stroke={tubeLight} strokeWidth={3} strokeLinecap="round" opacity={0.7} transform="translate(-2 -1)" />
        <g transform={`rotate(${(sway * 1.5).toFixed(2)} 0 -140)`}>
          {/* hai nhánh dây */}
          {[leftTube, rightTube].map((d, i) => (
            <g key={i}>
              <path d={d} fill="none" stroke={ink} strokeWidth={15} strokeLinecap="round" />
              <path d={d} fill="none" stroke={tube} strokeWidth={8} strokeLinecap="round" />
              <path d={d} fill="none" stroke={tubeLight} strokeWidth={2.5} strokeLinecap="round" opacity={0.7} transform="translate(-1.5 -1)" />
            </g>
          ))}
          {/* ống kim loại tai nghe */}
          <path d="M -26 -176 C -30 -192 -26 -202 -15 -206" fill="none" stroke={ink} strokeWidth={10} strokeLinecap="round" />
          <path d="M -26 -176 C -30 -192 -26 -202 -15 -206" fill="none" stroke={PALETTE.metal} strokeWidth={5} strokeLinecap="round" />
          <path d="M 26 -176 C 30 -192 26 -202 15 -206" fill="none" stroke={ink} strokeWidth={10} strokeLinecap="round" />
          <path d="M 26 -176 C 30 -192 26 -202 15 -206" fill="none" stroke={PALETTE.metal} strokeWidth={5} strokeLinecap="round" />
          {/* núm tai */}
          <ellipse cx={-12} cy={-207} rx={8} ry={6} fill={PALETTE.ink} stroke={ink} strokeWidth={4} />
          <ellipse cx={12} cy={-207} rx={8} ry={6} fill={PALETTE.ink} stroke={ink} strokeWidth={4} />
          <circle cx={-14} cy={-209} r={2} fill="#FFFFFF" opacity={0.6} />
          <circle cx={10} cy={-209} r={2} fill="#FFFFFF" opacity={0.6} />
          {/* khớp chữ Y */}
          <rect x={-7} y={-148} width={14} height={14} rx={4} fill={PALETTE.metal} stroke={ink} strokeWidth={4} />
        </g>
        {/* cổ mặt nghe */}
        <rect x={16} y={-58} width={12} height={14} rx={3} fill={PALETTE.metal} stroke={ink} strokeWidth={4} />
        {/* mặt nghe */}
        <circle cx={22} cy={-26} r={25} fill="url(#mk-gen-ongnghe-silver)" stroke={ink} strokeWidth={6} />
        <circle cx={22} cy={-26} r={16} fill="none" stroke={PALETTE.metalDark} strokeWidth={3} opacity={0.6} />
        <path d="M 6 -18 A 17 17 0 0 0 38 -18" fill="none" stroke={PALETTE.metalDark} strokeWidth={4} opacity={0.35} />
        <ellipse cx={13} cy={-36} rx={7} ry={4} fill="#FFFFFF" opacity={glint} transform="rotate(-35 13 -36)" />
        {/* tia lấp lánh */}
        <g transform={`translate(0 -50) scale(${sp.toFixed(3)})`} opacity={0.5 + 0.5 * tw}>
          <path d="M 0 -10 L 3 -3 L 10 0 L 3 3 L 0 10 L -3 3 L -10 0 L -3 -3 Z" fill="#FFFFFF" stroke={PALETTE.warn} strokeWidth={1.5} />
        </g>
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 70,
  height: 225,
  Component: OngNghe,
};
