import type { FC, ReactNode } from "react";
import { PALETTE } from "../palette.js";
import { clamp, easing, rnd } from "../rig/math.js";
import type { FrameSize } from "./framing.js";
import type { EffectKind } from "./types.js";

/**
 * Lớp hiệu ứng của shot (ADR-025): điểm nhấn ngắn ở khoảnh khắc quan trọng, vẽ trong hệ màn hình trên mọi lớp
 * của cảnh, dưới phụ đề. Mọi hiệu ứng là hàm thuần của frame; không có chữ.
 * - `flash`: chớp trắng đầu shot (phát hiện, chuyển cảnh mạnh);
 * - `impact`: vòng sóng và tia nổ ở người được lấy nét, kèm rung khung (va chạm, rơi, nổ);
 * - `speed_lines`: vệt tốc độ từ mép khung dồn về mặt nhân vật (bất ngờ, chạy nhanh);
 * - `sparkle`: lấp lánh quanh đầu nhân vật (đẹp, kỳ diệu, sạch sẽ);
 * - `idea`: bóng đèn sáng trên đầu (nảy ra ý tưởng);
 * - `confetti`: hoa giấy rơi khắp khung (ăn mừng, kết video);
 * - `question` (ADR-032): dấu hỏi nhỏ trên đầu nhân vật đang hỏi.
 */

/** Vị trí người được lấy nét trên màn hình. */
export type EffectAnchor = {
  /** Tâm đầu. */
  headX: number;
  headY: number;
  /** Đỉnh đầu. */
  headTopY: number;
  /** Giữa thân. */
  bodyY: number;
  /** Chiều cao nhân vật trên màn hình (px), để hiệu ứng to nhỏ theo cỡ cảnh. */
  height: number;
};

type FxProps = { local: number; frame: number; anchor: EffectAnchor; frameSize: FrameSize };

/** Số frame của hiệu ứng ngắn đầu shot. */
const FLASH_FRAMES = 10;
const IMPACT_FRAMES = 16;
/** Số frame rung khung của `impact`. */
export const SHAKE_FRAMES = 10;

const Flash: FC<FxProps> = ({ local, frameSize }) => {
  const o = 0.9 * (1 - clamp(local / FLASH_FRAMES, 0, 1));
  if (o <= 0) {
    return null;
  }
  return (
    <rect
      x={0}
      y={0}
      width={frameSize.width}
      height={frameSize.height}
      fill="#ffffff"
      opacity={o.toFixed(3)}
    />
  );
};

const Impact: FC<FxProps> = ({ local, anchor }) => {
  if (local >= IMPACT_FRAMES) {
    return null;
  }
  const t = easing.out(local / IMPACT_FRAMES);
  const r = anchor.height * (0.08 + 0.45 * t);
  const o = 1 - t;
  const spikes: ReactNode[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.3;
    const r0 = r * 0.7;
    const r1 = r * (1.15 + 0.25 * rnd(17, i));
    spikes.push(
      <line
        key={`s${i}`}
        x1={(anchor.headX + Math.cos(a) * r0).toFixed(1)}
        y1={(anchor.bodyY + Math.sin(a) * r0).toFixed(1)}
        x2={(anchor.headX + Math.cos(a) * r1).toFixed(1)}
        y2={(anchor.bodyY + Math.sin(a) * r1).toFixed(1)}
        stroke="#ffe066"
        strokeWidth={(anchor.height * 0.018).toFixed(1)}
        strokeLinecap="round"
      />,
    );
  }
  return (
    <g opacity={o.toFixed(3)}>
      <circle
        cx={anchor.headX}
        cy={anchor.bodyY}
        r={r.toFixed(1)}
        fill="none"
        stroke="#ffffff"
        strokeWidth={(anchor.height * 0.03 * (1 - t) + 2).toFixed(1)}
      />
      {spikes}
    </g>
  );
};

const SpeedLines: FC<FxProps> = ({ local, frame, anchor, frameSize }) => {
  const { width, height } = frameSize;
  const outer = Math.hypot(width, height);
  // Vệt đổi mỗi 2 frame như vẽ tay; hiện nhanh rồi giữ mờ.
  const step = Math.floor(frame / 2);
  const o = Math.min(1, local / 4) * (local < 30 ? 0.6 : 0.35);
  const lines: ReactNode[] = [];
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2 + rnd(step, i) * 0.1;
    const inner = anchor.height * (0.62 + 0.38 * rnd(step + 7, i));
    const w = 0.008 + 0.012 * rnd(step + 3, i);
    const x0 = anchor.headX + Math.cos(a) * inner;
    const y0 = anchor.headY + Math.sin(a) * inner;
    const xa = anchor.headX + Math.cos(a - w) * outer;
    const ya = anchor.headY + Math.sin(a - w) * outer;
    const xb = anchor.headX + Math.cos(a + w) * outer;
    const yb = anchor.headY + Math.sin(a + w) * outer;
    lines.push(
      <polygon
        key={`l${i}`}
        points={`${x0.toFixed(1)},${y0.toFixed(1)} ${xa.toFixed(1)},${ya.toFixed(1)} ${xb.toFixed(1)},${yb.toFixed(1)}`}
        fill={PALETTE.ink}
      />,
    );
  }
  return <g opacity={o.toFixed(3)}>{lines}</g>;
};

