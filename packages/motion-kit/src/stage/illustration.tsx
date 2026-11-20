import type { FC, ReactNode } from "react";
import { getProp } from "../assets/index.js";
import { PALETTE } from "../palette.js";
import { clamp, easing } from "../rig/math.js";
import { FRAME_WIDTH, type FrameSize, isLandscape, VERTICAL_FRAME } from "./framing.js";
import type { PropAsset } from "./types.js";

/**
 * Minh họa khi giải thích (ADR-014 bổ sung 2026-11-11): chỉ hình, không chữ.
 * - `scene` (bổ sung 2026-11-12 (3)): đồ vật hiện thẳng trong khung cảnh, sau lưng nhân vật, ở vùng trời trên đầu,
 *   không khung viền; từng món hiện dần khi vào shot (shot cắt đúng từ khóa đang nói). Ví dụ cầu vồng mọc trên
 *   bầu trời mưa.
 * - `bubble`: kiểu cũ (bong bóng nghĩ). Director bỏ khung đám mây ngày 2026-11-12, nên giờ vẽ như `scene`.
 * - `board`: bảng trắng ở nửa trên khung, đồ vật hiện dần như đang được vẽ.
 * Vùng minh họa tính trong hệ màn hình 1080×1920 để không bị mép khung cắt; nằm trên đầu nhân vật và trên phụ đề.
 */
export type IllustrationStyle = "scene" | "bubble" | "board";

/** Kiểu vẽ thật sự: `bubble` cũ vẽ như `scene`. */
export const renderedIllustrationStyle = (style: IllustrationStyle): "scene" | "board" =>
  style === "board" ? "board" : "scene";

export type IllustrationProps = {
  style: IllustrationStyle;
  /** Id tài sản `prop`, tối đa 3. */
  items: readonly string[];
  frame: number;
  startFrame: number;
  /** Hoành độ màn hình của nhân vật nghĩ (bong bóng chỉ đuôi về đầu người này). */
  ownerX: number;
  /** Tung độ màn hình của đỉnh đầu nhân vật cao nhất trong khung. */
  headTopY: number;
  /** Khung hình; mặc định khung dọc 9:16. */
  frameSize?: FrameSize;
  /** Bề ngang trên màn hình của mọi nhân vật (khung ngang đặt minh họa sang bên còn trống). */
  actorsSpan?: { x0: number; x1: number };
  /** Kiểu bảng (ADR-029): bảng phấn ở lớp học, thẻ kem viền mực ở cảnh khác. */
  boardTheme?: BoardTheme;
};

/**
 * Kiểu khung của minh họa `board` (ADR-029): tấm trắng viền nâu cũ trông như cửa sổ dán đè, lạc phong cách.
 * `chalk`: bảng phấn xanh viền gỗ, hợp lớp học. `card`: thẻ màu kem viền mực, nghiêng nhẹ (Director bỏ băng dính màu nhấn 2026-11-20).
 */
export type BoardTheme = "chalk" | "card";

/** Kiểu bảng theo bối cảnh: lớp học (gốc hoặc tự tạo có "lop_hoc"/"classroom" trong id) dùng bảng phấn. */
export function boardThemeFor(backgroundId: string): BoardTheme {
  return /classroom|lop_hoc/.test(backgroundId) ? "chalk" : "card";
}

/** Vùng trên cùng dành cho minh họa; không vượt quá đỉnh đầu nhân vật trừ khoảng chừa. */
export const ILLUSTRATION_TOP = 150;
export const ILLUSTRATION_MAX_BOTTOM = 820;
const HEAD_GAP = 50;
const MIN_HEIGHT = 380;

/** Khung ngang (ADR-022): bề rộng tối thiểu và tối đa của vùng minh họa bên cạnh nhân vật. */
const SIDE_MIN_WIDTH = 360;
/** ADR-029: nhân vật dồn sang trái nên bên phải rộng gần nửa khung; minh họa được dùng gần hết phần đó. */
const SIDE_MAX_WIDTH = 940;
const SIDE_GAP = 40;

/**
 * Vùng minh họa của khung ngang: trên đầu nhân vật chỉ còn dải hẹp, nên hình đặt ở bên còn trống nhiều hơn,
 * từ trên xuống khoảng 62% chiều cao (trên phụ đề). Hai bên đều chật thì dùng dải trên cùng.
 */
