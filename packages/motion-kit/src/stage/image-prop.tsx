import type { FC } from "react";
import { PALETTE } from "../palette.js";
import type { PropAsset, PropProps } from "./types.js";

/**
 * Cạnh của ảnh trong khung (px hệ hình của đồ vật). Bề ngang giữ để khung đứng trên sàn không rộng hơn một chỗ đứng
 * (nửa bề ngang ≤ 83, `props.test`); trong minh họa khung được phóng vừa ô nên ảnh vẫn to.
 */
const IMAGE_MAX_W = 130;
const IMAGE_MAX_H = 200;
const PAD = 10;
/** Đáy khung, sát mặt đất (ADR-032: bỏ giá vẽ). */
const CARD_BOTTOM = -6;

/**
 * Ảnh thật trong video (ADR-030): ảnh Director tải lên, hoặc ảnh có giấy phép mở tìm trên Wikimedia Commons, dùng
 * cho thứ mà hình vẽ phẳng không thể hiện đúng (bản đồ thật, địa danh, loài vật, tác phẩm). Ảnh nhúng sẵn
 * (data URI) nên Remotion và storyboard vẽ như nhau. Kit đặt ảnh trong khung kem viền mực (ADR-032: không băng dính), đặt thẳng
 * trên mặt đất (ADR-032 bỏ giá vẽ), lắc rất nhẹ, để ảnh chụp không lạc giữa cảnh hoạt hình phẳng.
 */
export function imageProp(id: string, href: string, width: number, height: number): PropAsset {
  const scale = Math.min(IMAGE_MAX_W / width, IMAGE_MAX_H / height);
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const cardW = w + 2 * PAD;
  const cardH = h + 2 * PAD;
  const top = CARD_BOTTOM - cardH;
  const clipId = `mk-photo-${id}`;
  // biome-ignore lint/correctness/noComponentHookFactories: component không dùng hook, tạo một lần lúc nạp kho.
  const Photo: FC<PropProps> = ({ frame }) => {
    const sway = Math.sin(frame * 0.05) * 1.2;
    return (
      <g>
        <ellipse cx={0} cy={2} rx={cardW / 2 + 10} ry={10} fill={PALETTE.outline} opacity={0.16} />
        <g transform={`rotate(${sway.toFixed(3)} 0 ${CARD_BOTTOM})`}>
          <rect
            x={-cardW / 2 + 7}
            y={top + 9}
            width={cardW}
            height={cardH}
            rx={12}
            fill={PALETTE.outline}
            opacity={0.18}
          />
          <rect
            x={-cardW / 2}
            y={top}
            width={cardW}
            height={cardH}
            rx={12}
            fill="#fff6e6"
            stroke={PALETTE.ink}
            strokeWidth={6}
          />
          <defs>
            <clipPath id={clipId}>
              <rect x={-w / 2} y={top + PAD} width={w} height={h} rx={6} />
            </clipPath>
          </defs>
          <image
            href={href}
            x={-w / 2}
            y={top + PAD}
            width={w}
            height={h}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${clipId})`}
          />
          <rect
            x={-w / 2}
            y={top + PAD}
            width={w}
            height={h}
            rx={6}
            fill="none"
            stroke={PALETTE.ink}
            strokeWidth={3}
          />
        </g>
      </g>
    );
  };
  return {
    placement: "floor",
    // Bóng đổ lệch 7 px sang phải; chừa 8 px.
    halfWidth: Math.ceil(cardW / 2 + 8),
    height: -top + 16,
    Component: Photo,
  };
}