/** Ngôi sao bốn cánh lấp lánh. */
function star(key: string, x: number, y: number, r: number, color: string): ReactNode {
  const k = r * 0.28;
  return (
    <path
      key={key}
      d={`M ${x} ${y - r} Q ${x + k} ${y - k} ${x + r} ${y} Q ${x + k} ${y + k} ${x} ${y + r} Q ${x - k} ${y + k} ${x - r} ${y} Q ${x - k} ${y - k} ${x} ${y - r} Z`}
      fill={color}
    />
  );
}

const Sparkle: FC<FxProps> = ({ local, frame, anchor }) => {
  const stars: ReactNode[] = [];
  const spread = anchor.height * 0.42;
  for (let i = 0; i < 8; i++) {
    const phase = (frame + i * 7) / 14;
    const s = Math.max(0, Math.sin(phase * Math.PI));
    const appear = clamp((local - i * 2) / 6, 0, 1);
    const r = anchor.height * (0.025 + 0.025 * rnd(29, i)) * s * appear;
    if (r < 0.5) {
      continue;
    }
    const a = (i / 8) * Math.PI * 2 + 0.4;
    const d = spread * (0.75 + 0.35 * rnd(31, i));
    stars.push(
      star(
        `st${i}`,
        anchor.headX + Math.cos(a) * d,
        anchor.headY + Math.sin(a) * d * 0.8,
        r,
        i % 3 === 0 ? "#fff6c9" : "#ffffff",
      ),
    );
  }
  return <g>{stars}</g>;
};

const Idea: FC<FxProps> = ({ local, frame, anchor, frameSize }) => {
  const pop = easing.outBack(1.8)(clamp(local / 9, 0, 1));
  if (pop <= 0) {
    return null;
  }
  const r = anchor.height * 0.075;
  const x = anchor.headX;
  const y = Math.max(r * 2.2, anchor.headTopY - r * 2.1);
  if (y - r * 2 > frameSize.height) {
    return null;
  }
  const glow = 0.55 + 0.25 * Math.sin(frame / 5);
  const rays: ReactNode[] = [];
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + (i / 6) * Math.PI;
    rays.push(
      <line
        key={`r${i}`}
        x1={(x + Math.cos(a) * r * 1.45).toFixed(1)}
        y1={(y + Math.sin(a) * r * 1.45).toFixed(1)}
        x2={(x + Math.cos(a) * r * (1.85 + 0.15 * Math.sin(frame / 4 + i))).toFixed(1)}
        y2={(y + Math.sin(a) * r * (1.85 + 0.15 * Math.sin(frame / 4 + i))).toFixed(1)}
        stroke="#ffd43b"
        strokeWidth={(r * 0.16).toFixed(1)}
        strokeLinecap="round"
      />,
    );
  }
  return (
    <g
      transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${pop.toFixed(3)}) translate(${(-x).toFixed(1)} ${(-y).toFixed(1)})`}
    >
      <circle cx={x} cy={y} r={(r * 1.6).toFixed(1)} fill="#fff3a0" opacity={glow.toFixed(3)} />
      {rays}
      <circle
        cx={x}
        cy={y}
        r={r.toFixed(1)}
        fill="#ffe066"
        stroke={PALETTE.ink}
        strokeWidth={(r * 0.12).toFixed(1)}
      />
      <rect
        x={(x - r * 0.42).toFixed(1)}
        y={(y + r * 0.82).toFixed(1)}
        width={(r * 0.84).toFixed(1)}
        height={(r * 0.55).toFixed(1)}
        rx={(r * 0.12).toFixed(1)}
        fill={PALETTE.metal}
        stroke={PALETTE.ink}
        strokeWidth={(r * 0.1).toFixed(1)}
      />
      <circle
        cx={(x - r * 0.35).toFixed(1)}
        cy={(y - r * 0.35).toFixed(1)}
        r={(r * 0.22).toFixed(1)}
        fill="#ffffff"
        opacity={0.8}
      />
    </g>
  );
};

/**
 * ADR-032: dấu hỏi nhỏ trên đầu nhân vật đang hỏi, bật ra rồi nhún nhẹ suốt shot. Vẽ bằng nét (path), không dùng
 * chữ, nên không phạm luật "không chữ trên màn hình".
 */
const Question: FC<FxProps> = ({ local, frame, anchor, frameSize }) => {
  const pop = easing.outBack(1.8)(clamp(local / 8, 0, 1));
  if (pop <= 0) {
    return null;
  }
  const r = anchor.height * 0.07;
  const bob = Math.sin(frame / 7) * r * 0.12;
  const x = anchor.headX + r * 0.9;
  const y = Math.max(r * 1.6, anchor.headTopY - r * 1.5) + bob;
  if (y - r * 1.5 > frameSize.height) {
    return null;
  }
  const tilt = Math.sin(frame / 11) * 6;
  const hook = `M ${-0.42 * r} ${-0.5 * r} C ${-0.42 * r} ${-1.05 * r} ${0.46 * r} ${-1.05 * r} ${0.46 * r} ${-0.52 * r} C ${0.46 * r} ${-0.18 * r} 0 ${-0.12 * r} 0 ${0.22 * r}`;
  return (
    <g
      transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${tilt.toFixed(2)}) scale(${pop.toFixed(3)})`}
    >
      <path
        d={hook}
        fill="none"
        stroke={PALETTE.ink}
        strokeWidth={(r * 0.42).toFixed(1)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={0} cy={(0.62 * r).toFixed(1)} r={(r * 0.2).toFixed(1)} fill={PALETTE.ink} />
      <path
        d={hook}
        fill="none"
        stroke="#ffd43b"
        strokeWidth={(r * 0.24).toFixed(1)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={0} cy={(0.62 * r).toFixed(1)} r={(r * 0.11).toFixed(1)} fill="#ffd43b" />
    </g>
  );
};

