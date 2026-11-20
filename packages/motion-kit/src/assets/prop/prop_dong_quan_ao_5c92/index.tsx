import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble, clamp } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const JEAN = "#3b6fd1";
const JEAN_DARK = "#2a4f9e";
const JEAN_LIGHT = "#7fa6ef";
const RED = "#e5484d";
const RED_DARK = "#b8323a";
const YELLOW = "#f6c23e";
const YELLOW_DARK = "#d39a1c";
const WHITE = "#ffffff";

/** Đống quần áo rối tung, tay áo thắt nút vào nhau, rung rinh như sắp đổ. */
const ClothesPile: FC<PropProps> = ({ frame, seed }) => {
  const w0 = wobble(frame, seed, 52);
  const w1 = wobble(frame - 4, seed, 52);
  const w2 = wobble(frame - 8, seed, 52);
  const w3 = wobble(frame - 12, seed, 52);
  const r1 = 1.2 * w0;
  const r2 = 2.0 * w1;
  const r3 = 2.6 * w2;
  const r4 = 3.4 * w3;
  const squash = 1 - 0.025 * Math.abs(w0);
  const dangle = 6 * wobble(frame - 16, seed + 3, 40);
  const shake = clamp(Math.abs(w3), 0, 1);
  const f = (n: number) => n.toFixed(2);

  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-pile-shade" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={WHITE} stopOpacity={0.35} />
          <stop offset="0.55" stopColor={WHITE} stopOpacity={0} />
          <stop offset="1" stopColor={ink} stopOpacity={0.22} />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={76} />
      <g transform={`scale(1 ${f(squash)}) rotate(${f(r1)} 0 0)`}>
        {/* Quần jean dưới cùng */}
        <path
          d="M50 -14 L74 -18 L72 -40 L52 -36 Z"
          fill={JEAN_DARK}
          stroke={ink}
          strokeWidth={5}
          strokeLinejoin="round"
        />
        <path
          d="M-68 -6 Q-74 -40 -40 -52 Q0 -62 44 -50 Q72 -40 66 -6 Q0 2 -68 -6 Z"
          fill={JEAN}
          stroke={ink}
          strokeWidth={6}
          strokeLinejoin="round"
        />
        <path
          d="M-68 -6 Q-74 -40 -40 -52 Q0 -62 44 -50 Q72 -40 66 -6 Q0 2 -68 -6 Z"
          fill="url(#mk-gen-pile-shade)"
        />
        <path
          d="M-40 -14 Q-10 -24 30 -16"
          fill="none"
          stroke={JEAN_DARK}
          strokeWidth={3}
          strokeDasharray="6 5"
          strokeLinecap="round"
        />
        <ellipse cx={-42} cy={-38} rx={16} ry={6} fill={JEAN_LIGHT} opacity={0.6} />
        <circle cx={24} cy={-30} r={4} fill={YELLOW} stroke={ink} strokeWidth={2} />

        <g transform={`rotate(${f(r2)} 0 -46)`}>
          {/* Áo đỏ */}
          <path
            d="M-56 -46 Q-62 -88 -20 -96 Q30 -102 54 -82 Q64 -60 52 -46 Q0 -40 -56 -46 Z"
            fill={RED}
            stroke={ink}
            strokeWidth={6}
            strokeLinejoin="round"
          />
          <path
            d="M-56 -46 Q-62 -88 -20 -96 Q30 -102 54 -82 Q64 -60 52 -46 Q0 -40 -56 -46 Z"
            fill="url(#mk-gen-pile-shade)"
          />
          <path d="M30 -52 Q50 -60 52 -78" fill="none" stroke={RED_DARK} strokeWidth={4} strokeLinecap="round" opacity={0.7} />
          <ellipse cx={-34} cy={-82} rx={14} ry={5} fill={WHITE} opacity={0.35} />

          <g transform={`rotate(${f(r3)} 0 -92)`}>
            {/* Áo vàng */}
            <path
              d="M-40 -92 Q-46 -128 -6 -134 Q36 -138 42 -110 Q46 -96 36 -90 Q0 -86 -40 -92 Z"
              fill={YELLOW}
              stroke={ink}
              strokeWidth={6}
              strokeLinejoin="round"
            />
            <path
              d="M-40 -92 Q-46 -128 -6 -134 Q36 -138 42 -110 Q46 -96 36 -90 Q0 -86 -40 -92 Z"
              fill="url(#mk-gen-pile-shade)"
            />
            <path d="M-30 -112 Q0 -104 30 -112" fill="none" stroke={RED} strokeWidth={5} strokeLinecap="round" />
            <ellipse cx={-22} cy={-124} rx={11} ry={4} fill={WHITE} opacity={0.45} />

            <g transform={`rotate(${f(r4)} 0 -130)`}>
              {/* Mũ len xanh trên đỉnh */}
              <path
                d="M-20 -128 Q-22 -158 2 -162 Q24 -160 22 -130 Q0 -124 -20 -128 Z"
                fill={PALETTE.leaf}
                stroke={ink}
                strokeWidth={5}
                strokeLinejoin="round"
              />
              <path
                d="M-20 -128 Q-22 -158 2 -162 Q24 -160 22 -130 Q0 -124 -20 -128 Z"
                fill="url(#mk-gen-pile-shade)"
              />
              <rect x={-22} y={-138} width={46} height={10} rx={5} fill={PALETTE.paper} stroke={ink} strokeWidth={4} />
              <circle cx={2} cy={-166} r={8} fill={PALETTE.paper} stroke={ink} strokeWidth={4} />
              <circle cx={-1} cy={-169} r={2.5} fill={WHITE} opacity={0.8} />
              <ellipse cx={-10} cy={-150} rx={4} ry={6} fill={WHITE} opacity={0.35} />
            </g>
          </g>

          {/* Hai tay áo thắt nút vào nhau */}
          <path d="M-52 -60 Q-30 -54 -6 -76" fill="none" stroke={ink} strokeWidth={20} strokeLinecap="round" />
          <path d="M-52 -60 Q-30 -54 -6 -76" fill="none" stroke={RED} strokeWidth={12} strokeLinecap="round" />
          <path d="M40 -100 Q26 -80 6 -76" fill="none" stroke={ink} strokeWidth={20} strokeLinecap="round" />
          <path d="M40 -100 Q26 -80 6 -76" fill="none" stroke={YELLOW} strokeWidth={12} strokeLinecap="round" />
          <path
            d={`M-4 -72 Q${f(-10 + dangle * 0.5)} -62 ${f(-12 + dangle)} -52`}
            fill="none"
            stroke={ink}
            strokeWidth={16}
            strokeLinecap="round"
          />
          <path
            d={`M-4 -72 Q${f(-10 + dangle * 0.5)} -62 ${f(-12 + dangle)} -52`}
            fill="none"
            stroke={RED_DARK}
            strokeWidth={9}
            strokeLinecap="round"
          />
          <path
            d={`M6 -72 Q${f(12 + dangle * 0.6)} -62 ${f(14 + dangle)} -54`}
            fill="none"
            stroke={ink}
            strokeWidth={16}
            strokeLinecap="round"
          />
          <path
            d={`M6 -72 Q${f(12 + dangle * 0.6)} -62 ${f(14 + dangle)} -54`}
            fill="none"
            stroke={YELLOW_DARK}
            strokeWidth={9}
            strokeLinecap="round"
          />
          <ellipse cx={0} cy={-76} rx={13} ry={10} fill={RED} stroke={ink} strokeWidth={5} />
          <path d="M-8 -82 Q0 -76 8 -70" fill="none" stroke={YELLOW} strokeWidth={6} strokeLinecap="round" />
          <circle cx={-5} cy={-80} r={2.5} fill={WHITE} opacity={0.6} />
        </g>
      </g>

      {/* Vạch rung cho thấy sắp đổ */}
      <g opacity={0.3 + 0.6 * shake} stroke={ink} strokeWidth={4} strokeLinecap="round" fill="none">
        <path d="M-44 -150 Q-50 -140 -46 -130" />
        <path d="M-56 -140 Q-62 -128 -58 -118" />
        <path d="M46 -150 Q52 -140 48 -130" />
        <path d="M58 -140 Q64 -128 60 -118" />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 80,
  height: 180,
  Component: ClothesPile,
};
