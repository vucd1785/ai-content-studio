import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { clamp, easing, lerp, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const skin = PALETTE.tiSkin;

/** Bàn tay cầm điện thoại phát ánh sáng xanh: ngón cái lướt liên tục, nội dung cuộn, luồng sáng hắt lên trên. */
const PhoneBlueLight: FC<PropProps> = ({ frame, seed }) => {
  const cycle = 36;
  const phase = (frame % cycle) / cycle;
  const swipeEnd = 0.55;
  const thumbY =
    phase < swipeEnd
      ? lerp(-112, -154, easing.inOut(phase / swipeEnd))
      : lerp(-154, -112, easing.out((phase - swipeEnd) / (1 - swipeEnd)));
  const scroll = 40 * easing.out(clamp(phase / 0.6, 0, 1));
  const glow = 0.75 + 0.25 * wobble(frame, seed, 26);
  const flicker = 0.85 + 0.15 * wobble(frame, seed + 3, 9);
  const sway = 1.5 * wobble(frame, seed + 11, 80);

  const cards = [0, 1, 2, 3, 4];
  const sparkles = [0, 1, 2, 3];

  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-phone-beam" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#5ec8ff" stopOpacity={0.65} />
          <stop offset="1" stopColor="#5ec8ff" stopOpacity={0} />
        </linearGradient>
        <radialGradient id="mk-gen-phone-halo" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#7fd8ff" stopOpacity={0.55} />
          <stop offset="1" stopColor="#7fd8ff" stopOpacity={0} />
        </radialGradient>
        <linearGradient id="mk-gen-phone-screen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a8e6ff" />
          <stop offset="1" stopColor="#2f7bff" />
        </linearGradient>
        <clipPath id="mk-gen-phone-clip">
          <rect x={-26} y={-190} width={52} height={110} rx={6} />
        </clipPath>
      </defs>

      <ContactShadow halfWidth={50} />

      {/* light beam rising toward the face */}
      <polygon
        points="-26,-188 26,-188 76,-262 -76,-262"
        fill="url(#mk-gen-phone-beam)"
        opacity={glow * flicker}
      />
      <ellipse
        cx={0}
        cy={-140}
        rx={78}
        ry={88}
        fill="url(#mk-gen-phone-halo)"
        opacity={glow}
      />
      {sparkles.map((i) => {
        const p = ((frame + i * 17) % 60) / 60;
        const sx = (i % 2 === 0 ? -1 : 1) * (14 + i * 9) + 4 * wobble(frame, seed + i, 30);
        const sy = lerp(-196, -255, easing.out(p));
        const s = 4 * Math.sin(p * Math.PI);
        return (
          <path
            key={i}
            d={`M ${sx} ${sy - s * 1.6} L ${sx + s * 0.4} ${sy} L ${sx} ${sy + s * 1.6} L ${sx - s * 0.4} ${sy} Z M ${sx - s * 1.6} ${sy} L ${sx} ${sy - s * 0.4} L ${sx + s * 1.6} ${sy} L ${sx} ${sy + s * 0.4} Z`}
            fill="#e6f8ff"
            opacity={0.9 * Math.sin(p * Math.PI)}
          />
        );
      })}

      <g transform={`rotate(${sway.toFixed(2)} 0 -40)`}>
        {/* wrist and sleeve */}
        <rect x={-20} y={-80} width={40} height={60} rx={14} fill={skin} stroke={ink} strokeWidth={5} />
        <rect x={-27} y={-44} width={54} height={30} rx={10} fill={PALETTE.accent} stroke={ink} strokeWidth={5} />
        <rect x={-21} y={-40} width={14} height={20} rx={5} fill="#ffffff" opacity={0.25} />

        {/* palm behind phone */}
        <ellipse cx={4} cy={-82} rx={40} ry={24} fill={skin} stroke={ink} strokeWidth={5} />

        {/* phone body */}
        <rect x={-34} y={-202} width={68} height={134} rx={14} fill="#2b2f45" stroke={ink} strokeWidth={6} />
        <rect x={-29} y={-197} width={10} height={120} rx={5} fill="#4a5072" opacity={0.8} />
        <rect x={-8} y={-198} width={16} height={4} rx={2} fill="#14162a" />

        {/* screen */}
        <rect x={-26} y={-190} width={52} height={110} rx={6} fill="url(#mk-gen-phone-screen)" opacity={flicker} />
        <g clipPath="url(#mk-gen-phone-clip)">
          {cards.map((i) => {
            const y = -186 + i * 40 - scroll;
            return (
              <g key={i}>
                <rect x={-22} y={y} width={44} height={32} rx={6} fill="#e9f7ff" opacity={0.9} />
                <circle cx={-13} cy={y + 9} r={5} fill={i % 2 === 0 ? PALETTE.warn : PALETTE.alert} />
                <rect x={-5} y={y + 6} width={22} height={5} rx={2.5} fill="#2f7bff" opacity={0.6} />
                <rect x={-17} y={y + 20} width={34} height={6} rx={3} fill="#2f7bff" opacity={0.35} />
              </g>
            );
          })}
          <rect x={-26} y={-190} width={18} height={110} fill="#ffffff" opacity={0.12} />
        </g>
        <rect x={-26} y={-190} width={52} height={110} rx={6} fill="none" stroke={ink} strokeWidth={3} />

        {/* fingers wrapping the right edge */}
        <rect x={24} y={-160} width={20} height={16} rx={8} fill={skin} stroke={ink} strokeWidth={4} />
        <rect x={25} y={-138} width={20} height={16} rx={8} fill={skin} stroke={ink} strokeWidth={4} />
        <rect x={24} y={-116} width={20} height={16} rx={8} fill={skin} stroke={ink} strokeWidth={4} />
        <rect x={22} y={-94} width={18} height={14} rx={7} fill={skin} stroke={ink} strokeWidth={4} />

        {/* scrolling thumb */}
        <path
          d={`M -38 -74 Q -34 ${(-80 + thumbY) / 2 - 6} -6 ${thumbY}`}
          fill="none"
          stroke={ink}
          strokeWidth={24}
          strokeLinecap="round"
        />
        <path
          d={`M -38 -74 Q -34 ${(-80 + thumbY) / 2 - 6} -6 ${thumbY}`}
          fill="none"
          stroke={skin}
          strokeWidth={14}
          strokeLinecap="round"
        />
        <ellipse cx={-6} cy={thumbY + 1} rx={5} ry={4} fill="#ffe4d6" opacity={0.85} />
        <circle cx={-6} cy={thumbY} r={13} fill="#5ec8ff" opacity={0.18 * glow} />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 80,
  height: 264,
  Component: PhoneBlueLight,
};
