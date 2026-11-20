import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const PERIOD = 34;

type ShoeProps = { frame: number; seed: number; phase: number; dark: boolean };

/** Nhịp nhún: nảy lên mềm, chạm đất thì bẹp nhẹ rồi bật lại. */
const bounce = (frame: number, phase: number) => {
  const p = (((frame + phase) % PERIOD) + PERIOD) % PERIOD / PERIOD;
  const lift = p < 0.6 ? Math.sin(easing.inOut(p / 0.6) * Math.PI) : 0;
  const land = p >= 0.6 ? Math.sin(((p - 0.6) / 0.4) * Math.PI) : 0;
  const hop = 6 * lift;
  const sx = 1 + 0.05 * land - 0.02 * lift;
  const sy = 1 - 0.07 * land + 0.04 * lift;
  return { hop, sx, sy, land };
};

const Shoe: FC<ShoeProps> = ({ frame, seed, phase, dark }) => {
  const { hop, sx, sy } = bounce(frame, phase);
  const laceSway = 8 * wobble(frame, seed + phase, 40);
  return (
    <g transform={`translate(0 ${(-hop).toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)})`}>
      {/* đế mòn vẹt, gót bị vát */}
      <path
        d="M -34 -12 L 36 -12 Q 42 -11 40 -5 Q 38 0 30 0 L -24 0 Q -32 -1 -36 -6 Z"
        fill="#E9E2D3"
        stroke={ink}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <path d="M -24 -1 L 30 -1 Q 37 -1 39 -5 L 38 -4 Q 34 -3 -22 -4 Z" fill="#B9AE98" opacity={0.8} />
      <path d="M -30 -8 L -18 -8 M -10 -7 L 2 -7 M 10 -7 L 20 -7" stroke="#B9AE98" strokeWidth={3} strokeLinecap="round" />
      {/* thân giày */}
      <path
        d="M -34 -12 L -35 -46 Q -33 -54 -22 -52 L -10 -47 Q 2 -42 12 -33 L 28 -25 Q 41 -20 39 -12 Z"
        fill="url(#mk-gen-shoe-upper)"
        stroke={ink}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* mũi giày sáng hơn */}
      <path d="M 14 -31 L 28 -25 Q 40 -20 38 -13 L 16 -13 Q 10 -22 14 -31 Z" fill="#9CC3EE" opacity={0.85} />
      {/* sọc bên hông */}
      <path d="M -28 -20 Q -10 -22 4 -34" stroke={PALETTE.paper} strokeWidth={5} strokeLinecap="round" fill="none" opacity={0.9} />
      {/* tab gót */}
      <path d="M -35 -46 Q -40 -40 -36 -30" stroke={ink} strokeWidth={5} strokeLinecap="round" fill="none" />
      <rect x={-33} y={-44} width={7} height={22} rx={3} fill={PALETTE.warn} stroke={ink} strokeWidth={3} />
      {/* cổ giày */}
      <path d="M -24 -51 Q -16 -44 -8 -46" stroke={ink} strokeWidth={4} strokeLinecap="round" fill="none" />
      {/* dây giày */}
      <path d="M -6 -44 L 0 -40 M -1 -41 L 5 -37 M 4 -38 L 10 -34" stroke={PALETTE.paper} strokeWidth={4} strokeLinecap="round" />
      <path
        d={`M -4 -45 Q ${(-10 + laceSway).toFixed(2)} -34 ${(-6 + laceSway * 1.4).toFixed(2)} -26`}
        stroke={PALETTE.paper}
        strokeWidth={3.5}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={`M -4 -45 Q ${(-10 + laceSway).toFixed(2)} -34 ${(-6 + laceSway * 1.4).toFixed(2)} -26`}
        stroke={ink}
        strokeWidth={1.2}
        strokeLinecap="round"
        fill="none"
        opacity={0.5}
      />
      {/* lỗ rách ở mũi */}
      <path d="M 24 -22 L 27 -26 L 30 -22 L 33 -25 L 34 -19 L 27 -17 Z" fill={ink} opacity={0.85} />
      {/* miếng vá */}
      <rect x={-22} y={-38} width={12} height={10} rx={2} fill={PALETTE.accent} stroke={ink} strokeWidth={2.5} transform="rotate(-10 -16 -33)" />
      <path d="M -21 -33 L -11 -35" stroke={ink} strokeWidth={1.5} strokeDasharray="2 2" />
      {/* vết sờn */}
      <path d="M -4 -18 L 2 -20 M 6 -16 L 11 -19" stroke={PALETTE.woodDark} strokeWidth={2} strokeLinecap="round" opacity={0.6} />
      {/* highlight từ trên trái */}
      <path d="M -30 -44 Q -28 -49 -22 -48" stroke={PALETTE.paper} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.6} />
      {dark ? (
        <path
          d="M -34 -12 L -35 -46 Q -33 -54 -22 -52 L -10 -47 Q 2 -42 12 -33 L 28 -25 Q 41 -20 39 -12 Z"
          fill={ink}
          opacity={0.18}
        />
      ) : null}
    </g>
  );
};

const Dust: FC<{ frame: number; phase: number; x: number }> = ({ frame, phase, x }) => {
  const { land } = bounce(frame, phase);
  const r = 3 + 4 * land;
  return (
    <g opacity={0.55 * land}>
      <circle cx={x - 6 - 6 * land} cy={-3 - 3 * land} r={r} fill={PALETTE.smoke} />
      <circle cx={x + 6 + 6 * land} cy={-2 - 2 * land} r={r * 0.8} fill={PALETTE.smoke} />
    </g>
  );
};

/** Đôi giày chạy bộ cũ, đế mòn và sờn rách, nhún lên xuống như vừa chạy xong. */
const OldRunningShoes: FC<PropProps> = ({ frame, seed }) => {
  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-shoe-upper" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7FB0E6" />
          <stop offset="0.55" stopColor="#4F86C6" />
          <stop offset="1" stopColor="#355F96" />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={80} />
      <g transform="translate(-36 0)">
        <Shoe frame={frame} seed={seed} phase={PERIOD / 2} dark={true} />
      </g>
      <Dust frame={frame} phase={PERIOD / 2} x={-36} />
      <g transform="translate(38 0)">
        <Shoe frame={frame} seed={seed + 3} phase={0} dark={false} />
      </g>
      <Dust frame={frame} phase={0} x={38} />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 86,
  height: 70,
  Component: OldRunningShoes,
};
