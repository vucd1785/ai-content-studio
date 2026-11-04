import type { FC, ReactNode } from "react";
import { type ExpressionSpec, Face } from "./face.js";
import type { LimbAngles, Pose } from "./pose.js";
import type { Pt, SkinSpec } from "./skin.js";

const rad = (d: number) => (d * Math.PI) / 180;
const fmt = (n: number) => (Math.abs(n) < 1e-9 ? 0 : Number(n.toFixed(2)));

/** Đi một đoạn dài `l` theo góc `a` (0 = xuống, 90 = phải, 180 = lên). */
const step = (p: Pt, a: number, l: number): Pt => ({
  x: p.x + l * Math.sin(rad(a)),
  y: p.y + l * Math.cos(rad(a)),
});

/** Xoay điểm theo chiều kim đồng hồ trên màn hình (giống SVG `rotate(a cx cy)`). */
function rotate(p: Pt, c: Pt, a: number): Pt {
  const cos = Math.cos(rad(a));
  const sin = Math.sin(rad(a));
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
}

function limb(start: Pt, [a1, a2]: LimbAngles, [l1, l2]: LimbAngles, turn: number) {
  const mid = step(start, a1 - turn, l1);
  return { mid, end: step(mid, a1 + a2 - turn, l2) };
}

/** Co giãn thân: `squash` < 1 là bẹt xuống và phình ngang, giữ thể tích gần đúng. */
const squashScale = (squash: number) => ({ sx: 1 + (1 - squash) * 0.5, sy: squash });

/**
 * Vị trí các khớp của nhân vật trong hệ tọa độ hình (trước khi dời bàn chân về mặt đất).
 * Hàm vẽ và các test hình học cùng dùng hàm này, nên test đo đúng cái được vẽ.
 */
export function characterGeometry(skin: SkinSpec, pose: Pose, breathe = 0) {
  const { sx, sy } = squashScale(pose.squash);
  const upper = (p: Pt): Pt =>
    rotate(
      {
        x: skin.hip.x + (p.x - skin.hip.x) * sx,
        y: skin.hip.y + (p.y - skin.hip.y) * sy + breathe,
      },
      skin.hip,
      pose.lean,
    );
  const tilt = skin.headFollowsTilt ? pose.tilt : 0;
  const headAnchor = upper(rotate(skin.headAnchor, skin.neck, tilt));
  const arms = (
    [
      [-1, skin.shoulderA, pose.armA],
      [1, skin.shoulderB, pose.armB],
    ] as const
  ).map(([side, shoulder, angles]) => {
    const start = upper(shoulder);
    return { side, start, ...limb(start, angles, skin.armLen, pose.lean) };
  });
  const legs = (
    [
      [-1, skin.legA, pose.legA],
      [1, skin.legB, pose.legB],
    ] as const
  ).map(([side, start, angles]) => ({ side, start, ...limb(start, angles, skin.legLen, 0) }));
  const feetY = Math.max(...legs.map((l) => l.end.y));
  return {
    sx,
    sy,
    tilt,
    headAnchor,
    headTurn: pose.lean + tilt,
    arms,
    legs,
    feetY,
    /** Đổi một điểm trong hệ hình sang hệ của đầu (gốc ở điểm neo, bỏ nghiêng). */
    toHeadLocal(p: Pt): Pt {
      const q = rotate(p, skin.hip, -pose.lean);
      const unsquashed = {
        x: skin.hip.x + (q.x - skin.hip.x) / sx,
        y: skin.hip.y + (q.y - breathe - skin.hip.y) / sy,
      };
      const r = rotate(unsquashed, skin.neck, -tilt);
      return { x: r.x - skin.headAnchor.x, y: r.y - skin.headAnchor.y };
    },
  };
}

export type CharacterGeometry = ReturnType<typeof characterGeometry>;

/** Khoảng cách có dấu từ một điểm (hệ hình) tới mép vùng đầu; âm là nằm trong. */
function headDistance(skin: SkinSpec, g: CharacterGeometry, p: Pt): number {
  const local = g.toHeadLocal(p);
  const zone = skin.headZone;
  if (zone.kind === "circle") {
    return Math.hypot(local.x, local.y) - zone.r;
  }
  const ox = Math.abs(local.x) - zone.halfWidth;
  const oy = Math.abs(local.y) - zone.halfHeight;
  return ox > 0 || oy > 0 ? Math.hypot(Math.max(ox, 0), Math.max(oy, 0)) : Math.max(ox, oy);
}

