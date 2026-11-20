import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { rnd } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";

const ink = PALETTE.ink;
const W = 150;
const H = 300;
const UNITS = [0, 1, 2, 3];

/** Bóng tiếp xúc dưới chân đồ vật đứng trên sàn. */
export const ContactShadow: FC<{ halfWidth: number }> = ({ halfWidth }) => (
  <ellipse cx={0} cy={2} rx={halfWidth} ry={12} fill={PALETTE.outline} opacity={0.18} />
);

/**
 * Tủ máy chủ dùng chung cho `prop_server` và `prop_server_overload`: 4 ngăn, mỗi ngăn 3 đèn.
 * `led(i)` trả màu và độ sáng (0..1) của đèn thứ `i`.
 */
export const ServerRack: FC<{ led: (i: number) => { color: string; on: number } }> = ({ led }) => (
  <g>
    <ContactShadow halfWidth={W / 2 + 8} />
    <rect
      x={-W / 2}
      y={-H}
      width={W}
      height={H}
      rx={14}
      fill={PALETTE.metalDark}
      stroke={ink}
      strokeWidth={7}
    />
    {UNITS.map((u) => {
      const y = -H + 22 + u * 68;
      return (
        <g key={`u${u}`}>
          <rect
            x={-W / 2 + 16}
            y={y}
            width={W - 32}
            height={52}
            rx={8}
            fill={PALETTE.metal}
            stroke={ink}
            strokeWidth={4}
          />
          <line
            x1={-W / 2 + 30}
            y1={y + 26}
            x2={8}
            y2={y + 26}
            stroke={ink}
            strokeWidth={4}
            strokeLinecap="round"
            opacity={0.5}
          />
          {[0, 1, 2].map((k) => {
            const l = led(u * 3 + k);
            return (
              <circle
                key={`l${k}`}
                cx={24 + k * 16}
                cy={y + 26}
                r={6}
                fill={l.color}
                opacity={0.25 + 0.75 * l.on}
              />
            );
          })}
        </g>
      );
    })}
    <rect x={-W / 2 + 10} y={-8} width={24} height={10} rx={3} fill={ink} />
    <rect x={W / 2 - 34} y={-8} width={24} height={10} rx={3} fill={ink} />
  </g>
);

/** Máy chủ chạy bình thường: đèn xanh nhấp nháy chậm, không đều. */
const Server: FC<PropProps> = ({ frame, seed }) => (
  <ServerRack
    led={(i) => ({
      color: PALETTE.ok,
      on: rnd(seed + i, Math.floor(frame / 9) + i) > 0.35 ? 1 : 0,
    })}
  />
);

export const propServer: PropAsset = {
  placement: "floor",
  halfWidth: W / 2 + 8,
  height: H,
  Component: Server,
};
