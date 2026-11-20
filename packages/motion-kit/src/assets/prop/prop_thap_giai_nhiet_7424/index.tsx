import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

/** Tháp giải nhiệt: quạt trên nóc quay chậm, hơi nước trắng bốc lên nghi ngút. */
const CoolingTower: FC<PropProps> = ({ frame, seed }) => {
  const angle = frame * 4;
  const glow = 0.5 + 0.5 * wobble(frame, seed + 3, 24);
  const puffs = [0, 1, 2, 3, 4].map((i) => {
    const raw = (frame * 0.9 + i * 22) % 110;
    const p = raw / 110;
    const rise = easing.out(p);
    const y = -212 - rise * 80;
    const x = (i - 2) * 12 + wobble(frame, seed + i * 11, 60) * 8 + p * 6;
    const r = 10 + 14 * easing.out(p);
    const op = p < 0.15 ? p / 0.15 : 1 - easing.inOut((p - 0.15) / 0.85);
    return { x, y, r, op: op * 0.95, i };
  });
  const bladeAngles = [0, 72, 144, 216, 288];
  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-tower-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d9dee6" />
          <stop offset="0.45" stopColor={PALETTE.metal} />
          <stop offset="1" stopColor={PALETTE.metalDark} />
        </linearGradient>
        <radialGradient id="mk-gen-tower-steam" cx="0.35" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dfe7ef" />
        </radialGradient>
      </defs>
      <ContactShadow halfWidth={78} />
      {/* base */}
      <rect x={-76} y={-18} width={152} height={18} rx={4} fill={PALETTE.metalDark} stroke={ink} strokeWidth={5} />
      {/* body */}
      <path
        d="M -70 -16 C -50 -90, -46 -140, -54 -192 L 54 -192 C 46 -140, 50 -90, 70 -16 Z"
        fill="url(#mk-gen-tower-body)"
        stroke={ink}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* highlight + shade layers */}
      <path d="M -60 -22 C -42 -90, -38 -140, -44 -186 L -32 -186 C -28 -140, -30 -90, -44 -22 Z" fill="#ffffff" opacity={0.35} />
      <path d="M 64 -22 C 46 -90, 42 -140, 48 -186 L 34 -186 C 32 -140, 34 -90, 46 -22 Z" fill={ink} opacity={0.15} />
      {/* louvers */}
      {[-30, -42, -54].map((y) => (
        <line key={y} x1={-56 + (y + 30) * -0.3} y1={y} x2={56 - (y + 30) * -0.3} y2={y} stroke={ink} strokeWidth={4} strokeLinecap="round" opacity={0.7} />
      ))}
      {/* bands */}
      <path d="M -50 -110 Q 0 -104 50 -110" fill="none" stroke={ink} strokeWidth={4} />
      <path d="M -49 -158 Q 0 -152 49 -158" fill="none" stroke={ink} strokeWidth={4} />
      {/* rivets */}
      {[-36, -12, 12, 36].map((x) => (
        <circle key={x} cx={x} cy={-106 + Math.abs(x) * -0.08} r={2.5} fill={ink} />
      ))}
      {/* ladder */}
      <line x1={-28} y1={-20} x2={-24} y2={-188} stroke={PALETTE.metalDark} strokeWidth={3} />
      <line x1={-18} y1={-20} x2={-14} y2={-188} stroke={PALETTE.metalDark} strokeWidth={3} />
      {[-36, -56, -76, -96, -126, -146, -172].map((y) => (
        <line key={y} x1={-27} y1={y} x2={-16} y2={y} stroke={PALETTE.metalDark} strokeWidth={2.5} />
      ))}
      {/* side pipe */}
      <path d="M 58 -70 L 74 -70 L 74 -18" fill="none" stroke={ink} strokeWidth={11} strokeLinejoin="round" />
      <path d="M 58 -70 L 74 -70 L 74 -18" fill="none" stroke={PALETTE.screen} strokeWidth={5} strokeLinejoin="round" />
      {/* fan shroud */}
      <rect x={-58} y={-212} width={116} height={22} fill={PALETTE.metal} stroke={ink} strokeWidth={6} strokeLinejoin="round" />
      <rect x={-52} y={-206} width={30} height={12} fill="#ffffff" opacity={0.3} />
      <ellipse cx={0} cy={-212} rx={58} ry={13} fill={PALETTE.metalDark} stroke={ink} strokeWidth={6} />
      {/* fan blades */}
      <g transform="translate(0 -212) scale(1 0.24)">
        <g transform={`rotate(${angle.toFixed(2)})`}>
          {bladeAngles.map((a) => (
            <ellipse key={a} cx={26} cy={0} rx={24} ry={9} transform={`rotate(${a})`} fill={PALETTE.metal} stroke={ink} strokeWidth={5} />
          ))}
        </g>
        <circle cx={0} cy={0} r={11} fill={PALETTE.ink} />
      </g>
      {/* warning light */}
      <circle cx={50} cy={-216} r={9} fill={PALETTE.alert} opacity={0.3 * glow} />
      <circle cx={50} cy={-216} r={4} fill={PALETTE.alert} stroke={ink} strokeWidth={2} opacity={0.5 + 0.5 * glow} />
      {/* steam */}
      {puffs.map((s) => (
        <g key={s.i} opacity={s.op}>
          <circle cx={s.x} cy={s.y} r={s.r} fill="url(#mk-gen-tower-steam)" stroke={PALETTE.smoke} strokeWidth={3} />
          <circle cx={s.x - s.r * 0.35} cy={s.y - s.r * 0.35} r={s.r * 0.3} fill="#ffffff" opacity={0.8} />
        </g>
      ))}
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 80,
  height: 318,
  Component: CoolingTower,
};
