import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const cupBase = "#8B5A3C";
const cupLight = "#B9835A";
const cupDark = "#5E3A24";
const coffee = "#3B2416";
const crema = "#C89B6D";
const saucer = "#F3E9DC";
const saucerShade = "#D8C7B2";

/** Cốc cà phê nâu có quai: hơi nóng lượn sóng bốc lên, cốc khẽ nảy trên đĩa. */
const CoffeeCup: FC<PropProps> = ({ frame, seed }) => {
  const cycle = 40;
  const p = ((frame + seed * 7) % cycle) / cycle;
  const wave = Math.sin(p * Math.PI * 2);
  const lift = Math.max(0, wave);
  const squash = Math.max(0, -wave);
  const hopY = 9 * easing.out(lift);
  const sx = 1 + squash * 0.06 - lift * 0.02;
  const sy = 1 - squash * 0.07 + lift * 0.04;
  const sway = 1.5 * wobble(frame, seed + 3, 80);

  const steam = [0, 1, 2].map((i) => {
    const ph = ((frame + i * 17 + seed * 5) % 60) / 60;
    const x0 = -20 + i * 20;
    const s = 9 * Math.sin(frame * 0.12 + i * 2.1);
    const rise = -14 * ph - hopY * 0.5;
    const op = 0.85 * Math.sin(Math.PI * ph);
    const d = `M ${x0} -142 C ${(x0 + s).toFixed(2)} -158 ${(x0 - s).toFixed(2)} -174 ${x0} -188 S ${(x0 + s).toFixed(2)} -204 ${(x0 - s * 0.5).toFixed(2)} -212`;
    return (
      <g key={i} transform={`translate(0 ${rise.toFixed(2)})`} opacity={op.toFixed(3)}>
        <path d={d} fill="none" stroke="#FFFFFF" strokeWidth={8} strokeLinecap="round" />
        <path d={d} fill="none" stroke={PALETTE.smoke} strokeWidth={3} strokeLinecap="round" opacity={0.6} />
      </g>
    );
  });

  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-coffee-cup-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={cupLight} />
          <stop offset="0.45" stopColor={cupBase} />
          <stop offset="1" stopColor={cupDark} />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={62} />
      {/* đĩa lót */}
      <ellipse cx={0} cy={-12} rx={62} ry={11} fill={saucerShade} stroke={ink} strokeWidth={5} />
      <ellipse cx={0} cy={-16} rx={48} ry={6} fill={saucer} />
      <ellipse cx={-24} cy={-17} rx={12} ry={2.5} fill="#FFFFFF" opacity={0.6} />

      {steam}

      <g transform={`translate(${sway.toFixed(2)} ${(-22 - hopY).toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(0 22)`}>
        {/* quai cốc */}
        <path d="M 38 -108 C 74 -112 74 -52 34 -56" fill="none" stroke={ink} strokeWidth={18} strokeLinecap="round" />
        <path d="M 38 -108 C 74 -112 74 -52 34 -56" fill="none" stroke={cupDark} strokeWidth={8} strokeLinecap="round" />
        {/* thân cốc */}
        <path
          d="M -44 -128 L 44 -128 L 38 -36 Q 36 -22 22 -22 L -22 -22 Q -36 -22 -38 -36 Z"
          fill="url(#mk-gen-coffee-cup-body)"
          stroke={ink}
          strokeWidth={6}
          strokeLinejoin="round"
        />
        {/* dải trang trí */}
        <path d="M -41 -84 L 41 -84 L 40 -70 L -40 -70 Z" fill={cupLight} opacity={0.75} />
        <circle cx={-14} cy={-77} r={3} fill={saucer} />
        <circle cx={0} cy={-77} r={3} fill={saucer} />
        <circle cx={14} cy={-77} r={3} fill={saucer} />
        {/* bóng sáng trái, bóng tối phải */}
        <path d="M -34 -118 L -30 -46" stroke="#FFFFFF" strokeWidth={7} strokeLinecap="round" opacity={0.35} />
        <circle cx={-31} cy={-38} r={3} fill="#FFFFFF" opacity={0.35} />
        <path d="M 30 -120 L 26 -36 Q 25 -28 18 -27 L 32 -28 Q 37 -34 38 -40 L 42 -120 Z" fill={ink} opacity={0.18} />
        {/* miệng cốc */}
        <ellipse cx={0} cy={-128} rx={44} ry={9} fill={cupLight} stroke={ink} strokeWidth={5} />
        <ellipse cx={0} cy={-127} rx={37} ry={6} fill={coffee} />
        <ellipse cx={-8} cy={-128} rx={16} ry={2.6} fill={crema} opacity={0.8} />
        <circle cx={14} cy={-127} r={2} fill={crema} opacity={0.7} />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 70,
  height: 232,
  Component: CoffeeCup,
};
