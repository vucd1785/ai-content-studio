import type { FC, ReactNode } from "react";
import { PALETTE } from "../../../palette.js";
import type { BackgroundAsset, BackgroundProps } from "../../../stage/types.js";

const BACK = { x1: 160, y1: 480, x2: 920, y2: 1240 };
const INK = PALETTE.wallInk;
/** Bảng đen trên tường sau; template vẽ sơ đồ hoặc code vào vùng này. */
const BOARD = { x: 250, y: 600, width: 580, height: 330 };

function floorTiles(): ReactNode[] {
  const out: ReactNode[] = [];
  for (let i = 0; i <= 6; i++) {
    out.push(
      <line
        key={`v${i}`}
        x1={BACK.x1 + ((BACK.x2 - BACK.x1) * i) / 6}
        y1={BACK.y2}
        x2={(1080 * i) / 6}
        y2={1920}
        stroke="#9aa3a8"
        strokeWidth={2}
      />,
    );
  }
  // Đường ngang của gạch: khoảng cách tăng dần về phía trước theo phối cảnh.
  for (const [i, y] of [1290, 1360, 1460, 1600, 1790].entries()) {
    out.push(
      <line key={`h${i}`} x1={0} y1={y} x2={1080} y2={y} stroke="#9aa3a8" strokeWidth={2} />,
    );
  }
  return out;
}

