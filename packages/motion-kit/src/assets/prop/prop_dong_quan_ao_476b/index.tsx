import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

/** Đống quần áo lộn xộn: quần, áo phông, tất chồng lên nhau, ống tay áo rủ xuống đung đưa nhẹ. */
const ClothesPile: FC<PropProps> = ({ frame, seed }) => {
  const period = 70;
  const ph = (frame * 2 * Math.PI) / period;
  const sway = 7 * Math.sin(ph);
  const cuff = 6 * Math.sin(ph - 0.9);
  const breathe = 1 + 0.012 * Math.sin(ph * 0.5);
  const sockBob = 1.5 * wobble(frame, seed + 3, 90);
  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-shirt-476b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff8c78" />
          <stop offset="1" stopColor="#d9503f" />
        </linearGradient>
        <linearGradient id="mk-gen-pants-476b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5f8fd6" />
          <stop offset="1" stopColor="#355c9c" />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={72} />
      <g transform={`scale(1 ${breathe.toFixed(4)})`}>
        {/* Quần */}
        <path
          d="M -68 -6 L -64 -46 L 22 -50 L 68 -30 L 64 -4 Z"
          fill="url(#mk-gen-pants-476b)"
          stroke={ink}
          strokeWidth={6}
          strokeLinejoin="round"
        />
        <path d="M 14 -26 L 64 -17" stroke={ink} strokeWidth={4} strokeLinecap="round" />
        <path d="M -60 -44 L -64 -8" stroke="#2a4a80" strokeWidth={6} opacity={0.6} />
        <circle cx={-56} cy={-30} r={3} fill={PALETTE.warn} stroke={ink} strokeWidth={2} />
        <path d="M 30 -8 L 60 -8 L 62 -18 Z" fill="#244277" opacity={0.35} />
        {/* Tất vàng sọc */}
        <path
          d="M -64 -24 L -34 -26 Q -18 -26 -18 -14 Q -18 -4 -30 -4 L -64 -6 Z"
          fill="#ffd34d"
          stroke={ink}
          strokeWidth={5}
          strokeLinejoin="round"
        />
        <line x1={-54} y1={-25} x2={-54} y2={-5} stroke="#3fae86" strokeWidth={5} />
        <line x1={-45} y1={-25} x2={-45} y2={-5} stroke="#3fae86" strokeWidth={5} />
        <path d="M -60 -20 L -38 -21" stroke="#ffffff" strokeWidth={3} strokeLinecap="round" opacity={0.5} />
        {/* Tay áo trái */}
        <path
          d="M -38 -78 Q -58 -80 -68 -62 L -54 -52 Q -46 -60 -38 -60 Z"
          fill="url(#mk-gen-shirt-476b)"
          stroke={ink}
          strokeWidth={5}
          strokeLinejoin="round"
        />
        {/* Thân áo */}
        <path
          d="M -46 -40 Q -52 -80 -20 -86 L 22 -88 Q 48 -82 42 -42 Q 0 -32 -46 -40 Z"
          fill="url(#mk-gen-shirt-476b)"
          stroke={ink}
          strokeWidth={6}
          strokeLinejoin="round"
        />
        <path d="M -38 -46 Q -42 -72 -24 -78" stroke="#ffffff" strokeWidth={4} strokeLinecap="round" fill="none" opacity={0.45} />
        <path d="M 20 -46 Q 36 -50 36 -70 L 40 -48 Z" fill="#a8372a" opacity={0.35} />
        <path d="M -8 -60 Q 0 -52 10 -62" stroke="#a8372a" strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.6} />
        <path
          d="M -12 -86 Q 0 -72 13 -87"
          fill="#b8402f"
          stroke={ink}
          strokeWidth={4}
          strokeLinecap="round"
        />
        {/* Tay áo rủ đung đưa */}
        <g transform={`rotate(${sway.toFixed(2)} 40 -68)`}>
          <path
            d="M 32 -80 Q 54 -78 60 -60 L 63 -38 Q 54 -34 46 -38 L 38 -58 Z"
            fill="url(#mk-gen-shirt-476b)"
            stroke={ink}
            strokeWidth={5}
            strokeLinejoin="round"
          />
          <path d="M 52 -72 Q 57 -60 58 -44" stroke="#a8372a" strokeWidth={4} fill="none" opacity={0.4} strokeLinecap="round" />
          <g transform={`rotate(${cuff.toFixed(2)} 54 -37)`}>
            <path
              d="M 45 -40 L 64 -40 L 65 -29 L 46 -28 Z"
              fill="#ffffff"
              stroke={ink}
              strokeWidth={4}
              strokeLinejoin="round"
            />
          </g>
        </g>
        {/* Tất tím vắt trên đỉnh */}
        <g transform={`translate(0 ${sockBob.toFixed(2)})`}>
          <path
            d="M -18 -88 Q -8 -102 8 -98 Q 20 -96 22 -86 Q 10 -82 -2 -86 Z"
            fill="#9b6fd0"
            stroke={ink}
            strokeWidth={5}
            strokeLinejoin="round"
          />
          <path d="M -8 -94 Q 0 -98 8 -96" stroke="#ffffff" strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.5} />
        </g>
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 80,
  height: 110,
  Component: ClothesPile,
};