function landscapeBox(frame: FrameSize, headTopY: number, span: { x0: number; x1: number }) {
  const left = span.x0 - 2 * SIDE_GAP;
  const right = frame.width - span.x1 - 2 * SIDE_GAP;
  const side = Math.max(left, right);
  if (side < SIDE_MIN_WIDTH) {
    return {
      x: 60,
      y: 30,
      width: frame.width - 120,
      height: Math.max(200, headTopY - 60),
    };
  }
  const width = Math.min(side, SIDE_MAX_WIDTH);
  const x = left >= right ? span.x0 - SIDE_GAP - width : span.x1 + SIDE_GAP;
  // Từ gần mép trên tới trên phụ đề (phụ đề ở khoảng 86% chiều cao khung).
  return { x, y: 50, width, height: Math.round(frame.height * 0.7) };
}

/** Khung chứa minh họa trong hệ màn hình; bảng và bong bóng dùng chung để storyboard kiểm được. */
export function illustrationBox(
  style: IllustrationStyle,
  ownerX: number,
  headTopY: number,
  frame: FrameSize = VERTICAL_FRAME,
  actorsSpan?: { x0: number; x1: number },
) {
  if (isLandscape(frame)) {
    return landscapeBox(frame, headTopY, actorsSpan ?? { x0: ownerX, x1: ownerX });
  }
  const bottom = clamp(headTopY - HEAD_GAP, ILLUSTRATION_TOP + MIN_HEIGHT, ILLUSTRATION_MAX_BOTTOM);
  if (style === "board") {
    return {
      x: 90,
      y: ILLUSTRATION_TOP,
      width: FRAME_WIDTH - 180,
      height: bottom - ILLUSTRATION_TOP,
    };
  }
  if (renderedIllustrationStyle(style) === "scene") {
    // Cả bề ngang bầu trời: một món (cầu vồng) được vẽ to như một phần của cảnh.
    return {
      x: 60,
      y: ILLUSTRATION_TOP - 30,
      width: FRAME_WIDTH - 120,
      height: bottom - ILLUSTRATION_TOP + 30,
    };
  }
  // Bong bóng để chừa chỗ cho chuỗi chấm dẫn xuống đầu.
  const width = 780;
  const height = bottom - ILLUSTRATION_TOP - 90;
  const cx = clamp(ownerX, width / 2 + 40, FRAME_WIDTH - width / 2 - 40);
  return { x: cx - width / 2, y: ILLUSTRATION_TOP, width, height };
}

const INK = "#2b2b3a";

