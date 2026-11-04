import type { FC, ReactNode } from "react";

/**
 * Mô tả một biểu cảm. Khuôn mặt dùng chung cho mọi lớp da; lớp da quyết định màu nét, cỡ, có phát sáng không.
 * `brows`: [góc mày trái, góc mày phải, độ cao mày]. `look`: lệch con ngươi (px).
 */
export type ExpressionSpec = {
  eyes: "oval" | "big" | "wide" | "half" | "happy";
  brows: readonly [number, number, number];
  mouth: "smileOpen" | "o" | "wavy" | "flat" | "smirk" | "frown";
  look?: readonly [number, number];
  sweat?: boolean;
  tear?: boolean;
  blush?: boolean;
};

export type FaceStyle = {
  ink: string;
  /** Mặt là màn hình phát sáng (Bit): không tròng trắng, không má hồng, miệng cùng màu nét. */
  glow: boolean;
  alwaysBlush: boolean;
  scale: number;
};

export type FaceProps = {
  expression: ExpressionSpec;
  style: FaceStyle;
  blink: boolean;
  /** Khác null là đang nói: 0..1 là độ mở miệng ở frame này. */
  mouthOpen: number | null;
};

const MOUTH_RED = "#b8323a";
const BLUSH = "#ff6f91";
const DROP_FILL = "#6ec6ff";
const DROP_STROKE = "#2d7fb8";

function eye(spec: ExpressionSpec, style: FaceStyle, side: -1 | 1, blink: boolean): ReactNode[] {
  const { ink, glow } = style;
  const [lx, ly] = spec.look ?? [0, 0];
  const x = side * 18;
  const y = -2;
  const k = `eye${side}`;
  const round = { stroke: ink, strokeLinecap: "round" as const };
  if (blink) {
    return [<line key={k} x1={x - 8} y1={y} x2={x + 8} y2={y} strokeWidth={4} {...round} />];
  }
  switch (spec.eyes) {
    case "oval":
    case "big": {
      const big = spec.eyes === "big";
      const out: ReactNode[] = [
        <ellipse key={k} cx={x + lx} cy={y + ly} rx={big ? 8 : 6.5} ry={big ? 11 : 9} fill={ink} />,
      ];
      if (!glow) {
        out.push(<circle key={`${k}h`} cx={x + lx + 2.5} cy={y + ly - 3.5} r={2.4} fill="#fff" />);
      }
      return out;
    }
    case "wide":
      return [
        <circle
          key={k}
          cx={x}
          cy={y}
          r={11}
          fill={glow ? "none" : "#fff"}
          stroke={ink}
          strokeWidth={3}
        />,
        <circle key={`${k}p`} cx={x + lx} cy={y + ly} r={3.5} fill={ink} />,
      ];
    case "half":
      return [
        <path key={k} d={`M ${x - 7 + lx} ${y} A 7 8 0 0 0 ${x + 7 + lx} ${y} Z`} fill={ink} />,
        <line key={`${k}l`} x1={x - 10} y1={y} x2={x + 10} y2={y} strokeWidth={3.5} {...round} />,
      ];
    case "happy":
      return [
        <path
          key={k}
          d={`M ${x - 8} ${y + 3} Q ${x} ${y - 9} ${x + 8} ${y + 3}`}
          fill="none"
          strokeWidth={4}
          {...round}
        />,
      ];
  }
}

function mouth(spec: ExpressionSpec, style: FaceStyle, open: number | null): ReactNode {
  const { ink, glow } = style;
  const fill = glow ? ink : MOUTH_RED;
  const line = { fill: "none", stroke: ink, strokeWidth: 3.5, strokeLinecap: "round" as const };
  if (open !== null) {
    return (
      <ellipse
        key="m"
        cx={0}
        cy={24}
        rx={10}
        ry={2 + 9 * open}
        fill={fill}
        stroke={ink}
        strokeWidth={3}
      />
    );
  }
  switch (spec.mouth) {
    case "smileOpen":
      return (
        <path
          key="m"
          d="M -14 17 Q 0 38 14 17 Z"
          fill={fill}
          stroke={ink}
          strokeWidth={3}
          strokeLinejoin="round"
        />
      );
    case "o":
      return <ellipse key="m" cx={0} cy={24} rx={6} ry={8} fill={ink} />;
    case "wavy":
      return <path key="m" d="M -14 24 q 3.5 -5 7 0 t 7 0 t 7 0 t 7 0" {...line} />;
    case "flat":
      return <line key="m" x1={-6} y1={25} x2={12} y2={22} {...line} />;
    case "smirk":
      return <path key="m" d="M -10 22 Q 4 29 15 15" {...line} />;
    case "frown":
      return <path key="m" d="M -12 29 Q 0 18 12 29" {...line} />;
  }
}

function drop(key: string, x: number, y: number, s: number, style: FaceStyle) {
  return (
    <path
      key={key}
      d={`M ${x} ${y - 9 * s} Q ${x + 6 * s} ${y} ${x} ${y + 4 * s} Q ${x - 6 * s} ${y} ${x} ${y - 9 * s} Z`}
      fill={style.glow ? style.ink : DROP_FILL}
      stroke={style.glow ? "none" : DROP_STROKE}
      strokeWidth={1.5}
    />
  );
}

/** Khuôn mặt tại gốc tọa độ (giữa hai mắt), trước khi nhân `style.scale`. */
export const Face: FC<FaceProps> = ({ expression, style, blink, mouthOpen }) => {
  const parts: ReactNode[] = [
    ...eye(expression, style, -1, blink),
    ...eye(expression, style, 1, blink),
  ];
  const [aL, aR, by] = expression.brows;
  for (const [side, a] of [
    [-1, aL],
    [1, aR],
  ] as const) {
    parts.push(
      <line
        key={`brow${side}`}
        x1={-8}
        y1={0}
        x2={8}
        y2={0}
        stroke={style.ink}
        strokeWidth={4}
        strokeLinecap="round"
        transform={`translate(${side * 18} ${by}) rotate(${a})`}
      />,
    );
  }
  parts.push(mouth(expression, style, mouthOpen));
  if (expression.sweat) {
    parts.push(drop("sweat", 36, -26, 1.3, style));
  }
  if (expression.tear) {
    parts.push(drop("tear", -20, 14, 1, style));
  }
  if ((expression.blush || style.alwaysBlush) && !style.glow) {
    parts.push(
      <ellipse key="b1" cx={-30} cy={13} rx={8} ry={5} fill={BLUSH} opacity={0.8} />,
      <ellipse key="b2" cx={30} cy={13} rx={8} ry={5} fill={BLUSH} opacity={0.8} />,
    );
  }
  return <g transform={`scale(${style.scale})`}>{parts}</g>;
};