/**
 * Khoảng hở nhỏ nhất (px, hệ hình) giữa mép bàn tay và vùng đầu, xét cả hai tay.
 * Âm nghĩa là bàn tay chồng lên đầu.
 */
export function handHeadClearance(skin: SkinSpec, pose: Pose): number {
  const g = characterGeometry(skin, pose);
  return Math.min(...g.arms.map((arm) => headDistance(skin, g, arm.end) - skin.handRadius));
}

/** Như `handHeadClearance` nhưng cho khuỷu tay: cánh tay trên không được cắt qua đầu. */
export function elbowHeadClearance(skin: SkinSpec, pose: Pose): number {
  const g = characterGeometry(skin, pose);
  return Math.min(...g.arms.map((arm) => headDistance(skin, g, arm.mid) - skin.limbWidth / 2));
}

const round = (p: Pt): Pt => ({ x: fmt(p.x), y: fmt(p.y) });
const pathOf = (pts: Pt[]) => `M ${pts.map((p) => `${fmt(p.x)} ${fmt(p.y)}`).join(" L ")}`;

export type CharacterFigureProps = {
  skin: SkinSpec;
  pose: Pose;
  expression: ExpressionSpec;
  blink: boolean;
  /** Khác null là đang nói. */
  mouthOpen: number | null;
  /** Dịch thân theo nhịp thở (px). */
  breathe: number;
  /** 1 nhìn sang phải, -1 lật ngang nhìn sang trái. */
  facing: 1 | -1;
};

/** Nhân vật đứng tại gốc tọa độ, chân chạm y = 0. Hàm thuần: cùng props ra cùng SVG. */
export const CharacterFigure: FC<CharacterFigureProps> = ({
  skin,
  pose,
  expression,
  blink,
  mouthOpen,
  breathe,
  facing,
}) => {
  const g = characterGeometry(skin, pose, breathe);
  const legs: ReactNode[] = [];
  for (const leg of g.legs) {
    legs.push(
      <path
        key={`leg${leg.side}`}
        d={pathOf([leg.start, leg.mid, leg.end])}
        fill="none"
        stroke={skin.limbColor}
        strokeWidth={skin.limbWidth + 1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />,
      <g key={`foot${leg.side}`}>{skin.foot(round(leg.end), leg.side)}</g>,
    );
  }
  const arms: ReactNode[] = [];
  for (const arm of g.arms) {
    arms.push(
      <path
        key={`arm${arm.side}`}
        d={pathOf([arm.start, arm.mid, arm.end])}
        fill="none"
        stroke={skin.limbColor}
        strokeWidth={skin.limbWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />,
      <g key={`hand${arm.side}`}>{skin.hand(round(arm.end), arm.side)}</g>,
    );
  }
  const { hip, neck, headAnchor } = skin;
  const upperTransform = `rotate(${fmt(pose.lean)} ${hip.x} ${hip.y}) translate(0 ${fmt(breathe)}) translate(${hip.x} ${hip.y}) scale(${fmt(g.sx)} ${fmt(g.sy)}) translate(${-hip.x} ${-hip.y})`;
  const face = (
    <Face expression={expression} style={skin.faceStyle} blink={blink} mouthOpen={mouthOpen} />
  );
  const shadowSquash = Math.max(0.3, 1 - pose.hop / 120);
  return (
    <g transform={facing === -1 ? "scale(-1 1)" : undefined}>
      <ellipse cx={0} cy={4} rx={fmt(70 * shadowSquash)} ry={10} fill="#000" opacity={0.18} />
      <g transform={`translate(0 ${fmt(-g.feetY - pose.hop)})`}>
        {legs}
        <g transform={upperTransform}>
          {skin.torso()}
          <g
            transform={`rotate(${fmt(g.tilt)} ${neck.x} ${neck.y}) translate(${headAnchor.x} ${headAnchor.y})`}
          >
            {skin.head(face)}
          </g>
        </g>
        {arms}
      </g>
    </g>
  );
};
