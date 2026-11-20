import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

/** Laptop trên bàn nhỏ: màn hình sáng, ba chấm tải chạy lần lượt (người dùng thật, khách truy cập). */
const Laptop: FC<PropProps> = ({ frame }) => {
  const dot = Math.floor(frame / 8) % 3;
  return (
    <g>
      <ContactShadow halfWidth={80} />
      <rect
        x={-12}
        y={-150}
        width={24}
        height={150}
        fill={PALETTE.woodDark}
        stroke={ink}
        strokeWidth={5}
      />
      <rect
        x={-48}
        y={-12}
        width={96}
        height={12}
        rx={5}
        fill={PALETTE.woodDark}
        stroke={ink}
        strokeWidth={4}
      />
      <rect
        x={-80}
        y={-172}
        width={160}
        height={24}
        rx={6}
        fill={PALETTE.wood}
        stroke={ink}
        strokeWidth={6}
      />
      <path
        d="M -66 -172 L -54 -184 L 54 -184 L 66 -172 Z"
        fill={PALETTE.metal}
        stroke={ink}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <rect
        x={-56}
        y={-264}
        width={112}
        height={82}
        rx={8}
        fill={PALETTE.metalDark}
        stroke={ink}
        strokeWidth={6}
      />
      <rect x={-46} y={-254} width={92} height={62} rx={4} fill={PALETTE.screen} />
      {[0, 1, 2].map((k) => (
        <circle
          key={`d${k}`}
          cx={-18 + k * 18}
          cy={-223}
          r={6}
          fill={ink}
          opacity={k === dot ? 0.9 : 0.25}
        />
      ))}
    </g>
  );
};

export const propLaptop: PropAsset = {
  placement: "floor",
  halfWidth: 80,
  height: 264,
  Component: Laptop,
};
