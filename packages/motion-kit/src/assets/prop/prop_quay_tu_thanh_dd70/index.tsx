import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble, clamp } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

/** Quầy tự thanh toán: màn hình cảm ứng, máy quét tia đỏ quét lên xuống, khay đặt hàng. */
const SelfCheckout: FC<PropProps> = ({ frame, seed }) => {
  const cyc = (frame % 60) / 60;
  const sweep = easing.inOut(cyc < 0.5 ? cyc * 2 : 2 - cyc * 2);
  const laserY = -114 + sweep * 20;
  const glow = 0.5 + 0.5 * wobble(frame, seed, 24);
  const blink = frame % 40 < 28 ? 1 : 0.35;
  const tapP = (frame % 72) / 72;
  const tapR = 3 + easing.out(clamp(tapP * 1.6, 0, 1)) * 12;
  const tapO = clamp(1 - tapP * 1.6, 0, 1) * 0.8;
  const payPulse = 0.75 + 0.25 * Math.sin(frame * 0.15);
  const boxBounce = Math.abs(Math.sin(frame * 0.07)) * 2.5;
  const boxSquash = 1 + 0.03 * Math.sin(frame * 0.14);
  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-qtt-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f4f7fb" />
          <stop offset="0.55" stopColor={PALETTE.metal} />
          <stop offset="1" stopColor={PALETTE.metalDark} />
        </linearGradient>
        <linearGradient id="mk-gen-qtt-screen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#bfe9ff" />
          <stop offset="1" stopColor={PALETTE.screen} />
        </linearGradient>
        <radialGradient id="mk-gen-qtt-laser" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ff5a5a" stopOpacity={0.9} />
          <stop offset="1" stopColor="#ff5a5a" stopOpacity={0} />
        </radialGradient>
      </defs>
      <ContactShadow halfWidth={84} />

      {/* khay đặt hàng */}
      <rect x={-56} y={-96} width={14} height={8} fill={PALETTE.metalDark} stroke={ink} strokeWidth={4} />
      <path d="M-62 -92 L-50 -60" stroke={ink} strokeWidth={5} strokeLinecap="round" />
      <rect x={-86} y={-104} width={42} height={11} rx={4} fill={PALETTE.metal} stroke={ink} strokeWidth={5} />
      <rect x={-82} y={-102} width={30} height={3} rx={1.5} fill="#ffffff" opacity={0.6} />
      <g transform={`translate(-66 ${(-104 - boxBounce).toFixed(2)}) scale(${(2 - boxSquash).toFixed(3)} ${boxSquash.toFixed(3)})`}>
        <rect x={-12} y={-24} width={24} height={24} rx={3} fill={PALETTE.warn} stroke={ink} strokeWidth={4} />
        <rect x={-12} y={-24} width={8} height={24} rx={3} fill="#ffffff" opacity={0.3} />
        <rect x={-3} y={-24} width={6} height={24} fill={PALETTE.accent} opacity={0.8} />
      </g>

      {/* thân quầy */}
      <rect x={-46} y={-128} width={92} height={128} rx={10} fill="url(#mk-gen-qtt-body)" stroke={ink} strokeWidth={6} />
      <rect x={-40} y={-120} width={10} height={112} rx={5} fill="#ffffff" opacity={0.35} />
      <rect x={30} y={-120} width={12} height={112} rx={5} fill={ink} opacity={0.12} />
      <rect x={-40} y={-80} width={80} height={62} rx={6} fill="none" stroke={ink} strokeWidth={3} opacity={0.6} />
      <circle cx={30} cy={-50} r={3.5} fill={ink} />
      <rect x={-46} y={-12} width={92} height={12} rx={4} fill={PALETTE.metalDark} stroke={ink} strokeWidth={5} />
      <circle cx={-34} cy={-74} r={2.5} fill={ink} opacity={0.7} />
      <circle cx={34} cy={-74} r={2.5} fill={ink} opacity={0.7} />
      {/* khe hóa đơn */}
      <rect x={-18} y={-90} width={36} height={6} rx={3} fill={ink} />

      {/* cửa sổ máy quét */}
      <rect x={-30} y={-120} width={60} height={28} rx={6} fill="#3a2430" stroke={ink} strokeWidth={4} />
      <rect x={-26} y={-117} width={12} height={22} rx={3} fill="#ffffff" opacity={0.12} />
      <ellipse cx={0} cy={laserY} rx={30} ry={8} fill="url(#mk-gen-qtt-laser)" opacity={glow} />
      <line x1={-24} y1={laserY} x2={24} y2={laserY} stroke="#ff3b3b" strokeWidth={2.5} strokeLinecap="round" />
      <line x1={-18} y1={-114} x2={18} y2={-98} stroke="#ff3b3b" strokeWidth={1.5} opacity={0.5 * glow} />
      <line x1={18} y1={-114} x2={-18} y2={-98} stroke="#ff3b3b" strokeWidth={1.5} opacity={0.5 * glow} />

      {/* mặt quầy */}
      <rect x={-52} y={-140} width={104} height={14} rx={6} fill={PALETTE.metal} stroke={ink} strokeWidth={6} />
      <rect x={-46} y={-137} width={60} height={3} rx={1.5} fill="#ffffff" opacity={0.7} />
      <rect x={-22} y={-138} width={44} height={6} rx={3} fill="#4a2a36" />
      <rect x={-20} y={-137} width={40} height={4} rx={2} fill="#ff4d4d" opacity={0.4 + 0.5 * glow} />

      {/* máy đọc thẻ */}
      <rect x={30} y={-164} width={20} height={26} rx={4} fill={PALETTE.bitShell} stroke={ink} strokeWidth={4} />
      <rect x={34} y={-160} width={12} height={8} rx={2} fill={PALETTE.screen} />
      <circle cx={40} cy={-145} r={2.5} fill={PALETTE.ok} opacity={blink} />

      {/* cột màn hình */}
      <rect x={-6} y={-180} width={12} height={42} fill={PALETTE.metalDark} stroke={ink} strokeWidth={5} />

      {/* màn hình cảm ứng */}
      <rect x={-46} y={-254} width={92} height={78} rx={12} fill={PALETTE.bitShell} stroke={ink} strokeWidth={6} />
      <rect x={-38} y={-246} width={76} height={60} rx={6} fill="url(#mk-gen-qtt-screen)" stroke={ink} strokeWidth={3} />
      <rect x={-33} y={-240} width={30} height={7} rx={3.5} fill="#ffffff" opacity={0.85} />
      <circle cx={-27} cy={-222} r={6} fill={PALETTE.warn} stroke={ink} strokeWidth={2} />
      <rect x={-17} y={-224} width={22} height={4} rx={2} fill={ink} opacity={0.35} />
      <circle cx={-27} cy={-206} r={6} fill={PALETTE.leaf} stroke={ink} strokeWidth={2} />
      <rect x={-17} y={-208} width={18} height={4} rx={2} fill={ink} opacity={0.35} />
      <rect x={10} y={-210} width={24} height={16} rx={5} fill={PALETTE.ok} stroke={ink} strokeWidth={2.5} opacity={payPulse} />
      <path d="M16 -202 L20 -198 L28 -206" fill="none" stroke="#ffffff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={22} cy={-202} r={tapR} fill="none" stroke="#ffffff" strokeWidth={2} opacity={tapO} />
      <path d="M-38 -246 L-10 -246 L-38 -214 Z" fill="#ffffff" opacity={0.25} />
      <rect x={-40} y={-184} width={80} height={4} rx={2} fill={ink} opacity={0.15} />

      {/* đèn trạng thái */}
      <rect x={-3} y={-274} width={6} height={22} fill={PALETTE.metalDark} stroke={ink} strokeWidth={3} />
      <circle cx={0} cy={-280} r={14} fill={PALETTE.ok} opacity={0.25 * blink} />
      <circle cx={0} cy={-280} r={8} fill={PALETTE.ok} stroke={ink} strokeWidth={4} opacity={0.5 + 0.5 * blink} />
      <circle cx={-2.5} cy={-282.5} r={2.5} fill="#ffffff" opacity={0.8} />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 88,
  height: 296,
  Component: SelfCheckout,
};
