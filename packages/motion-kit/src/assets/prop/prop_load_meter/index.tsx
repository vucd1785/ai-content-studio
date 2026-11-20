import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, lerp } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const R = 72;
const CY = -200;

/** Cung tròn quanh tâm đồng hồ, góc tính từ phương thẳng đứng (âm là bên trái). */
function arc(a0: number, a1: number, r: number): string {
  const p = (a: number) => `${(Math.sin(a) * r).toFixed(1)} ${(CY - Math.cos(a) * r).toFixed(1)}`;
  return `M ${p(a0)} A ${r} ${r} 0 0 1 ${p(a1)}`;
}

/** Đồng hồ tải trên giá: kim vọt từ vùng xanh lên vùng đỏ trong shot rồi rung ở đỉnh (quá tải). */
const LoadMeter: FC<PropProps> = ({ frame, t }) => {
  const rise = easing.outBack(1.2)(Math.min(1, t * 1.6));
  const angle = lerp(-1.25, 1.1, rise) + (t > 0.6 ? Math.sin(frame * 2.3) * 0.05 : 0);
  const tip = { x: Math.sin(angle) * (R - 14), y: CY - Math.cos(angle) * (R - 14) };
  return (
    <g>
      <ContactShadow halfWidth={60} />
      <rect
        x={-10}
        y={CY + 10}
        width={20}
        height={-CY - 10}
        fill={PALETTE.metalDark}
        stroke={ink}
        strokeWidth={5}
      />
      <rect
        x={-44}
        y={-12}
        width={88}
        height={12}
        rx={5}
        fill={PALETTE.metalDark}
        stroke={ink}
        strokeWidth={4}
      />
      <path
        d={`M ${-R - 14} ${CY + 18} A ${R + 14} ${R + 14} 0 0 1 ${R + 14} ${CY + 18} Z`}
        fill={PALETTE.paper}
        stroke={ink}
        strokeWidth={7}
        strokeLinejoin="round"
      />
      <path d={arc(-1.35, -0.45, R)} fill="none" stroke={PALETTE.ok} strokeWidth={14} />
      <path d={arc(-0.45, 0.45, R)} fill="none" stroke={PALETTE.warn} strokeWidth={14} />
      <path d={arc(0.45, 1.35, R)} fill="none" stroke={PALETTE.alert} strokeWidth={14} />
      <line
        x1={0}
        y1={CY}
        x2={tip.x.toFixed(2)}
        y2={tip.y.toFixed(2)}
        stroke={ink}
        strokeWidth={7}
        strokeLinecap="round"
      />
      <circle cx={0} cy={CY} r={10} fill={ink} />
    </g>
  );
};

export const propLoadMeter: PropAsset = {
  placement: "floor",
  halfWidth: 86,
  height: 290,
  Component: LoadMeter,
};
