import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, clamp, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

const W = 14;
const H = 48;
const GAP = 24;
const START_X = -66;
const LEAN = 35;
const PERIOD = 120;
const COLORS = [PALETTE.alert, PALETTE.warn, PALETTE.ok, PALETTE.shield, PALETTE.accent, PALETTE.leaf];

/** Hàng quân domino đổ dây chuyền: quân đầu ngã đẩy lần lượt các quân sau, chạm nhau lóe sáng, rồi dựng lại lặp vòng. */
const DominoChain: FC<PropProps> = ({ frame, seed }) => {
  const p = ((frame % PERIOD) + PERIOD) % PERIOD;
  const reset = easing.inOut(clamp((p - 96) / 18, 0, 1));
  const items = COLORS.map((color, i) => {
    const cx = START_X + i * GAP;
    const px = cx + W / 2;
    const start = 12 + i * 11;
    const fallT = clamp((p - start) / 9, 0, 1);
    const settle = clamp((p - start - 9) / 6, 0, 1);
    const bounce = fallT >= 1 ? Math.sin(settle * Math.PI) * 0.12 * (1 - settle) : 0;
    const fall = easing.in(fallT) - bounce;
    const pre = i === 0 ? Math.max(0, Math.sin(clamp((p - 2) / 10, 0, 1) * Math.PI)) * 4 : 0;
    const angle = LEAN * fall * (1 - reset) + pre;
    const sparkT = (p - start - 9) / 8;
    const spark = sparkT >= 0 && sparkT <= 1 && i < COLORS.length - 1 ? 1 - sparkT : 0;
    const rad = (LEAN * Math.PI) / 180;
    const sx = px + H * Math.sin(rad) - 2;
    const sy = -H * Math.cos(rad) + 4;
    return { color, cx, px, angle, spark, sparkT, sx, sy };
  });
  const breathe = 0.5 + 0.5 * wobble(frame, seed, 40);
  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-domino-shine" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity={0.5} />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity={0} />
          <stop offset="1" stopColor="#000000" stopOpacity={0.18} />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={86} />
      <path
        d="M -78 -66 Q -70 -76 -60 -70"
        fill="none"
        stroke={PALETTE.accent}
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.35 + 0.4 * breathe}
      />
      <path
        d="M -82 -56 Q -76 -62 -68 -58"
        fill="none"
        stroke={PALETTE.accent}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.25 + 0.35 * breathe}
      />
      {items
        .slice()
        .reverse()
        .map((d, k) => {
          const x = d.cx - W / 2;
          return (
            <g key={k} transform={`rotate(${d.angle.toFixed(2)} ${d.px} 0)`}>
              <rect x={x} y={-H} width={W} height={H} rx={4} fill={d.color} stroke={ink} strokeWidth={5} />
              <rect x={x + W - 6} y={-H + 4} width={4} height={H - 8} rx={2} fill={ink} opacity={0.22} />
              <rect x={x + 3} y={-H + 5} width={3} height={H - 14} rx={1.5} fill="#ffffff" opacity={0.5} />
              <rect x={x} y={-H} width={W} height={H} rx={4} fill="url(#mk-gen-domino-shine)" />
              <line x1={x + 3} y1={-H / 2} x2={x + W - 3} y2={-H / 2} stroke={ink} strokeWidth={2.5} strokeLinecap="round" />
              <circle cx={d.cx} cy={-H * 0.75} r={2.6} fill={PALETTE.paper} stroke={ink} strokeWidth={1.2} />
              <circle cx={d.cx - 3} cy={-H * 0.3} r={2.2} fill={PALETTE.paper} stroke={ink} strokeWidth={1.2} />
              <circle cx={d.cx + 3} cy={-H * 0.18} r={2.2} fill={PALETTE.paper} stroke={ink} strokeWidth={1.2} />
            </g>
          );
        })}
      {items.map((d, i) =>
        d.spark > 0 ? (
          <g key={`s${i}`} transform={`translate(${d.sx.toFixed(2)} ${d.sy.toFixed(2)}) scale(${(0.6 + 0.6 * d.sparkT).toFixed(3)})`} opacity={d.spark}>
            <circle cx={0} cy={0} r={9} fill={PALETTE.warn} opacity={0.35} />
            <path d="M 0 -12 L 2.5 -2.5 L 12 0 L 2.5 2.5 L 0 12 L -2.5 2.5 L -12 0 L -2.5 -2.5 Z" fill="#fff6c2" stroke={ink} strokeWidth={2} strokeLinejoin="round" />
          </g>
        ) : null,
      )}
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 88,
  height: 90,
  Component: DominoChain,
};
