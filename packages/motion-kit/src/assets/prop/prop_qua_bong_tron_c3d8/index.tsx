import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const PERIOD = 64;

/** Tính độ nảy và độ nén cho một quả bóng; quả nào đang có lượt thì nảy lên, quả kia đứng yên. */
const bounceState = (frame: number, offset: number) => {
  const raw = (((frame + offset) % PERIOD) + PERIOD) % PERIOD;
  const half = PERIOD / 2;
  const active = raw < half;
  const p = (active ? raw : raw - half) / half;
  const edge = 0.1 * Math.max(0, 1 - p * 5) + 0.1 * Math.max(0, 1 - (1 - p) * 5);
  if (active) {
    const arc = Math.sin(Math.PI * p);
    return { hop: 28 * arc, k: edge - 0.07 * arc, tilt: 8 * Math.sin(Math.PI * 2 * p) };
  }
  return { hop: 0, k: edge * 0.6, tilt: 0 };
};

/** Quả bóng tròn và quả bóng bầu dục đặt cạnh nhau, nảy lần lượt. */
const RoundAndOvalBalls: FC<PropProps> = ({ frame }) => {
  const a = bounceState(frame, 0);
  const b = bounceState(frame, PERIOD / 2);
  const shA = 1 - a.hop / 50;
  const shB = 1 - b.hop / 50;
  return (
    <g>
      <defs>
        <radialGradient id="mk-gen-round-ball" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#FF8A7A" />
          <stop offset="0.55" stopColor={PALETTE.alert} />
          <stop offset="1" stopColor="#A8282A" />
        </radialGradient>
        <radialGradient id="mk-gen-oval-ball" cx="0.35" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#D99A5E" />
          <stop offset="0.55" stopColor="#A9622E" />
          <stop offset="1" stopColor="#6E3B19" />
        </radialGradient>
      </defs>
      <ContactShadow halfWidth={84} />
      {/* bóng đổ riêng từng quả */}
      <ellipse cx={-38} cy={0} rx={26 * shA} ry={5 * shA} fill={ink} opacity={0.22 * shA} />
      <ellipse cx={44} cy={0} rx={32 * shB} ry={5 * shB} fill={ink} opacity={0.22 * shB} />

      {/* Quả bóng tròn */}
      <g
        transform={`translate(-38 ${(-a.hop).toFixed(2)}) scale(${(1 + a.k).toFixed(3)} ${(1 - a.k).toFixed(3)})`}
      >
        <g transform={`rotate(${a.tilt.toFixed(2)} 0 -30)`}>
          <circle cx={0} cy={-30} r={29} fill="url(#mk-gen-round-ball)" stroke={ink} strokeWidth={6} />
          <path
            d="M -27 -40 Q 0 -30 27 -40 L 28 -26 Q 0 -16 -28 -26 Z"
            fill="#FFFFFF"
            opacity={0.92}
          />
          <path d="M -27 -40 Q 0 -30 27 -40" fill="none" stroke={ink} strokeWidth={3} />
          <path d="M -28 -26 Q 0 -16 28 -26" fill="none" stroke={ink} strokeWidth={3} />
          <circle cx={0} cy={-56} r={4} fill={PALETTE.warn} stroke={ink} strokeWidth={2} />
          <path d="M 10 -6 A 26 26 0 0 0 26 -22" fill="none" stroke="#7A1A1C" strokeWidth={5} opacity={0.35} strokeLinecap="round" />
          <ellipse cx={-12} cy={-45} rx={8} ry={5} fill="#FFFFFF" opacity={0.75} transform="rotate(-35 -12 -45)" />
          <circle cx={-3} cy={-51} r={2.5} fill="#FFFFFF" opacity={0.8} />
        </g>
      </g>

      {/* Quả bóng bầu dục */}
      <g
        transform={`translate(44 ${(-b.hop).toFixed(2)}) scale(${(1 + b.k).toFixed(3)} ${(1 - b.k).toFixed(3)})`}
      >
        <g transform={`rotate(${(-6 + b.tilt).toFixed(2)} 0 -23)`}>
          <ellipse cx={0} cy={-23} rx={37} ry={22} fill="url(#mk-gen-oval-ball)" stroke={ink} strokeWidth={6} />
          <path d="M -30 -23 Q 0 -5 30 -23" fill="none" stroke="#6E3B19" strokeWidth={4} opacity={0.45} />
          <path d="M -26 -30 Q -32 -23 -26 -16" fill="none" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" />
          <path d="M 26 -30 Q 32 -23 26 -16" fill="none" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" />
          <line x1={-14} y1={-34} x2={14} y2={-34} stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" />
          <line x1={-9} y1={-39} x2={-9} y2={-29} stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" />
          <line x1={-3} y1={-39} x2={-3} y2={-29} stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" />
          <line x1={3} y1={-39} x2={3} y2={-29} stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" />
          <line x1={9} y1={-39} x2={9} y2={-29} stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" />
          <ellipse cx={-18} cy={-35} rx={9} ry={4} fill="#FFFFFF" opacity={0.55} transform="rotate(-18 -18 -35)" />
          <circle cx={-27} cy={-31} r={2.5} fill="#FFFFFF" opacity={0.7} />
        </g>
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 130,
  Component: RoundAndOvalBalls,
};
