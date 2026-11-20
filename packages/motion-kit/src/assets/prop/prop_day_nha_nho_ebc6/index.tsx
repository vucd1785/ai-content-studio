import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { clamp, easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

type House = { x0: number; w: number; h: number; wall: string; roof: string };

const HOUSES: House[] = [
  { x0: -84, w: 40, h: 72, wall: "#F4A261", roof: "#C8553D" },
  { x0: -44, w: 44, h: 98, wall: "#7EC8E3", roof: "#3D5A80" },
  { x0: 0, w: 40, h: 62, wall: "#F6D365", roof: "#D1495B" },
  { x0: 40, w: 44, h: 88, wall: "#9BD17A", roof: "#5B8E3E" },
];

const CYCLE = 150;

/** Dãy nhà nhỏ nhiều màu, cửa sổ lần lượt bật đèn vàng ấm. */
const DayNhaNho: FC<PropProps> = ({ frame, seed }) => {
  const phase = (((frame + seed * 7) % CYCLE) + CYCLE) % CYCLE;
  const pulse = 0.85 + 0.15 * wobble(frame, seed, 24);
  const smokeT = ((frame % 60) + 60) % 60 / 60;
  const smokeX = 4 * wobble(frame, seed + 3, 50);

  let k = 0;
  const houses = HOUSES.map((hs, hi) => {
    const cx = hs.x0 + hs.w / 2;
    const rows: number[] = [];
    for (let y = -hs.h + 12; y <= -40; y += 24) rows.push(y);
    const windows = rows.flatMap((wy) =>
      [cx - 15, cx + 4].map((wx) => {
        const idx = k++;
        const on =
          clamp((phase - idx * 7) / 6, 0, 1) * clamp((140 - phase) / 8, 0, 1);
        const pop = easing.outBack(1.8)(on);
        return (
          <g key={`w${idx}`}>
            <circle
              cx={wx + 5.5}
              cy={wy + 6.5}
              r={4 + 9 * pop}
              fill="#FFD166"
              opacity={0.35 * on * pulse}
            />
            <rect x={wx} y={wy} width={11} height={13} rx={2} fill="#3B4A6B" stroke={ink} strokeWidth={3} />
            <rect x={wx + 1.5} y={wy + 1.5} width={8} height={10} rx={1} fill="#FFD166" opacity={on} />
            <rect x={wx + 2} y={wy + 2} width={3} height={4} rx={1} fill="#FFF6D6" opacity={on * 0.9} />
            <line x1={wx + 5.5} y1={wy} x2={wx + 5.5} y2={wy + 13} stroke={ink} strokeWidth={1.5} />
          </g>
        );
      }),
    );
    return (
      <g key={`h${hi}`}>
        <rect x={hs.x0} y={-hs.h} width={hs.w} height={hs.h} fill={hs.wall} stroke={ink} strokeWidth={5} strokeLinejoin="round" />
        <rect x={hs.x0 + 2.5} y={-hs.h + 2.5} width={hs.w - 5} height={hs.h - 5} fill="url(#mk-gen-dnn-wall)" />
        <rect x={hs.x0 + hs.w - 10} y={-hs.h + 3} width={7} height={hs.h - 6} fill={ink} opacity={0.12} />
        <polygon
          points={`${hs.x0 - 3},${-hs.h} ${cx},${-hs.h - 28} ${hs.x0 + hs.w + 3},${-hs.h}`}
          fill={hs.roof}
          stroke={ink}
          strokeWidth={5}
          strokeLinejoin="round"
        />
        <polygon
          points={`${hs.x0 + 4},${-hs.h - 3} ${cx},${-hs.h - 23} ${cx - 3},${-hs.h - 18} ${hs.x0 + 9},${-hs.h - 4}`}
          fill="#FFFFFF"
          opacity={0.3}
        />
        <rect x={cx + 4} y={-24} width={12} height={24} rx={3} fill={PALETTE.woodDark} stroke={ink} strokeWidth={3} />
        <circle cx={cx + 13} cy={-12} r={1.6} fill={PALETTE.warn} />
        <rect x={cx - 16} y={-20} width={13} height={9} rx={2} fill={PALETTE.leaf} stroke={ink} strokeWidth={2.5} />
        {windows}
      </g>
    );
  });

  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-dnn-wall" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity={0.28} />
          <stop offset="0.55" stopColor="#FFFFFF" stopOpacity={0} />
          <stop offset="1" stopColor="#000000" stopOpacity={0.14} />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={86} />
      <rect x={-34} y={-128} width={9} height={22} fill={PALETTE.woodDark} stroke={ink} strokeWidth={4} />
      <circle
        cx={-29.5 + smokeX}
        cy={-136 - 22 * smokeT}
        r={5 + 5 * smokeT}
        fill={PALETTE.smoke}
        opacity={0.7 * (1 - smokeT)}
      />
      <circle
        cx={-27 - smokeX * 0.6}
        cy={-134 - 10 * smokeT}
        r={4 + 3 * smokeT}
        fill={PALETTE.smoke}
        opacity={0.5 * (1 - smokeT)}
      />
      {houses}
      <line x1={-86} y1={0} x2={86} y2={0} stroke={ink} strokeWidth={5} strokeLinecap="round" />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 160,
  Component: DayNhaNho,
};
