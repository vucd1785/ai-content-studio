import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, rnd } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ServerRack } from "../prop_server/index.js";

const PUFF_PERIOD = 36;

/** Máy chủ quá tải: đèn đỏ chớp nhanh, tủ rung, khói bốc lên từ nóc. */
const ServerOverload: FC<PropProps> = ({ frame, seed }) => {
  const shake = Math.sin(frame * 1.9) * 3 + Math.sin(frame * 3.1 + seed) * 1.5;
  return (
    <g>
      {[0, 1, 2].map((k) => {
        const u = (frame + (k * PUFF_PERIOD) / 3) / PUFF_PERIOD;
        const p = u - Math.floor(u);
        const rise = easing.out(p);
        return (
          <circle
            key={`puff${k}`}
            cx={-30 + k * 30 + Math.sin(p * 6 + k) * 10}
            cy={-310 - rise * 130}
            r={14 + rise * 26}
            fill={PALETTE.smoke}
            opacity={0.55 * (1 - p)}
          />
        );
      })}
      <g transform={`translate(${shake.toFixed(2)} 0)`}>
        <ServerRack
          led={(i) => ({
            color: rnd(seed, i) > 0.25 ? PALETTE.alert : PALETTE.warn,
            on: (Math.floor(frame / 3) + i) % 2,
          })}
        />
      </g>
    </g>
  );
};

export const propServerOverload: PropAsset = {
  placement: "floor",
  halfWidth: 83,
  height: 300,
  Component: ServerOverload,
};
