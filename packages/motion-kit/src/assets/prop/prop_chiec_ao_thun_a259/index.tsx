import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const base = "#4FA3E0";
const light = "#9AD0F5";
const dark = "#2C6FA8";

/** Áo thun bị vo tròn nhăn nhúm như cục bông, tay áo lòi ra, phập phồng rung rinh. */
const CrumpledShirt: FC<PropProps> = ({ frame, seed }) => {
  const breath = Math.sin((frame / 44) * Math.PI * 2);
  const sy = 1 + 0.035 * breath;
  const sx = 1 - 0.025 * breath;
  const shiver = 1.6 * wobble(frame, seed, 22);
  const lag = Math.sin(((frame - 6) / 44) * Math.PI * 2);
  const sleeveR = -8 + 9 * lag + 3 * wobble(frame, seed + 3, 30);
  const sleeveL = 14 - 8 * lag + 3 * wobble(frame, seed + 9, 34);
  const shine = 0.3 + 0.12 * (0.5 + 0.5 * breath);

  return (
    <g>
      <defs>
        <radialGradient id="mk-gen-shirt-ball" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor={light} />
          <stop offset="0.55" stopColor={base} />
          <stop offset="1" stopColor={dark} />
        </radialGradient>
      </defs>
      <ContactShadow halfWidth={62} />
      <g transform={`rotate(${shiver.toFixed(2)} 0 0) scale(${sx.toFixed(4)} ${sy.toFixed(4)})`}>
        {/* tay áo trái thòng xuống */}
        <g transform={`translate(-50 -40) rotate(${sleeveL.toFixed(2)})`}>
          <path
            d="M 4 -14 C -10 -16 -22 -12 -28 -8 L -24 16 C -14 14 -4 14 6 12 Z"
            fill={base}
            stroke={ink}
            strokeWidth={5}
            strokeLinejoin="round"
          />
          <path
            d="M -28 -8 L -24 16 L -18 15 L -22 -10 Z"
            fill={dark}
            stroke={ink}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <path d="M -6 -10 C -10 -2 -10 6 -8 12" fill="none" stroke={ink} strokeWidth={2.5} opacity={0.5} strokeLinecap="round" />
        </g>
        {/* tay áo phải lòi ra */}
        <g transform={`translate(50 -66) rotate(${sleeveR.toFixed(2)})`}>
          <path
            d="M -4 -14 C 10 -18 22 -20 30 -18 L 30 12 C 20 12 8 14 -4 12 Z"
            fill={base}
            stroke={ink}
            strokeWidth={5}
            strokeLinejoin="round"
          />
          <path
            d="M 24 -19 L 31 -18 L 31 12 L 24 12 Z"
            fill={dark}
            stroke={ink}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <path d="M 4 -10 C 10 -6 12 2 10 8" fill="none" stroke={ink} strokeWidth={2.5} opacity={0.5} strokeLinecap="round" />
          <ellipse cx={8} cy={-8} rx={7} ry={3} fill="#FFFFFF" opacity={0.35} />
        </g>
        {/* thân cục áo */}
        <path
          d="M -56 -10 C -70 -40 -62 -84 -32 -98 C -12 -112 20 -110 38 -96 C 62 -82 66 -46 58 -20 C 52 -4 30 0 0 0 C -30 0 -50 -2 -56 -10 Z"
          fill="url(#mk-gen-shirt-ball)"
          stroke={ink}
          strokeWidth={6}
          strokeLinejoin="round"
        />
        {/* nếp gấp tối bên phải dưới */}
        <path
          d="M 18 -6 C 34 -14 50 -26 56 -46 C 60 -30 56 -12 40 -4 C 32 -1 24 -2 18 -6 Z"
          fill={dark}
          opacity={0.45}
        />
        {/* vạt áo gấp chồng lên */}
        <path
          d="M -44 -36 C -30 -52 -6 -56 16 -48 C 26 -44 30 -34 24 -26 C 8 -32 -14 -30 -40 -22 Z"
          fill={light}
          stroke={ink}
          strokeWidth={4}
          strokeLinejoin="round"
        />
        <path d="M -40 -22 C -14 -30 8 -32 24 -26" fill="none" stroke={dark} strokeWidth={4} opacity={0.5} strokeLinecap="round" />
        {/* cổ áo */}
        <ellipse cx={4} cy={-96} rx={20} ry={8} fill={dark} stroke={ink} strokeWidth={4} />
        <ellipse cx={4} cy={-95} rx={12} ry={4} fill={ink} opacity={0.7} />
        <path d="M -16 -98 C -8 -90 16 -90 24 -98" fill="none" stroke={light} strokeWidth={2.5} strokeLinecap="round" />
        {/* nhãn mác nhỏ */}
        <rect x={-2} y={-92} width={9} height={6} rx={1.5} fill={PALETTE.paper} stroke={ink} strokeWidth={2} />
        {/* nếp nhăn */}
        <path d="M -48 -60 C -38 -66 -28 -64 -22 -72" fill="none" stroke={ink} strokeWidth={3} opacity={0.55} strokeLinecap="round" />
        <path d="M 22 -78 C 30 -70 40 -70 46 -62" fill="none" stroke={ink} strokeWidth={3} opacity={0.55} strokeLinecap="round" />
        <path d="M 4 -70 C 10 -64 8 -58 14 -54" fill="none" stroke={ink} strokeWidth={2.5} opacity={0.45} strokeLinecap="round" />
        <path d="M -30 -12 C -22 -16 -12 -12 -6 -16" fill="none" stroke={ink} strokeWidth={2.5} opacity={0.45} strokeLinecap="round" />
        <path d="M 36 -40 C 42 -32 40 -24 46 -18" fill="none" stroke={ink} strokeWidth={2.5} opacity={0.45} strokeLinecap="round" />
        {/* ánh sáng phía trên trái */}
        <ellipse cx={-30} cy={-80} rx={14} ry={7} fill="#FFFFFF" opacity={shine} transform="rotate(-30 -30 -80)" />
        <circle cx={-44} cy={-66} r={3.5} fill="#FFFFFF" opacity={shine + 0.15} />
        <ellipse cx={-14} cy={-46} rx={10} ry={3} fill="#FFFFFF" opacity={shine * 0.8} />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 86,
  height: 122,
  Component: CrumpledShirt,
};