export const Illustration: FC<IllustrationProps> = ({
  style,
  items,
  frame,
  startFrame,
  ownerX,
  headTopY,
  frameSize = VERTICAL_FRAME,
  actorsSpan,
  boardTheme = "card",
}) => {
  const local = Math.max(0, frame - startFrame);
  const box = illustrationBox(style, ownerX, headTopY, frameSize, actorsSpan);
  const shown = items.slice(0, 3);
  const appear = easing.outBack(1.4)(clamp(local / 8, 0, 1));
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  if (renderedIllustrationStyle(style) === "scene") {
    return <SceneItems items={shown} frame={frame} local={local} box={box} />;
  }
  const inner =
    style === "board"
      ? { x: box.x + 60, y: box.y + 60, width: box.width - 120, height: box.height - 130 }
      : {
          x: box.x + 90,
          y: box.y + 50,
          width: box.width - 180,
          height: box.height - 100,
        };
  const cell = inner.width / Math.max(1, shown.length);
  const itemNodes = shown.map((id, i) => {
    // Đồ vật cuối hiện xong ở frame 22, trước frame chụp storyboard (24).
    const start = 4 + i * 5;
    const p = clamp((local - start) / 8, 0, 1);
    const center = { x: inner.x + cell * (i + 0.5), y: inner.y + inner.height / 2 };
    const art = drawItem(getProp(id), id, frame, center, {
      width: cell * 0.9,
      height: inner.height,
    });
    if (style === "board") {
      // Hiện từ trái sang phải như nét bút đang vẽ.
      const clipId = `ill-clip-${i}`;
      return (
        // biome-ignore lint/suspicious/noArrayIndexKey: một món có thể lặp lại; thứ tự cố định theo kịch bản
        <g key={`${id}-${i}`}>
          <defs>
            <clipPath id={clipId}>
              <rect
                x={center.x - cell / 2}
                y={inner.y - 40}
                width={cell * easing.inOut(p)}
                height={inner.height + 80}
              />
            </clipPath>
          </defs>
          <g clipPath={`url(#${clipId})`} opacity={p > 0 ? 1 : 0}>
            {art}
          </g>
        </g>
      );
    }
    const s = easing.outBack(1.6)(p);
    return (
      <g
        // biome-ignore lint/suspicious/noArrayIndexKey: một món có thể lặp lại; thứ tự cố định theo kịch bản
        key={`${id}-${i}`}
        opacity={p > 0 ? 1 : 0}
        transform={`translate(${center.x} ${center.y}) scale(${s.toFixed(4)}) translate(${-center.x} ${-center.y})`}
      >
        {art}
      </g>
    );
  });

  if (style === "board") {
    const slide = (1 - clamp(local / 8, 0, 1)) * -60;
    if (boardTheme === "chalk") {
      // Bảng phấn: nền xanh đậm, viền gỗ, máng phấn, vệt phấn mờ cho cảm giác bảng thật.
      return (
        <g transform={`translate(0 ${slide.toFixed(2)})`} opacity={clamp(local / 6, 0, 1)}>
          <rect
            x={box.x - 18}
            y={box.y - 18}
            width={box.width + 36}
            height={box.height + 36}
            rx={20}
            fill={PALETTE.wood}
            stroke={PALETTE.ink}
            strokeWidth={6}
          />
          <rect x={box.x} y={box.y} width={box.width} height={box.height} rx={10} fill="#2f5d4a" />
          <path
            d={`M ${box.x + 30} ${box.y + 40} q ${box.width * 0.3} -14 ${box.width * 0.55} 6`}
            stroke="#ffffff"
            strokeOpacity={0.08}
            strokeWidth={26}
            fill="none"
            strokeLinecap="round"
          />
          <rect
            x={box.x + 30}
            y={box.y + box.height + 2}
            width={box.width - 60}
            height={14}
            rx={6}
            fill={PALETTE.woodDark}
          />
          <rect
            x={box.x + box.width * 0.7}
            y={box.y + box.height - 6}
            width={46}
            height={10}
            rx={4}
            fill="#f4efe6"
          />
          {itemNodes}
        </g>
      );
    }
    // Thẻ kem viền mực, nghiêng nhẹ, bóng đổ mềm: cùng nét vẽ với nhân vật. Không băng dính (Director 2026-11-20).
    const tilt = -1.6;
    const cxBox = box.x + box.width / 2;
    const cyBox = box.y + box.height / 2;
    return (
      <g
        transform={`translate(0 ${slide.toFixed(2)}) rotate(${tilt} ${cxBox} ${cyBox})`}
        opacity={clamp(local / 6, 0, 1)}
      >
        <rect
          x={box.x + 12}
          y={box.y + 16}
          width={box.width}
          height={box.height}
          rx={30}
          fill={PALETTE.outline}
          opacity={0.18}
        />
        <rect
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          rx={30}
          fill="#fff6e6"
          stroke={PALETTE.ink}
          strokeWidth={7}
        />
        {itemNodes}
      </g>
    );
  }

  const bottomY = box.y + box.height;
  const dots = [0, 1, 2].map((i) => {
    const k = (i + 1) / 4;
    const x = cx + (clamp(ownerX, 80, FRAME_WIDTH - 80) - cx) * k * 1.1;
    const y = bottomY + 26 + i * 30;
    const r = 22 - i * 6;
    const show = clamp((local - i * 2) / 4, 0, 1);
    return (
      <circle
        key={`dot-${i}`}
        cx={x}
        cy={y}
        r={r * show}
        fill="#fff"
        stroke={INK}
        strokeWidth={5}
      />
    );
  });
  return (
    <g>
      {dots.reverse()}
      <g
        transform={`translate(${cx} ${cy}) scale(${appear.toFixed(4)}) translate(${-cx} ${-cy})`}
        opacity={clamp(local / 4, 0, 1)}
      >
        <path d={cloudPath(box)} fill="#fff" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
        {itemNodes}
      </g>
    </g>
  );
};

