import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const BLUE = "#3E8EDE";
const BLUE_LIGHT = "#8CC8F5";
const BLUE_DARK = "#24599A";
const YELLOW = "#FFD84A";
const YELLOW_PALE = "#FFF3B0";

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number): number => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};

/** Nhịp ngắn - dài: trả về độ sáng 0..1 mượt ở hai mép. */
const blinkLevel = (frame: number): number => {
  const p = ((frame % 72) + 72) % 72;
  const seg = (a: number, b: number): number => smooth((p - a) / 3) * smooth((b - p) / 3);
  return clamp01(seg(0, 10) + seg(20, 50));
};

/** Đèn pin xanh dựng đứng, chùm sáng vàng bật tắt theo nhịp ngắn dài. */
const FlashlightBlink: FC<PropProps> = ({ frame, seed }) => {
  const on = blinkLevel(frame);
  const prev = blinkLevel(frame - 3);
  const kick = Math.max(0, on - prev);
  const sway = 1.6 * wobble(frame, seed, 90);
  const squash = 1 - 0.04 * kick;
  const press = 3 * on;
  const flicker = 0.92 + 0.08 * wobble(frame, seed + 3, 9);
  const beam = on * flicker;
  const s1 = 0.5 + 0.5 * Math.sin(frame * 0.25);
  const s2 = 0.5 + 0.5 * Math.sin(frame * 0.25 + 2.1);
  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-flashlight-beam" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={YELLOW_PALE} stopOpacity={0.95} />
          <stop offset="0.6" stopColor={YELLOW} stopOpacity={0.55} />
          <stop offset="1" stopColor={YELLOW} stopOpacity={0} />
        </linearGradient>
        <linearGradient id="mk-gen-flashlight-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={BLUE_LIGHT} />
          <stop offset="0.45" stopColor={BLUE} />
          <stop offset="1" stopColor={BLUE_DARK} />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={50} />
      <g transform={`rotate(${sway.toFixed(2)}) scale(1 ${squash.toFixed(3)})`}>
        {/* chùm sáng */}
        <g opacity={beam}>
          <polygon points="-40,-202 40,-202 84,-316 -84,-316" fill="url(#mk-gen-flashlight-beam)" />
          <polygon points="-22,-202 22,-202 44,-300 -44,-300" fill={YELLOW_PALE} opacity={0.45} />
          <path
            d="M -30 -270 l 4 -9 l 4 9 l -4 9 z"
            fill="#FFFFFF"
            opacity={s1}
          />
          <path d="M 34 -248 l 3 -7 l 3 7 l -3 7 z" fill="#FFFFFF" opacity={s2} />
          <circle cx={6} cy={-290} r={3} fill="#FFFFFF" opacity={s2} />
        </g>
        {/* nắp đuôi */}
        <rect x={-30} y={-20} width={60} height={20} rx={7} fill={BLUE_DARK} stroke={ink} strokeWidth={5} />
        {/* thân */}
        <rect
          x={-25}
          y={-152}
          width={50}
          height={136}
          rx={12}
          fill="url(#mk-gen-flashlight-body)"
          stroke={ink}
          strokeWidth={6}
        />
        <rect x={-17} y={-142} width={8} height={116} rx={4} fill="#FFFFFF" opacity={0.35} />
        <rect x={10} y={-146} width={10} height={124} rx={5} fill={BLUE_DARK} opacity={0.35} />
        {/* vân cầm */}
        {[-60, -48, -36].map((y) => (
          <line key={y} x1={-22} y1={y} x2={22} y2={y} stroke={ink} strokeWidth={3} strokeLinecap="round" opacity={0.6} />
        ))}
        {/* nút bấm */}
        <rect
          x={-11}
          y={-118 + press}
          width={22}
          height={14 - press}
          rx={5}
          fill={PALETTE.metalDark}
          stroke={ink}
          strokeWidth={4}
        />
        {/* đầu đèn */}
        <path
          d="M -25 -150 L -44 -192 L 44 -192 L 25 -150 Z"
          fill={BLUE}
          stroke={ink}
          strokeWidth={6}
          strokeLinejoin="round"
        />
        <path d="M -20 -156 L -34 -186 L -22 -186 L -12 -156 Z" fill="#FFFFFF" opacity={0.3} />
        <path d="M 14 -156 L 30 -186 L 40 -186 L 22 -156 Z" fill={BLUE_DARK} opacity={0.4} />
        {/* vành kính */}
        <rect x={-48} y={-206} width={96} height={16} rx={6} fill={PALETTE.metalDark} stroke={ink} strokeWidth={5} />
        <rect x={-38} y={-204} width={76} height={8} rx={4} fill={YELLOW} opacity={0.25 + 0.75 * on} />
        <rect x={-30} y={-203} width={22} height={3} rx={1.5} fill="#FFFFFF" opacity={0.4 + 0.5 * on} />
        {/* quầng sáng ở kính */}
        <ellipse cx={0} cy={-206} rx={46} ry={10} fill={YELLOW_PALE} opacity={0.5 * beam} />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 320,
  Component: FlashlightBlink,
};
