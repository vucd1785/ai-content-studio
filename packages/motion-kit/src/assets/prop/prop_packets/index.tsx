import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, lerp, rnd } from "../../../rig/math.js";
import type { AirPropProps, PropAsset } from "../../../stage/types.js";

const COUNT = 9;
/** Chỉ số từng gói tin; key React lấy từ giá trị, không từ vị trí trong mảng. */
const PACKETS = Array.from({ length: COUNT }, (_, i) => i);
const PERIOD = 40;

/**
 * Dòng gói tin (phong bì nhỏ) bay liên tục từ `from` tới `to`, mỗi gói một làn cao thấp khác nhau, mờ ở
 * hai đầu đường bay (yêu cầu dồn dập vào máy chủ, dữ liệu truyền đi). Gói giữ độ cao xuất phát gần hết
 * đường rồi mới lao xuống đích, để không bay ngang mặt nhân vật đứng giữa đường.
 */
const Packets: FC<AirPropProps> = ({ frame, seed, from, to, scale }) => (
  <g>
    {PACKETS.map((i) => {
      const raw = frame / PERIOD + i / COUNT + rnd(seed, i) * 0.05;
      const u = raw - Math.floor(raw);
      const lane = (rnd(seed, i + 20) - 0.5) * 140;
      const x = lerp(from.x, to.x, u);
      const y = lerp(from.y + lane * 0.5, to.y + lane * 0.2, easing.in(u));
      const fade = Math.min(1, u * 6, (1 - u) * 6);
      const s = scale * (0.8 + rnd(seed, i + 40) * 0.4);
      const tilt = (to.x >= from.x ? 1 : -1) * (rnd(seed, i + 60) - 0.5) * 30;
      return (
        <g
          key={`pk${i}`}
          transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${tilt.toFixed(1)}) scale(${s.toFixed(3)})`}
          opacity={fade}
        >
          <rect
            x={-22}
            y={-15}
            width={44}
            height={30}
            rx={4}
            fill={PALETTE.paper}
            stroke={PALETTE.ink}
            strokeWidth={4}
          />
          <path
            d="M -20 -13 L 0 3 L 20 -13"
            fill="none"
            stroke={PALETTE.ink}
            strokeWidth={3.5}
            strokeLinejoin="round"
          />
          <circle cx={14} cy={8} r={4} fill={PALETTE.accent} />
        </g>
      );
    })}
  </g>
);

export const propPackets: PropAsset = { placement: "air", Component: Packets };
