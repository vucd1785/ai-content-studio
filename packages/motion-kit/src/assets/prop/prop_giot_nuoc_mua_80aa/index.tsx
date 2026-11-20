import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../../prop/prop_server/index.js";

const ink = PALETTE.ink;

const DROP_PATH =
  "M 0 -200 C 18 -165 60 -125 60 -72 A 60 60 0 0 1 -60 -72 C -60 -125 -18 -165 0 -200 Z";

/** Giọt nước mưa to tròn, xanh nhạt trong suốt, đốm sáng lấp lánh, rung nhẹ. */
const RainDrop: FC<PropProps> = ({ frame, seed }) => {
  const jiggle = Math.sin(frame * 0.35) * 0.03 + 0.01 * wobble(frame, seed, 30);
  const sx = 1 + jiggle;
  const sy = 1 - jiggle;
  const bob = -2 + 2 * Math.sin(frame * 0.12);
  const sway = 2 * wobble(frame, seed + 3, 60);
  const sparkle = 0.5 + 0.5 * Math.sin(frame * 0.25 + seed);
  const sparkle2 = 0.5 + 0.5 * Math.sin(frame * 0.25 + seed + 2.5);
  const starR = 7 + 4 * sparkle;
  return (
    <g>
      <ContactShadow halfWidth={58} />
      <g
        transform={`translate(0 ${(bob - 10).toFixed(2)}) rotate(${sway.toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(0 12)`}
      >
        <path d={DROP_PATH} fill="#bfe6fb" opacity={0.85} />
        <ellipse cx={8} cy={-50} rx={42} ry={26} fill="#8fd0f3" opacity={0.6} />
        <path
          d="M 30 -40 A 40 40 0 0 1 -10 -22"
          fill="none"
          stroke="#ffffff"
          strokeWidth={5}
          strokeLinecap="round"
          opacity={0.6}
        />
        <path d={DROP_PATH} fill="none" stroke={ink} strokeWidth={6} strokeLinejoin="round" />
        <ellipse
          cx={-26}
          cy={-100}
          rx={11}
          ry={22}
          transform="rotate(20 -26 -100)"
          fill="#ffffff"
          opacity={0.9}
        />
        <circle cx={-14} cy={-130} r={5} fill="#ffffff" opacity={0.85} />
        <g transform={`translate(22 -110)`} opacity={0.4 + 0.6 * sparkle}>
          <path
            d={`M 0 ${-starR} Q 2 -2 ${starR} 0 Q 2 2 0 ${starR} Q -2 2 ${-starR} 0 Q -2 -2 0 ${-starR} Z`}
            fill="#ffffff"
          />
        </g>
        <g transform={`translate(-34 -60)`} opacity={0.3 + 0.7 * sparkle2}>
          <path
            d="M 0 -6 Q 1.5 -1.5 6 0 Q 1.5 1.5 0 6 Q -1.5 1.5 -6 0 Q -1.5 -1.5 0 -6 Z"
            fill="#ffffff"
          />
        </g>
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 70,
  height: 215,
  Component: RainDrop,
};
