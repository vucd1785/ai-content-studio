import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, clamp } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const CARD = "#C98A4B";
const CARD_LIGHT = "#E6B57F";
const CARD_DARK = "#93592B";
const TAPE = "#EBD6A2";

type BoxSpec = { x: number; y: number; w: number; h: number; label: boolean };

const drawBox = (b: BoxSpec) => {
  const { x, y, w, h, label } = b;
  const cx = x + w / 2;
  const lid = y + Math.min(16, h * 0.24);
  const tapeW = Math.max(14, w * 0.17);
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} fill="url(#mk-gen-carton-grad)" stroke={ink} strokeWidth={6} />
      <rect x={x + 4} y={y + 4} width={w * 0.14} height={h - 8} rx={3} fill={CARD_LIGHT} opacity={0.45} />
      <rect x={x + w * 0.8} y={y + 4} width={w * 0.2 - 4} height={h - 8} rx={3} fill={CARD_DARK} opacity={0.3} />
      <line x1={x + 3} y1={lid} x2={x + w - 3} y2={lid} stroke={ink} strokeWidth={4} strokeLinecap="round" />
      <rect x={x + 5} y={y + 4} width={w - 10} height={lid - y - 6} rx={2} fill={CARD_LIGHT} opacity={0.35} />
      <rect x={cx - tapeW / 2} y={y} width={tapeW} height={h * 0.55} fill={TAPE} opacity={0.9} stroke={ink} strokeWidth={3} />
      <rect x={cx - tapeW / 2 + 3} y={y + 3} width={tapeW * 0.28} height={h * 0.55 - 6} fill="#FFF6DC" opacity={0.7} />
      <path d={`M ${cx - tapeW / 2} ${y + h * 0.55} l ${tapeW / 4} -4 l ${tapeW / 4} 4 l ${tapeW / 4} -4 l ${tapeW / 4} 4`} fill="none" stroke={ink} strokeWidth={2.5} strokeLinejoin="round" />
      {label ? (
        <g>
          <rect x={x + 12} y={y + h - 34} width={w * 0.26} height={22} rx={3} fill={PALETTE.paper} stroke={ink} strokeWidth={3} />
          <line x1={x + 17} y1={y + h - 27} x2={x + 8 + w * 0.26} y2={y + h - 27} stroke={ink} strokeWidth={2.5} strokeLinecap="round" />
          <line x1={x + 17} y1={y + h - 19} x2={x + 2 + w * 0.2} y2={y + h - 19} stroke={ink} strokeWidth={2.5} strokeLinecap="round" />
        </g>
      ) : null}
      <path d={`M ${x + w - 16} ${y + h - 6} l 10 -10`} stroke={CARD_DARK} strokeWidth={3} strokeLinecap="round" />
    </g>
  );
};

/** Chồng thùng carton trong kho: thùng trên cùng nhấc lên rồi đặt xuống, nảy nhẹ và bẹp ra khi chạm. */
const CartonStack: FC<PropProps> = ({ frame, seed }) => {
  const period = 84;
  const p = (((frame + seed * 13) % period) + period) % period;
  let lift = 0;
  let squash = 0;
  if (p < 26) {
    const u = p / 26;
    lift = 12 * Math.sin(Math.PI * easing.inOut(u));
    squash = -0.04 * Math.sin(Math.PI * u);
  } else {
    const v = (p - 26) / 30;
    const k = clamp(v, 0, 1);
    squash = 0.09 * Math.exp(-4 * k) * Math.cos(k * Math.PI * 3) * (v <= 1 ? 1 : 0);
    lift = Math.max(0, 3 * Math.exp(-5 * k) * Math.sin(k * Math.PI * 3)) * (v <= 1 ? 1 : 0);
  }
  const sy = 1 - squash;
  const sx = 1 + squash * 0.7;
  const midSquash = Math.max(0, squash) * 0.25;
  const msy = 1 - midSquash;
  const midTop = -86 - 70 * msy;

  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-carton-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={CARD_LIGHT} />
          <stop offset="0.45" stopColor={CARD} />
          <stop offset="1" stopColor={CARD_DARK} />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={78} />
      {drawBox({ x: -72, y: -86, w: 144, h: 86, label: true })}
      <g transform={`translate(0 -86) scale(1 ${msy.toFixed(4)}) translate(0 86)`}>
        {drawBox({ x: -58, y: -156, w: 108, h: 70, label: true })}
      </g>
      <ellipse cx={-2} cy={midTop + 2} rx={34 - lift * 1.2} ry={4} fill={ink} opacity={0.18} />
      <g transform={`translate(-2 ${(midTop - lift).toFixed(2)}) scale(${sx.toFixed(4)} ${sy.toFixed(4)})`}>
        {drawBox({ x: -38, y: -54, w: 76, h: 54, label: false })}
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 80,
  height: 232,
  Component: CartonStack,
};
