import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble, easing, clamp } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

/** Đống quần áo rối tung nhiều màu, tay áo vắt chéo, rung rinh như sắp đổ. */
const DongQuanAo: FC<PropProps> = ({ frame, seed }) => {
  const w1 = wobble(frame, seed, 46);
  const w2 = wobble(frame - 6, seed, 46);
  const w3 = wobble(frame - 11, seed + 3, 46);
  const tipRaw = 0.5 + 0.5 * wobble(frame, seed + 9, 90);
  const tip = easing.inOut(clamp(tipRaw, 0, 1));
  const base = 1.2 * w1;
  const mid = 2.2 * w2;
  const top = 3.5 * w3 + 3 * tip;
  const squash = 1 + 0.018 * Math.sin(frame * 0.14);
  const sockSwing = 8 * wobble(frame - 14, seed + 5, 30);
  return (
    <g>
      <ContactShadow halfWidth={74} />
      <defs>
        <radialGradient id="mk-gen-pile-light" cx="0.3" cy="0.25" r="0.8">
          <stop offset="0" stopColor="#ffffff" stopOpacity={0.45} />
          <stop offset="0.6" stopColor="#ffffff" stopOpacity={0} />
        </radialGradient>
        <linearGradient id="mk-gen-pile-shade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0.55" stopColor="#000000" stopOpacity={0} />
          <stop offset="1" stopColor="#000000" stopOpacity={0.22} />
        </linearGradient>
      </defs>
      <g transform={`rotate(${base.toFixed(2)}) scale(${(2 - squash).toFixed(3)} ${squash.toFixed(3)})`}>
        {/* Ống quần jean thò ra */}
        <path
          d="M36 -22 Q58 -22 72 -8 L66 -2 Q52 -10 34 -8 Z"
          fill="#3f6fc4"
          stroke={ink}
          strokeWidth={5}
          strokeLinejoin="round"
        />
        {/* Quần jean dưới cùng */}
        <path
          d="M-70 -4 Q-72 -34 -40 -42 Q0 -50 40 -42 Q70 -34 68 -4 Q0 4 -70 -4 Z"
          fill="#4a7bd0"
          stroke={ink}
          strokeWidth={6}
          strokeLinejoin="round"
        />
        <path d="M-70 -4 Q-72 -34 -40 -42 Q0 -50 40 -42 Q70 -34 68 -4 Q0 4 -70 -4 Z" fill="url(#mk-gen-pile-shade)" />
        <path d="M-30 -10 Q-26 -26 -12 -34" fill="none" stroke="#2c4f94" strokeWidth={3} strokeLinecap="round" />
        <path d="M20 -8 Q24 -22 14 -34" fill="none" stroke="#2c4f94" strokeWidth={3} strokeLinecap="round" />
        <ellipse cx={-42} cy={-30} rx={16} ry={5} fill="#ffffff" opacity={0.3} />

        <g transform={`rotate(${mid.toFixed(2)} 0 -40)`}>
          {/* Tay áo đỏ buông xuống trái */}
          <path
            d="M-52 -50 Q-70 -40 -72 -18 L-60 -16 Q-58 -34 -44 -40 Z"
            fill={PALETTE.alert}
            stroke={ink}
            strokeWidth={5}
            strokeLinejoin="round"
          />
          {/* Áo thun đỏ */}
          <path
            d="M-58 -38 Q-60 -72 -20 -78 Q30 -82 56 -62 Q66 -46 54 -36 Q0 -30 -58 -38 Z"
            fill={PALETTE.alert}
            stroke={ink}
            strokeWidth={6}
            strokeLinejoin="round"
          />
          <path d="M-58 -38 Q-60 -72 -20 -78 Q30 -82 56 -62 Q66 -46 54 -36 Q0 -30 -58 -38 Z" fill="url(#mk-gen-pile-shade)" />
          <circle cx={20} cy={-50} r={3.5} fill={PALETTE.paper} stroke={ink} strokeWidth={2} />
          <circle cx={34} cy={-48} r={3.5} fill={PALETTE.paper} stroke={ink} strokeWidth={2} />
          <ellipse cx={-34} cy={-62} rx={14} ry={4} fill="#ffffff" opacity={0.35} />

          {/* Khăn sọc vàng */}
          <path
            d="M-46 -68 Q-40 -100 0 -102 Q40 -100 48 -72 Q0 -62 -46 -68 Z"
            fill={PALETTE.warn}
            stroke={ink}
            strokeWidth={6}
            strokeLinejoin="round"
          />
          <path d="M-22 -68 Q-20 -86 -14 -100" fill="none" stroke={PALETTE.accent} strokeWidth={5} />
          <path d="M8 -66 Q10 -84 6 -101" fill="none" stroke={PALETTE.accent} strokeWidth={5} />
          <path d="M32 -68 Q34 -84 28 -98" fill="none" stroke={PALETTE.accent} strokeWidth={5} />
          <path d="M-46 -68 Q-40 -100 0 -102 Q40 -100 48 -72 Q0 -62 -46 -68 Z" fill="url(#mk-gen-pile-light)" />

          <g transform={`rotate(${top.toFixed(2)} 0 -92)`}>
            {/* Áo len xanh */}
            <path
              d="M-38 -94 Q-32 -126 4 -128 Q38 -124 42 -96 Q0 -86 -38 -94 Z"
              fill={PALETTE.leaf}
              stroke={ink}
              strokeWidth={6}
              strokeLinejoin="round"
            />
            <path d="M-38 -94 Q-32 -126 4 -128 Q38 -124 42 -96 Q0 -86 -38 -94 Z" fill="url(#mk-gen-pile-light)" />
            <path d="M-38 -94 Q-32 -126 4 -128 Q38 -124 42 -96 Q0 -86 -38 -94 Z" fill="url(#mk-gen-pile-shade)" />
            {/* Tay áo len vắt chéo */}
            <path d="M-26 -118 Q10 -96 58 -60" fill="none" stroke={ink} strokeWidth={22} strokeLinecap="round" />
            <path d="M-26 -118 Q10 -96 58 -60" fill="none" stroke={PALETTE.leaf} strokeWidth={13} strokeLinecap="round" />
            <path d="M-20 -118 Q8 -102 30 -86" fill="none" stroke="#ffffff" strokeWidth={3} strokeLinecap="round" opacity={0.4} />
            <ellipse cx={60} cy={-58} rx={8} ry={10} fill="#2f8a4a" stroke={ink} strokeWidth={4} transform="rotate(-40 60 -58)" />
            {/* Chiếc tất hồng trên đỉnh */}
            <g transform={`rotate(${sockSwing.toFixed(2)} 6 -126)`}>
              <path
                d="M-4 -126 L-4 -148 L12 -148 L12 -136 Q26 -136 26 -128 Q26 -122 18 -122 L-2 -122 Z"
                fill="#f28fb5"
                stroke={ink}
                strokeWidth={5}
                strokeLinejoin="round"
              />
              <rect x={-6} y={-152} width={20} height={7} rx={3} fill={PALETTE.paper} stroke={ink} strokeWidth={3} />
              <circle cx={2} cy={-138} r={2.5} fill="#ffffff" opacity={0.6} />
            </g>
          </g>
        </g>
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 80,
  height: 160,
  Component: DongQuanAo,
};
