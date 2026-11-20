import type { FC } from "react";
import { PALETTE } from "../palette.js";
import type { PropAsset, PropProps } from "./types.js";

/** Cờ 4:3 cắm trên cột (px hệ hình của đồ vật). */
const FLAG_W = 150;
const FLAG_H = 112;
const POLE_X = -72;
const POLE_TOP = -300;
/** Số dải dọc để cờ gợn sóng; nhiều hơn thì mượt hơn nhưng vẽ nhiều ảnh hơn mỗi frame. */
const STRIPS = 8;

/**
 * Cờ quốc gia từ nguồn có sẵn (ADR-029): hình cờ là SVG gốc của bộ `flag-icons` (MIT), không do AI vẽ, để đúng
 * từng chi tiết. Kit chỉ thêm cột cờ và chuyển động bay: cờ chia dải dọc, mỗi dải lệch theo một sóng sin, kèm
 * bóng nếp vải trượt ngang. Mọi thứ là hàm thuần của frame.
 */
export function flagProp(code: string, svg: string): PropAsset {
  const href = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  // Hàm thuần của frame, không hook: mỗi cờ là một component riêng giữ sẵn data URI của hình gốc.
  // biome-ignore lint/correctness/noComponentHookFactories: component không dùng hook, tạo một lần lúc nạp kho.
  const Flag: FC<PropProps> = ({ frame }) => {
    const x0 = POLE_X + 6;
    const y0 = POLE_TOP + 8;
    const sw = FLAG_W / STRIPS;
    const wave = (i: number) => Math.sin(frame * 0.16 - i * 0.75) * (2 + i * 1.3);
    const shadeX = ((frame * 3) % (FLAG_W * 2)) - FLAG_W;
    return (
      <g>
        <ellipse cx={POLE_X} cy={2} rx={34} ry={9} fill={PALETTE.outline} opacity={0.18} />
        <rect
          x={POLE_X - 5}
          y={POLE_TOP}
          width={10}
          height={-POLE_TOP}
          rx={5}
          fill={PALETTE.metal}
          stroke={PALETTE.ink}
          strokeWidth={4}
        />
        <circle
          cx={POLE_X}
          cy={POLE_TOP - 6}
          r={10}
          fill={PALETTE.warn}
          stroke={PALETTE.ink}
          strokeWidth={4}
        />
        <defs>
          {Array.from({ length: STRIPS }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: số dải cố định, chỉ số là định danh của dải.
            <clipPath key={`c${i}`} id={`mk-flag-${code}-${i}`}>
              <rect x={x0 + i * sw - 0.5} y={y0 - 30} width={sw + 1} height={FLAG_H + 60} />
            </clipPath>
          ))}
          <linearGradient id={`mk-flag-shade-${code}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#000" stopOpacity={0} />
            <stop offset="0.5" stopColor="#000" stopOpacity={0.16} />
            <stop offset="1" stopColor="#fff" stopOpacity={0.12} />
          </linearGradient>
        </defs>
        {Array.from({ length: STRIPS }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: số dải cố định, chỉ số là định danh của dải.
          <g key={`s${i}`} clipPath={`url(#mk-flag-${code}-${i})`}>
            <g transform={`translate(0 ${wave(i).toFixed(2)})`}>
              <image
                href={href}
                x={x0}
                y={y0}
                width={FLAG_W}
                height={FLAG_H}
                preserveAspectRatio="none"
              />
              <rect
                x={x0 + shadeX}
                y={y0}
                width={FLAG_W}
                height={FLAG_H}
                fill={`url(#mk-flag-shade-${code})`}
              />
              <rect
                x={x0}
                y={y0}
                width={FLAG_W}
                height={FLAG_H}
                fill="none"
                stroke={PALETTE.ink}
                strokeWidth={4}
              />
            </g>
          </g>
        ))}
      </g>
    );
  };
  return { placement: "floor", halfWidth: 90, height: 310, Component: Flag };
}
