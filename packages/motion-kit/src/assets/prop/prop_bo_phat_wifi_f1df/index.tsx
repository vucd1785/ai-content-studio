import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { clamp, easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const WAVE_ON = "#3FA9F5";
const WAVE_GLOW = "#9AD8FF";
const WAVE_OFF = "#C9D6E3";
const CX = 0;
const CY = -164;

const arcPath = (r: number): string => {
  const d = r * 0.7071;
  return `M ${(CX - d).toFixed(2)} ${(CY - d).toFixed(2)} A ${r} ${r} 0 0 1 ${(CX + d).toFixed(2)} ${(CY - d).toFixed(2)}`;
};

/** Bộ phát wifi trắng: hai râu ăng-ten, đèn xanh nhấp nháy, ba vạch sóng wifi sáng dần lần lượt. */
const BoPhatWifi: FC<PropProps> = ({ frame, seed }) => {
  const cycle = 72;
  const f = ((frame % cycle) + cycle) % cycle;
  const fadeOut = 1 - easing.inOut(clamp((f - 56) / 14, 0, 1));
  const level = (i: number): number =>
    easing.out(clamp((f - i * 11) / 9, 0, 1)) * fadeOut;

  const blink = 0.5 + 0.5 * Math.sin(frame * 0.35);
  const ledOn = blink > 0.35 ? 1 : 0.35;
  const swayL = 4 * wobble(frame, seed + 3, 80);
  const swayR = 4 * wobble(frame, seed + 11, 90);
  const pulse = level(3);
  const bodyScaleY = 1 + 0.015 * Math.sin(frame * 0.12);

  const radii = [22, 38, 54];

  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-wifi-body" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.6" stopColor="#F1F4F8" />
          <stop offset="1" stopColor="#D5DCE5" />
        </linearGradient>
        <radialGradient id="mk-gen-wifi-led" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={PALETTE.ok} stopOpacity={0.9} />
          <stop offset="1" stopColor={PALETTE.ok} stopOpacity={0} />
        </radialGradient>
      </defs>
      <ContactShadow halfWidth={72} />

      {/* feet */}
      <rect x={-56} y={-16} width={20} height={14} rx={5} fill={PALETTE.metalDark} stroke={ink} strokeWidth={4} />
      <rect x={36} y={-16} width={20} height={14} rx={5} fill={PALETTE.metalDark} stroke={ink} strokeWidth={4} />

      {/* antennas */}
      <g transform={`rotate(${(-6 + swayL).toFixed(2)} -48 -50)`}>
        <rect x={-55} y={-138} width={14} height={92} rx={7} fill="#FFFFFF" stroke={ink} strokeWidth={5} />
        <rect x={-51} y={-130} width={4} height={70} rx={2} fill="#FFFFFF" opacity={0.9} />
        <rect x={-46} y={-130} width={3} height={74} rx={1.5} fill="#B9C3CF" opacity={0.6} />
      </g>
      <g transform={`rotate(${(6 + swayR).toFixed(2)} 48 -50)`}>
        <rect x={41} y={-138} width={14} height={92} rx={7} fill="#FFFFFF" stroke={ink} strokeWidth={5} />
        <rect x={50} y={-130} width={3} height={74} rx={1.5} fill="#B9C3CF" opacity={0.6} />
      </g>

      {/* body */}
      <g transform={`translate(0 -12) scale(1 ${bodyScaleY.toFixed(4)}) translate(0 12)`}>
        <rect x={-70} y={-58} width={140} height={46} rx={16} fill="url(#mk-gen-wifi-body)" stroke={ink} strokeWidth={6} />
        {/* top face highlight */}
        <rect x={-60} y={-52} width={84} height={8} rx={4} fill="#FFFFFF" opacity={0.9} />
        {/* bottom shade */}
        <rect x={-62} y={-26} width={124} height={9} rx={4.5} fill="#AEB9C6" opacity={0.45} />
        {/* front strip */}
        <rect x={-54} y={-40} width={108} height={14} rx={7} fill="#E3E8EF" stroke={ink} strokeWidth={3} />
        {/* main green led */}
        <circle cx={-38} cy={-33} r={13} fill="url(#mk-gen-wifi-led)" opacity={ledOn * 0.8} />
        <circle cx={-38} cy={-33} r={4.5} fill={PALETTE.ok} opacity={ledOn} stroke={ink} strokeWidth={1.5} />
        {/* other leds */}
        <circle cx={-20} cy={-33} r={3.5} fill={PALETTE.ok} opacity={0.4 + 0.6 * pulse} />
        <circle cx={-4} cy={-33} r={3.5} fill={PALETTE.ok} opacity={0.4 + 0.6 * (1 - blink)} />
        <circle cx={12} cy={-33} r={3.5} fill={PALETTE.ok} />
        {/* vents */}
        <rect x={28} y={-35} width={4} height={5} rx={2} fill={PALETTE.metalDark} />
        <rect x={36} y={-35} width={4} height={5} rx={2} fill={PALETTE.metalDark} />
        <rect x={44} y={-35} width={4} height={5} rx={2} fill={PALETTE.metalDark} />
      </g>

      {/* wifi icon */}
      <circle cx={CX} cy={CY} r={9} fill={ink} />
      <circle cx={CX} cy={CY} r={6} fill={level(0) > 0.05 ? WAVE_ON : WAVE_OFF} />
      <circle cx={CX} cy={CY} r={14} fill={WAVE_GLOW} opacity={0.4 * level(0)} />
      {radii.map((r, i) => {
        const lv = level(i + 1);
        return (
          <g key={r}>
            <path d={arcPath(r)} fill="none" stroke={WAVE_GLOW} strokeWidth={16} strokeLinecap="round" opacity={0.35 * lv} />
            <path d={arcPath(r)} fill="none" stroke={ink} strokeWidth={12} strokeLinecap="round" />
            <path d={arcPath(r)} fill="none" stroke={WAVE_OFF} strokeWidth={6} strokeLinecap="round" />
            <path d={arcPath(r)} fill="none" stroke={WAVE_ON} strokeWidth={6} strokeLinecap="round" opacity={lv} />
          </g>
        );
      })}
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 80,
  height: 230,
  Component: BoPhatWifi,
};
