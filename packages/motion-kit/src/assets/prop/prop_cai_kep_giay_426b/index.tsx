import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble, clamp } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const HINGE_Y = -150;

/** Một đoạn dây kẹp giấy: viền mực, thân kim loại, vệt sáng phía trái-trên. */
const Wire: FC<{ d: string }> = ({ d }) => (
  <g fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} stroke={ink} strokeWidth={13} />
    <path d={d} stroke={PALETTE.metal} strokeWidth={7} />
    <path d={d} stroke="#ffffff" strokeWidth={2.4} opacity={0.55} transform="translate(-1.5 -1)" />
  </g>
);

const LOWER_OUTER = "M -16 0 L -16 80 A 16 16 0 0 0 16 80 L 16 0";
const LOWER_INNER = "M -7 0 L -7 62 A 7 7 0 0 0 7 62 L 7 0";
const UPPER_OUTER = "M -16 0 L -16 -70 A 16 16 0 0 1 16 -70 L 16 0";
const UPPER_INNER = "M 7 0 L 7 -50 A 7 7 0 0 0 -7 -50 L -7 -18";

/** Kẹp giấy bị bẻ qua lại: chỗ gập nóng đỏ dần, tia lửa và vết nứt nhỏ. */
const PaperclipFatigue: FC<PropProps> = ({ frame, seed }) => {
  // bẻ qua lại: chu kỳ 40 khung, có nhấn nhá ease
  const period = 40;
  const p = (frame % period) / period;
  const tri = p < 0.5 ? p * 2 : 2 - p * 2;
  const bend = (easing.inOut(tri) * 2 - 1) * 34;
  // follow-through nhỏ cho đầu kẹp
  const lag = Math.sin((frame / period) * Math.PI * 2 - 0.9) * 4;
  // nhiệt tăng dần theo vòng lặp dài, cộng thêm khi gập mạnh
  const slow = ((frame % 180) / 180);
  const heatBase = easing.out(slow);
  const heat = clamp(heatBase * 0.75 + (Math.abs(bend) / 34) * 0.25, 0, 1);
  const crack = clamp((slow - 0.45) / 0.4, 0, 1);
  const flicker = 0.85 + 0.15 * wobble(frame, seed, 8);
  const sparkOn = Math.abs(bend) > 28 ? 1 : 0;
  const side = bend > 0 ? 1 : -1;

  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-vise" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c9d3dd" />
          <stop offset="0.5" stopColor={PALETTE.metal} />
          <stop offset="1" stopColor={PALETTE.metalDark} />
        </linearGradient>
        <radialGradient id="mk-gen-heat" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff3b0" stopOpacity={0.95} />
          <stop offset="0.4" stopColor="#ff7a2e" stopOpacity={0.8} />
          <stop offset="1" stopColor={PALETTE.alert} stopOpacity={0} />
        </radialGradient>
      </defs>

      <ContactShadow halfWidth={62} />

      {/* đế ê-tô phía sau */}
      <rect x={-52} y={-24} width={104} height={24} rx={8} fill={PALETTE.metalDark} stroke={ink} strokeWidth={6} />

      {/* nửa dưới kẹp giấy */}
      <g transform={`translate(0 ${HINGE_Y})`}>
        <Wire d={LOWER_OUTER} />
        <Wire d={LOWER_INNER} />
      </g>

      {/* hàm ê-tô phía trước */}
      <rect x={-40} y={-74} width={80} height={56} rx={10} fill="url(#mk-gen-vise)" stroke={ink} strokeWidth={6} />
      <rect x={-32} y={-68} width={30} height={8} rx={4} fill="#ffffff" opacity={0.45} />
      <rect x={-40} y={-34} width={80} height={16} rx={6} fill={ink} opacity={0.18} />
      <circle cx={-26} cy={-44} r={5} fill={PALETTE.metalDark} stroke={ink} strokeWidth={3} />
      <circle cx={26} cy={-44} r={5} fill={PALETTE.metalDark} stroke={ink} strokeWidth={3} />

      {/* nửa trên bị bẻ */}
      <g transform={`translate(0 ${HINGE_Y}) rotate(${bend.toFixed(2)})`}>
        <g transform={`rotate(${lag.toFixed(2)} 0 -40)`}>
          <Wire d={UPPER_OUTER} />
          <Wire d={UPPER_INNER} />
        </g>
      </g>

      {/* chỗ gập nóng đỏ */}
      <g transform={`translate(0 ${HINGE_Y})`}>
        <ellipse cx={0} cy={0} rx={34} ry={22} fill="url(#mk-gen-heat)" opacity={heat * flicker} />
        <rect x={-20} y={-7} width={40} height={14} rx={7} fill={PALETTE.alert} stroke={ink} strokeWidth={4} opacity={0.25 + 0.75 * heat} />
        <rect x={-14} y={-4} width={20} height={4} rx={2} fill="#ffd27a" opacity={heat * 0.9} />

        {/* vết nứt */}
        <g opacity={crack} fill="none" stroke={ink} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
          <path d="M -16 -6 L -12 -1 L -15 3 L -11 7" />
          <path d="M 14 -6 L 11 -2 L 15 2" />
        </g>

        {/* tia lửa khi gập mạnh */}
        <g opacity={sparkOn * heat}>
          {[0, 1, 2].map((i) => {
            const a = (-30 - i * 28) * (Math.PI / 180);
            const r1 = 24 + i * 3;
            const r2 = r1 + 12;
            return (
              <line
                key={i}
                x1={side * Math.cos(a) * r1}
                y1={Math.sin(a) * r1}
                x2={side * Math.cos(a) * r2}
                y2={Math.sin(a) * r2}
                stroke={PALETTE.warn}
                strokeWidth={4}
                strokeLinecap="round"
              />
            );
          })}
        </g>
      </g>

      {/* vệt chuyển động */}
      <g fill="none" stroke={ink} strokeWidth={3} strokeLinecap="round" opacity={0.3 + 0.2 * Math.abs(bend) / 34}>
        <path d={`M ${-58} ${HINGE_Y - 70} Q 0 ${HINGE_Y - 104} 58 ${HINGE_Y - 70}`} />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 80,
  height: 260,
  Component: PaperclipFatigue,
};