const CONFETTI_COLORS = ["#f26b3a", "#ffd43b", "#4cd07d", "#4f81bd", "#e5484d", "#8fe9ff"];

const Confetti: FC<FxProps> = ({ local, frameSize }) => {
  const { width, height } = frameSize;
  const pieces: ReactNode[] = [];
  for (let i = 0; i < 48; i++) {
    const speed = height * (0.012 + 0.01 * rnd(41, i));
    const start = -height * (0.05 + 0.6 * rnd(43, i));
    const y = start + local * speed;
    if (y > height + 40) {
      continue;
    }
    const x = width * rnd(47, i) + Math.sin(local / 8 + i) * width * 0.03;
    const size = Math.min(width, height) * (0.022 + 0.016 * rnd(53, i));
    const spin = local * (6 + 10 * rnd(59, i)) + i * 37;
    const flip = Math.abs(Math.cos(local / 6 + i));
    pieces.push(
      <rect
        key={`c${i}`}
        x={(-size / 2).toFixed(1)}
        y={(-size * 0.3).toFixed(1)}
        width={size.toFixed(1)}
        height={(size * 0.6 * (0.3 + 0.7 * flip)).toFixed(1)}
        fill={CONFETTI_COLORS[i % CONFETTI_COLORS.length]}
        transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(spin % 360).toFixed(1)})`}
      />,
    );
  }
  return <g>{pieces}</g>;
};

const EFFECTS: Record<EffectKind, FC<FxProps>> = {
  flash: Flash,
  impact: Impact,
  speed_lines: SpeedLines,
  sparkle: Sparkle,
  idea: Idea,
  confetti: Confetti,
  question: Question,
};

/** Thứ tự vẽ: hiệu ứng nền (vệt tốc độ) trước, chớp trắng sau cùng. */
const ORDER: readonly EffectKind[] = [
  "speed_lines",
  "confetti",
  "sparkle",
  "impact",
  "idea",
  "question",
  "flash",
];

export const Effects: FC<{
  kinds: readonly EffectKind[];
  frame: number;
  startFrame: number;
  anchor: EffectAnchor;
  frameSize: FrameSize;
}> = ({ kinds, frame, startFrame, anchor, frameSize }) => {
  const local = Math.max(0, frame - startFrame);
  return (
    <g>
      {ORDER.filter((k) => kinds.includes(k)).map((k) => {
        const Fx = EFFECTS[k];
        return <Fx key={k} local={local} frame={frame} anchor={anchor} frameSize={frameSize} />;
      })}
    </g>
  );
};

/** Độ lệch rung khung của `impact` (px màn hình) ở frame `local` của shot; hết rung thì 0. */
export function impactShake(local: number, frameSize: FrameSize): { dx: number; dy: number } {
  if (local < 0 || local >= SHAKE_FRAMES) {
    return { dx: 0, dy: 0 };
  }
  const amp = Math.min(frameSize.width, frameSize.height) * 0.018 * (1 - local / SHAKE_FRAMES);
  return { dx: amp * (rnd(61, local) * 2 - 1), dy: amp * (rnd(67, local) * 2 - 1) };
}
