import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

/** Ấm đun nước điện: thân trắng, đèn đế đỏ sáng nhấp nháy, nắp khẽ rung, hơi nước cong bốc lên từ vòi. */
const ElectricKettle: FC<PropProps> = ({ frame, seed }) => {
  const glow = 0.5 + 0.5 * wobble(frame, seed, 24);
  const rattle = Math.max(0, Math.sin(frame * 0.5)) * 1.6 * (0.6 + 0.4 * glow);
  const lidTilt = Math.sin(frame * 0.5) * 1.2;
  const breathe = 1 + 0.008 * wobble(frame, seed + 3, 40);

  const wisps = [0, 1, 2].map((i) => {
    const p = ((frame + i * 22 + seed * 5) % 66) / 66;
    const rise = easing.out(p) * 62;
    const op = Math.sin(p * Math.PI);
    const sway = 6 * wobble(frame, seed + 11 + i, 50);
    const bx = -58 + i * 9 + sway * p;
    const by = -162 - rise;
    const d = `M ${bx.toFixed(2)} ${by.toFixed(2)} C ${(bx - 10).toFixed(2)} ${(by - 12).toFixed(2)}, ${(bx + 10).toFixed(2)} ${(by - 24).toFixed(2)}, ${(bx + 1).toFixed(2)} ${(by - 38).toFixed(2)}`;
    return { d, op, w: 9 - i * 1.5 };
  });

  const bubbles = [0, 1, 2].map((i) => {
    const p = ((frame * 1.3 + i * 17) % 40) / 40;
    return { x: -2 + i * 5 - 5, y: -40 - p * 46, op: Math.sin(p * Math.PI), r: 2.2 + (i % 2) };
  });

  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-kettle-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.55" stopColor="#F1F4F7" />
          <stop offset="1" stopColor="#C9D3DD" />
        </linearGradient>
        <radialGradient id="mk-gen-kettle-led" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FF6B5E" stopOpacity={0.9} />
          <stop offset="1" stopColor="#FF3B30" stopOpacity={0} />
        </radialGradient>
      </defs>
      <ContactShadow halfWidth={64} />

      {/* Đế */}
      <rect x={-56} y={-22} width={112} height={20} rx={9} fill={PALETTE.metalDark} stroke={ink} strokeWidth={5} />
      <rect x={-48} y={-19} width={60} height={4} rx={2} fill="#FFFFFF" opacity={0.25} />
      <circle cx={30} cy={-12} r={16 + 4 * glow} fill="url(#mk-gen-kettle-led)" opacity={0.6 + 0.4 * glow} />
      <circle cx={30} cy={-12} r={5} fill={PALETTE.alert} stroke={ink} strokeWidth={2.5} />
      <circle cx={28.5} cy={-13.5} r={1.8} fill="#FFFFFF" opacity={0.5 + 0.5 * glow} />

      <g transform={`translate(0 -22) scale(${(2 - breathe).toFixed(4)} ${breathe.toFixed(4)}) translate(0 22)`}>
        {/* Tay cầm */}
        <path
          d="M 34 -138 Q 70 -140 66 -100 L 62 -58 Q 58 -40 42 -42"
          fill="none"
          stroke={ink}
          strokeWidth={20}
          strokeLinecap="round"
        />
        <path
          d="M 34 -138 Q 70 -140 66 -100 L 62 -58 Q 58 -40 42 -42"
          fill="none"
          stroke={PALETTE.metalDark}
          strokeWidth={10}
          strokeLinecap="round"
        />

        {/* Vòi */}
        <path
          d="M -36 -128 L -60 -152 Q -66 -156 -62 -146 L -40 -104 Z"
          fill="#E6ECF1"
          stroke={ink}
          strokeWidth={5}
          strokeLinejoin="round"
        />

        {/* Thân */}
        <path
          d="M -46 -24 Q -50 -24 -48 -32 L -38 -138 Q -36 -148 -24 -149 L 24 -149 Q 36 -148 38 -138 L 48 -32 Q 50 -24 46 -24 Z"
          fill="url(#mk-gen-kettle-body)"
          stroke={ink}
          strokeWidth={6}
          strokeLinejoin="round"
        />
        <path d="M -34 -132 L -40 -40" stroke="#FFFFFF" strokeWidth={6} strokeLinecap="round" opacity={0.9} />
        <path d="M 30 -134 L 38 -36 L 26 -36 Z" fill="#9AAAB8" opacity={0.3} />

        {/* Cửa sổ báo nước */}
        <rect x={-10} y={-120} width={20} height={88} rx={10} fill="#DCEFFA" stroke={ink} strokeWidth={4} />
        <rect x={-7} y={-88 + 2 * wobble(frame, seed + 5, 30)} width={14} height={53} rx={7} fill={PALETTE.screen} opacity={0.75} />
        {bubbles.map((b, i) => (
          <circle key={i} cx={b.x} cy={b.y} r={b.r} fill="#FFFFFF" opacity={0.8 * b.op} />
        ))}

        {/* Viền đáy thân */}
        <rect x={-48} y={-36} width={96} height={12} rx={6} fill={PALETTE.metal} stroke={ink} strokeWidth={4} />

        {/* Nắp */}
        <g transform={`translate(0 ${(-rattle).toFixed(2)}) rotate(${lidTilt.toFixed(2)} 0 -150)`}>
          <path d="M -30 -148 Q 0 -168 30 -148 Z" fill="#F6F8FA" stroke={ink} strokeWidth={5} strokeLinejoin="round" />
          <rect x={-9} y={-168} width={18} height={10} rx={5} fill={PALETTE.metalDark} stroke={ink} strokeWidth={4} />
          <path d="M -20 -152 Q -10 -159 0 -160" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" fill="none" />
        </g>
      </g>

      {/* Hơi nước */}
      {wisps.map((w, i) => (
        <g key={i} opacity={w.op}>
          <path d={w.d} fill="none" stroke={PALETTE.smoke} strokeWidth={w.w + 4} strokeLinecap="round" opacity={0.6} />
          <path d={w.d} fill="none" stroke="#FFFFFF" strokeWidth={w.w} strokeLinecap="round" />
        </g>
      ))}
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 70,
  height: 270,
  Component: ElectricKettle,
};
