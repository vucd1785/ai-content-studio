import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const PEOPLE = [
  { i: 0, x: -62, s: 0.82 },
  { i: 1, x: -20, s: 0.9 },
  { i: 2, x: 22, s: 0.86 },
  { i: 3, x: 62, s: 0.94 },
];

/** Hàng bốn người xám xếp hàng, nhún lệch nhịp (đám đông, khách giả chen chỗ). */
const QueueCrowd: FC<PropProps> = ({ frame, seed }) => (
  <g>
    <ContactShadow halfWidth={90} />
    {PEOPLE.map((p) => {
      const bob = Math.abs(wobble(frame, seed + p.i * 3, 16)) * 8;
      return (
        <g
          key={`p${p.i}`}
          transform={`translate(${p.x} ${(-bob).toFixed(2)}) scale(${p.s})`}
          opacity={0.92}
        >
          <line
            x1={-12}
            y1={0}
            x2={-8}
            y2={-74}
            stroke={PALETTE.metalDark}
            strokeWidth={12}
            strokeLinecap="round"
          />
          <line
            x1={12}
            y1={0}
            x2={8}
            y2={-74}
            stroke={PALETTE.metalDark}
            strokeWidth={12}
            strokeLinecap="round"
          />
          <rect
            x={-22}
            y={-170}
            width={44}
            height={104}
            rx={20}
            fill={PALETTE.metal}
            stroke={PALETTE.ink}
            strokeWidth={5}
          />
          <circle
            cx={0}
            cy={-200}
            r={30}
            fill={PALETTE.metal}
            stroke={PALETTE.ink}
            strokeWidth={5}
          />
        </g>
      );
    })}
  </g>
);

export const propQueueCrowd: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 230,
  Component: QueueCrowd,
};
