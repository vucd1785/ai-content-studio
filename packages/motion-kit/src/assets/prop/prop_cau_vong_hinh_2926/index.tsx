import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../../prop/prop_server/index.js";

const ink = PALETTE.ink;

const BANDS = ["#e8453c", "#f28c28", "#f7d038", "#5bbf4a", "#3d8fe0", "#3f4fb3", "#8a4fc4"];

const CX = 0;
const CY = -34;
const OUTER = 80;
const BAND = 9;
const INNER = OUTER - BAND * BANDS.length;

const arc = (r: number): string => `M ${CX - r} ${CY} A ${r} ${r} 0 0 1 ${CX + r} ${CY}`;

const Cloud: FC<{ x: number; y: number; bob: number }> = ({ x, y, bob }) => (
  <g transform={`translate(${x} ${(y + bob).toFixed(2)})`}>
    <path
      d="M -30 0 C -38 0 -38 -16 -26 -16 C -26 -30 -6 -32 -2 -20 C 4 -32 26 -30 24 -14 C 36 -14 36 0 28 0 Z"
      fill="#ffffff"
      stroke={ink}
      strokeWidth={5}
      strokeLinejoin="round"
    />
    <path
      d="M -18 -14 C -16 -20 -10 -22 -6 -18"
      fill="none"
      stroke="#dfe8f2"
      strokeWidth={4}
      strokeLinecap="round"
    />
  </g>
);

/** Cầu vồng bảy màu có mây trắng ở hai chân, sáng nhấp nháy nhẹ. */
const RainbowArc: FC<PropProps> = ({ frame, seed }) => {
  const glow = 0.5 + 0.5 * wobble(frame, seed, 40);
  const bobL = 2 * wobble(frame, seed + 3, 60);
  const bobR = 2 * wobble(frame, seed + 9, 60);
  const s1 = 0.5 + 0.5 * Math.sin(frame * 0.18);
  const s2 = 0.5 + 0.5 * Math.sin(frame * 0.18 + 2.1);
  const s3 = 0.5 + 0.5 * Math.sin(frame * 0.18 + 4.2);
  const mid = (OUTER + INNER) / 2;
  return (
    <g>
      <ContactShadow halfWidth={86} />
      <path d={arc(OUTER + 3)} fill="none" stroke={ink} strokeWidth={6} />
      {BANDS.map((c, i) => (
        <path
          key={c}
          d={arc(OUTER - BAND / 2 - BAND * i)}
          fill="none"
          stroke={c}
          strokeWidth={BAND + 0.6}
          opacity={0.82 + 0.18 * glow}
        />
      ))}
      <path d={arc(INNER - 3)} fill="none" stroke={ink} strokeWidth={6} />
      <path
        d={arc(OUTER - 6)}
        fill="none"
        stroke="#ffffff"
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray="30 200"
        opacity={0.25 + 0.4 * glow}
      />
      <g fill="#ffffff" stroke={ink} strokeWidth={2}>
        <path
          d="M 0 -128 L 3 -122 L 9 -119 L 3 -116 L 0 -110 L -3 -116 L -9 -119 L -3 -122 Z"
          opacity={s1}
        />
        <path
          d="M -62 -100 L -60 -96 L -56 -94 L -60 -92 L -62 -88 L -64 -92 L -68 -94 L -64 -96 Z"
          opacity={s2}
        />
        <path
          d="M 64 -104 L 66 -100 L 70 -98 L 66 -96 L 64 -92 L 62 -96 L 58 -98 L 62 -100 Z"
          opacity={s3}
        />
      </g>
      <Cloud x={-mid} y={-6} bob={bobL} />
      <Cloud x={mid} y={-6} bob={bobR} />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 135,
  Component: RainbowArc,
};
