import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const SHIELD =
  "M 0 -300 C 46 -276 72 -276 86 -270 C 88 -186 60 -128 0 -96 C -60 -128 -88 -186 -86 -270 C -72 -276 -46 -276 0 -300 Z";

/** Khiên bảo vệ trên giá: viền sáng phập phồng, dấu tích ở giữa (lớp lọc, chống tấn công). */
const Shield: FC<PropProps> = ({ frame, seed }) => {
  const pulse = 0.5 + 0.5 * wobble(frame, seed, 30);
  const glow = (1.1 + 0.06 * pulse).toFixed(3);
  return (
    <g>
      <ContactShadow halfWidth={70} />
      <rect
        x={-10}
        y={-110}
        width={20}
        height={110}
        fill={PALETTE.woodDark}
        stroke={ink}
        strokeWidth={5}
      />
      <rect
        x={-50}
        y={-12}
        width={100}
        height={12}
        rx={5}
        fill={PALETTE.woodDark}
        stroke={ink}
        strokeWidth={4}
      />
      <g transform={`translate(0 -198) scale(${glow}) translate(0 198)`}>
        <path
          d={SHIELD}
          fill="none"
          stroke={PALETTE.shieldLight}
          strokeWidth={10}
          opacity={0.3 + 0.4 * pulse}
        />
      </g>
      <path d={SHIELD} fill={PALETTE.shield} stroke={ink} strokeWidth={7} strokeLinejoin="round" />
      <path
        d="M 0 -280 C 34 -262 54 -262 66 -256 C 66 -190 44 -146 0 -120 Z"
        fill={PALETTE.shieldLight}
        opacity={0.45}
      />
      <path
        d="M -34 -200 L -8 -174 L 40 -230"
        fill="none"
        stroke={PALETTE.paper}
        strokeWidth={14}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
};

export const propShield: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 300,
  Component: Shield,
};