/** Lớp học mức chi tiết 2: bảng đen, bàn giáo viên, quả địa cầu, đồng hồ, tranh, cửa sổ, cây. */
const Classroom: FC<BackgroundProps> = ({ lightShaft = false }) => (
  <g>
    <defs>
      <linearGradient id="mk-class-wall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#e4efe9" />
        <stop offset="1" stopColor="#cfe0d8" />
      </linearGradient>
      <linearGradient id="mk-class-floor" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#c9cfd2" />
        <stop offset="1" stopColor="#aab2b6" />
      </linearGradient>
      <linearGradient id="mk-class-beam" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fff6dc" stopOpacity="0.5" />
        <stop offset="1" stopColor="#fff6dc" stopOpacity="0" />
      </linearGradient>
      <radialGradient id="mk-class-light" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#fffbe8" stopOpacity="0.55" />
        <stop offset="1" stopColor="#fffbe8" stopOpacity="0" />
      </radialGradient>
    </defs>
    <rect x={0} y={0} width={1080} height={1920} fill="#b9cbc3" />
    <polygon points={`0,0 1080,0 ${BACK.x2},${BACK.y1} ${BACK.x1},${BACK.y1}`} fill="#eef3ef" />
    <polygon points={`0,0 ${BACK.x1},${BACK.y1} ${BACK.x1},${BACK.y2} 0,1920`} fill="#c4d6ce" />
    <polygon
      points={`1080,0 ${BACK.x2},${BACK.y1} ${BACK.x2},${BACK.y2} 1080,1920`}
      fill="#bed1c8"
    />
    <rect
      x={BACK.x1}
      y={BACK.y1}
      width={BACK.x2 - BACK.x1}
      height={BACK.y2 - BACK.y1}
      fill="url(#mk-class-wall)"
    />
    <polygon
      points={`${BACK.x1},${BACK.y2} ${BACK.x2},${BACK.y2} 1080,1920 0,1920`}
      fill="url(#mk-class-floor)"
    />
    <rect x={-200} y={1915} width={1480} height={700} fill="#aab2b6" />
    {floorTiles()}
    {/* đèn trần và quầng sáng */}
    <ellipse cx={540} cy={560} rx={360} ry={160} fill="url(#mk-class-light)" />
    <rect
      x={430}
      y={250}
      width={220}
      height={26}
      rx={10}
      fill="#f7f4ea"
      stroke={INK}
      strokeWidth={4}
    />
    {/* bảng đen, khung gỗ, máng phấn */}
    <rect
      x={BOARD.x - 14}
      y={BOARD.y - 14}
      width={BOARD.width + 28}
      height={BOARD.height + 28}
      rx={8}
      fill={PALETTE.wood}
      stroke={INK}
      strokeWidth={5}
    />
    <rect x={BOARD.x} y={BOARD.y} width={BOARD.width} height={BOARD.height} fill="#2f4f45" />
    <rect
      x={BOARD.x + 20}
      y={BOARD.y + BOARD.height + 14}
      width={160}
      height={12}
      fill={PALETTE.woodDark}
    />
    <rect
      x={BOARD.x + 40}
      y={BOARD.y + BOARD.height + 8}
      width={30}
      height={8}
      rx={3}
      fill="#f7f4ea"
    />
    {/* đồng hồ */}
    <circle cx={540} cy={530} r={34} fill={PALETTE.paper} stroke={INK} strokeWidth={5} />
    <line x1={540} y1={530} x2={540} y2={508} stroke={INK} strokeWidth={4} />
    <line x1={540} y1={530} x2={556} y2={538} stroke={INK} strokeWidth={4} />
    {/* tranh trên tường bên trái, cửa sổ trên tường bên phải */}
    <polygon points="40,700 120,740 120,900 40,890" fill="#f2c14e" stroke={INK} strokeWidth={4} />
    <polygon
      points="955,640 1050,580 1050,900 955,920"
      fill="#bfe3ff"
      stroke={INK}
      strokeWidth={6}
    />
    <line x1={1002} y1={612} x2={1002} y2={910} stroke={INK} strokeWidth={4} />
    {/* bàn giáo viên, quả địa cầu, chồng sách và bóng */}
    <ellipse cx={250} cy={1520} rx={210} ry={16} fill="#000" opacity={0.2} />
    <rect
      x={70}
      y={1300}
      width={360}
      height={30}
      fill={PALETTE.wood}
      stroke={INK}
      strokeWidth={5}
    />
    <rect x={90} y={1330} width={320} height={180} fill="#9c6c47" stroke={INK} strokeWidth={5} />
    <line x1={250} y1={1340} x2={250} y2={1500} stroke={INK} strokeWidth={3} opacity={0.5} />
    <circle cx={150} cy={1236} r={44} fill="#4f9fd6" stroke={INK} strokeWidth={5} />
    <path d="M 128 1210 q 20 10 12 30 q 18 6 30 -4" fill="#7fc06a" stroke={INK} strokeWidth={3} />
    <rect x={142} y={1280} width={16} height={20} fill={PALETTE.woodDark} />
    <rect x={300} y={1270} width={90} height={14} fill="#c0504d" stroke={INK} strokeWidth={3} />
    <rect x={306} y={1256} width={80} height={14} fill="#4f81bd" stroke={INK} strokeWidth={3} />
    {/* cây góc phải */}
    <ellipse cx={940} cy={1462} rx={58} ry={10} fill="#000" opacity={0.25} />
    <rect
      x={900}
      y={1360}
      width={80}
      height={100}
      rx={10}
      fill="#c8693c"
      stroke={INK}
      strokeWidth={5}
    />
    <ellipse cx={925} cy={1320} rx={30} ry={56} fill="#5f9e4f" stroke={INK} strokeWidth={4} />
    <ellipse cx={962} cy={1316} rx={28} ry={58} fill="#6cb05a" stroke={INK} strokeWidth={4} />
    {lightShaft ? (
      <polygon points="955,640 1050,580 640,1700 260,1700" fill="url(#mk-class-beam)" />
    ) : null}
  </g>
);

export const bgClassroom: BackgroundAsset = {
  stage: {
    groundY: 1580,
    actorScale: 1.7,
    slots: { left: 310, center: 540, right: 770 },
    trioSlots: { left: 230, center: 540, right: 850 },
    bounds: { x0: 0, x1: 1080, y0: 0, y1: 2615 },
    board: BOARD,
  },
  Component: Classroom,
};