/**
 * Minh họa `scene`: đồ vật trong khung cảnh, không viền. Mỗi món hiện dần (mờ sang rõ, nhô lên, phóng nhẹ) lệch
 * nhau 6 frame, xong trước frame chụp storyboard (24), rồi lơ lửng rất nhẹ để cảnh không đứng im.
 */
const SceneItems: FC<{
  items: readonly string[];
  frame: number;
  local: number;
  box: { x: number; y: number; width: number; height: number };
}> = ({ items, frame, local, box }) => {
  const cell = box.width / Math.max(1, items.length);
  return (
    <g>
      {items.map((id, i) => {
        const p = clamp((local - 2 - i * 6) / 10, 0, 1);
        const rise = (1 - easing.out(p)) * 40;
        const s = 0.85 + 0.15 * easing.outBack(1.4)(p);
        const bob = Math.sin((frame + i * 17) / 22) * 6;
        const center = { x: box.x + cell * (i + 0.5), y: box.y + box.height / 2 + rise + bob };
        return (
          <g
            // biome-ignore lint/suspicious/noArrayIndexKey: một món có thể lặp lại; thứ tự cố định theo kịch bản
            key={`${id}-${i}`}
            opacity={p}
            transform={`translate(${center.x} ${center.y}) scale(${s.toFixed(4)}) translate(${-center.x} ${-center.y})`}
          >
            {drawItem(getProp(id), id, frame, center, { width: cell * 0.95, height: box.height })}
          </g>
        );
      })}
    </g>
  );
};

/** Đồ vật thu vừa ô: `floor` đặt đáy ở dưới ô; `air` đứng yên ở giữa ô. */
function drawItem(
  asset: PropAsset,
  id: string,
  frame: number,
  center: { x: number; y: number },
  cell: { width: number; height: number },
): ReactNode {
  const seed = seedOf(id);
  if (asset.placement === "floor") {
    const s = Math.min((cell.height * 0.95) / asset.height, cell.width / (asset.halfWidth * 2));
    const Prop = asset.Component;
    return (
      <g
        transform={`translate(${center.x} ${center.y + (asset.height * s) / 2}) scale(${s.toFixed(4)})`}
      >
        <Prop frame={frame} t={0.5} seed={seed} />
      </g>
    );
  }
  const Prop = asset.Component;
  return (
    <Prop
      frame={frame}
      t={0.5}
      seed={seed}
      from={center}
      to={center}
      scale={Math.min(cell.width, cell.height) / 260}
    />
  );
}

function seedOf(id: string): number {
  let h = 7;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) % 9973;
  }
  return h;
}

/** Viền mây: các cung tròn quanh một hình chữ nhật bo góc. */
function cloudPath(box: { x: number; y: number; width: number; height: number }): string {
  const { x, y, width: w, height: h } = box;
  const bumpsX = 5;
  const bumpsY = 3;
  const rx = w / bumpsX / 2;
  const ry = h / bumpsY / 2;
  const parts: string[] = [`M ${x + rx} ${y + ry * 0.6}`];
  for (let i = 0; i < bumpsX; i++) {
    const x1 = x + rx + ((w - 2 * rx) * (i + 1)) / bumpsX;
    parts.push(`A ${rx} ${ry * 0.8} 0 0 1 ${x1.toFixed(1)} ${(y + ry * 0.6).toFixed(1)}`);
  }
  for (let i = 0; i < bumpsY; i++) {
    const y1 = y + ry * 0.6 + ((h - 1.2 * ry) * (i + 1)) / bumpsY;
    parts.push(`A ${rx * 0.8} ${ry} 0 0 1 ${(x + w - rx).toFixed(1)} ${y1.toFixed(1)}`);
  }
  for (let i = 0; i < bumpsX; i++) {
    const x1 = x + w - rx - ((w - 2 * rx) * (i + 1)) / bumpsX;
    parts.push(`A ${rx} ${ry * 0.8} 0 0 1 ${x1.toFixed(1)} ${(y + h - ry * 0.6).toFixed(1)}`);
  }
  for (let i = 0; i < bumpsY; i++) {
    const y1 = y + h - ry * 0.6 - ((h - 1.2 * ry) * (i + 1)) / bumpsY;
    parts.push(`A ${rx * 0.8} ${ry} 0 0 1 ${(x + rx).toFixed(1)} ${y1.toFixed(1)}`);
  }
  parts.push("Z");
  return parts.join(" ");
}
