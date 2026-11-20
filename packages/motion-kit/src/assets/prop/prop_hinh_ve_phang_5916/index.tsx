import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, clamp, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const CY = -108;
const R = 60;

/** Đồng hồ báo thức hai chuông: kim giờ quay từ 7 sang 9, mặt nháy sáng, chuông rung nhẹ. */
const AlarmClock: FC<PropProps> = ({ frame, seed }) => {
  const cycle = 150;
  const p = (frame % cycle) / cycle;
  const fwd = easing.inOut(clamp(p / 0.55, 0, 1));
  const back = easing.inOut(clamp((p - 0.86) / 0.14, 0, 1));
  const prog = fwd * (1 - back);
  const hourAngle = 210 + 60 * prog;
  const minuteAngle = 720 * prog;
  const ringing = p > 0.55 && p < 0.86 ? 1 : 0.35;
  const shake = Math.sin(frame * 1.7) * 4 * ringing * (0.75 + 0.25 * wobble(frame, seed, 30));
  const glow = 0.5 + 0.5 * Math.sin(frame * 0.22);
  const bodyBob = ringing > 0.5 ? Math.sin(frame * 1.7) * 1.2 : 0;

  const ticks = [];
  for (let i = 0; i < 12; i++) {
    const a = (i * 30 * Math.PI) / 180;
    const big = i % 3 === 0;
    const r = big ? 5 : 3;
    ticks.push(
      <circle
        key={i}
        cx={Math.sin(a) * 44}
        cy={CY - Math.cos(a) * 44}
        r={r}
        fill={big ? ink : PALETTE.metalDark}
      />,
    );
  }

  return (
    <g>
      <defs>
        <radialGradient id="mk-gen-alarm-body" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ff8a6b" />
          <stop offset="0.6" stopColor={PALETTE.alert} />
          <stop offset="1" stopColor="#a8322a" />
        </radialGradient>
        <radialGradient id="mk-gen-alarm-face" cx="0.4" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#fffdf2" />
          <stop offset="1" stopColor="#f3e6c4" />
        </radialGradient>
        <linearGradient id="mk-gen-alarm-bell" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff2a8" />
          <stop offset="0.5" stopColor={PALETTE.warn} />
          <stop offset="1" stopColor="#c98a12" />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={64} />

      {/* chân */}
      <line x1={-30} y1={-60} x2={-46} y2={-8} stroke={ink} strokeWidth={9} strokeLinecap="round" />
      <line x1={30} y1={-60} x2={46} y2={-8} stroke={ink} strokeWidth={9} strokeLinecap="round" />
      <ellipse cx={-46} cy={-7} rx={10} ry={6} fill={PALETTE.metalDark} stroke={ink} strokeWidth={4} />
      <ellipse cx={46} cy={-7} rx={10} ry={6} fill={PALETTE.metalDark} stroke={ink} strokeWidth={4} />

      <g transform={`translate(${bodyBob.toFixed(2)} 0)`}>
        {/* tay cầm */}
        <path
          d={`M -22 ${CY - 62} Q 0 ${CY - 96} 22 ${CY - 62}`}
          fill="none"
          stroke={ink}
          strokeWidth={8}
          strokeLinecap="round"
        />
        {/* búa gõ */}
        <g transform={`rotate(${(shake * 3).toFixed(2)} 0 ${CY - 60})`}>
          <line x1={0} y1={CY - 60} x2={0} y2={CY - 82} stroke={ink} strokeWidth={5} strokeLinecap="round" />
          <circle cx={0} cy={CY - 84} r={6} fill={PALETTE.metal} stroke={ink} strokeWidth={4} />
        </g>

        {/* chuông trái */}
        <g transform={`rotate(${(-28 + shake).toFixed(2)} -34 ${CY - 52})`}>
          <path
            d={`M -60 ${CY - 52} Q -60 ${CY - 92} -34 ${CY - 92} Q -8 ${CY - 92} -8 ${CY - 52} Z`}
            fill="url(#mk-gen-alarm-bell)"
            stroke={ink}
            strokeWidth={6}
            strokeLinejoin="round"
          />
          <path
            d={`M -50 ${CY - 60} Q -50 ${CY - 82} -36 ${CY - 85}`}
            fill="none"
            stroke="#ffffff"
            strokeWidth={4}
            strokeLinecap="round"
            opacity={0.6}
          />
          <circle cx={-34} cy={CY - 96} r={5} fill={PALETTE.metalDark} stroke={ink} strokeWidth={3} />
        </g>
        {/* chuông phải */}
        <g transform={`rotate(${(28 - shake).toFixed(2)} 34 ${CY - 52})`}>
          <path
            d={`M 8 ${CY - 52} Q 8 ${CY - 92} 34 ${CY - 92} Q 60 ${CY - 92} 60 ${CY - 52} Z`}
            fill="url(#mk-gen-alarm-bell)"
            stroke={ink}
            strokeWidth={6}
            strokeLinejoin="round"
          />
          <path
            d={`M 18 ${CY - 60} Q 18 ${CY - 82} 32 ${CY - 85}`}
            fill="none"
            stroke="#ffffff"
            strokeWidth={4}
            strokeLinecap="round"
            opacity={0.6}
          />
          <circle cx={34} cy={CY - 96} r={5} fill={PALETTE.metalDark} stroke={ink} strokeWidth={3} />
        </g>

        {/* thân */}
        <circle cx={0} cy={CY} r={R} fill="url(#mk-gen-alarm-body)" stroke={ink} strokeWidth={7} />
        <path
          d={`M ${-R + 12} ${CY - 14} A ${R - 10} ${R - 10} 0 0 1 -14 ${CY - R + 12}`}
          fill="none"
          stroke="#ffffff"
          strokeWidth={6}
          strokeLinecap="round"
          opacity={0.45}
        />
        <path
          d={`M ${R - 8} ${CY + 10} A ${R - 6} ${R - 6} 0 0 1 10 ${CY + R - 6}`}
          fill="none"
          stroke="#7a1f1a"
          strokeWidth={6}
          strokeLinecap="round"
          opacity={0.3}
        />

        {/* mặt đồng hồ phát sáng */}
        <circle cx={0} cy={CY} r={56} fill={PALETTE.warn} opacity={0.12 + 0.25 * glow} />
        <circle cx={0} cy={CY} r={50} fill="url(#mk-gen-alarm-face)" stroke={ink} strokeWidth={5} />
        <circle cx={0} cy={CY} r={48} fill="#fff7c2" opacity={0.15 + 0.45 * glow} />
        {ticks}

        {/* kim phút */}
        <g transform={`rotate(${minuteAngle.toFixed(2)} 0 ${CY})`}>
          <line x1={0} y1={CY + 6} x2={0} y2={CY - 38} stroke={PALETTE.metalDark} strokeWidth={4} strokeLinecap="round" />
        </g>
        {/* kim giờ */}
        <g transform={`rotate(${hourAngle.toFixed(2)} 0 ${CY})`}>
          <line x1={0} y1={CY + 6} x2={0} y2={CY - 27} stroke={ink} strokeWidth={7} strokeLinecap="round" />
        </g>
        <circle cx={0} cy={CY} r={6} fill={PALETTE.alert} stroke={ink} strokeWidth={3} />

        {/* phản chiếu kính */}
        <path
          d={`M -34 ${CY - 18} Q -30 ${CY - 36} -14 ${CY - 40}`}
          fill="none"
          stroke="#ffffff"
          strokeWidth={5}
          strokeLinecap="round"
          opacity={0.7}
        />
        <circle cx={-36} cy={CY - 6} r={3} fill="#ffffff" opacity={0.7} />
      </g>

      {/* vạch rung */}
      <g opacity={ringing > 0.5 ? 0.5 + 0.5 * glow : 0}>
        <path d={`M -68 ${CY - 80} Q -74 ${CY - 70} -70 ${CY - 58}`} fill="none" stroke={ink} strokeWidth={4} strokeLinecap="round" />
        <path d={`M 68 ${CY - 80} Q 74 ${CY - 70} 70 ${CY - 58}`} fill="none" stroke={ink} strokeWidth={4} strokeLinecap="round" />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 76,
  height: 220,
  Component: AlarmClock,
};
