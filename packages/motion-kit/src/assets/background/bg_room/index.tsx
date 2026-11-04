import type { FC, ReactNode } from "react";
import { PALETTE } from "../../../palette.js";
import type { BackgroundAsset, BackgroundProps } from "../../../stage/types.js";

/** Tường sau của phòng phối cảnh một điểm tụ. */
const BACK = { x1: 180, y1: 520, x2: 900, y2: 1250 };
const INK = PALETTE.wallInk;

const Defs: FC = () => (
  <defs>
    <linearGradient id="mk-room-wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#efe3cf" />
      <stop offset="1" stopColor="#dccbb0" />
    </linearGradient>
    <linearGradient id="mk-room-floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#b88c5e" />
      <stop offset="1" stopColor="#8f6740" />
    </linearGradient>
    <linearGradient id="mk-room-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#ffd7a1" />
      <stop offset="1" stopColor="#ffb27a" />
    </linearGradient>
    <radialGradient id="mk-room-lamp" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor="#ffe9a8" stopOpacity="0.7" />
      <stop offset="1" stopColor="#ffe9a8" stopOpacity="0" />
    </radialGradient>
    <linearGradient id="mk-room-beam" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#fff2cf" stopOpacity="0.55" />
      <stop offset="1" stopColor="#fff2cf" stopOpacity="0" />
    </linearGradient>
  </defs>
);

function planks(): ReactNode[] {
  const out: ReactNode[] = [];
  for (let i = 0; i <= 8; i++) {
    out.push(
      <line
        key={`pl${i}`}
        x1={BACK.x1 + ((BACK.x2 - BACK.x1) * i) / 8}
        y1={BACK.y2}
        x2={(1080 * i) / 8}
        y2={1920}
        stroke="#7a5634"
        strokeWidth={2}
        opacity={0.5}
      />,
    );
  }
  return out;
}

const BOOKS = ["#c0504d", "#4f81bd", "#9bbb59", "#f79646", "#8064a2", "#4bacc6"];

/** Phòng mức chi tiết 2 (Director chốt sau P6-03): khoảng 20 hình, có bóng tiếp xúc và quầng đèn cục bộ. */
const Room: FC<BackgroundProps> = ({ lightShaft = false }) => (
  <g>
    <Defs />
    <rect x={0} y={0} width={1080} height={1920} fill="#cbb89a" />
    <polygon points={`0,0 1080,0 ${BACK.x2},${BACK.y1} ${BACK.x1},${BACK.y1}`} fill="#d9c7aa" />
    <polygon points={`0,0 ${BACK.x1},${BACK.y1} ${BACK.x1},${BACK.y2} 0,1920`} fill="#d3bf9f" />
    <polygon
      points={`1080,0 ${BACK.x2},${BACK.y1} ${BACK.x2},${BACK.y2} 1080,1920`}
      fill="#cdb898"
    />
    <rect
      x={BACK.x1}
      y={BACK.y1}
      width={BACK.x2 - BACK.x1}
      height={BACK.y2 - BACK.y1}
      fill="url(#mk-room-wall)"
    />
    <polygon
      points={`${BACK.x1},${BACK.y2} ${BACK.x2},${BACK.y2} 1080,1920 0,1920`}
      fill="url(#mk-room-floor)"
    />
    {/* Sàn kéo dài dưới mép khung: cỡ rộng và góc cao nhìn thấy phần này. */}
    <rect x={-200} y={1915} width={1480} height={700} fill="#8f6740" />
    {planks()}
    {/* cửa sổ */}
    <rect
      x={600}
      y={640}
      width={220}
      height={260}
      fill="url(#mk-room-sky)"
      stroke={INK}
      strokeWidth={6}
    />
    <line x1={710} y1={640} x2={710} y2={900} stroke={INK} strokeWidth={5} />
    <line x1={600} y1={770} x2={820} y2={770} stroke={INK} strokeWidth={5} />
    {/* kệ sách */}
    <rect
      x={230}
      y={700}
      width={220}
      height={14}
      fill={PALETTE.woodDark}
      stroke={INK}
      strokeWidth={3}
    />
    {BOOKS.map((c, i) => (
      <rect
        key={c}
        x={240 + i * 32}
        y={630 + (i % 2) * 8}
        width={26}
        height={70 - (i % 2) * 8}
        fill={c}
        stroke={INK}
        strokeWidth={3}
      />
    ))}
    {/* tranh */}
    <rect
      x={300}
      y={820}
      width={120}
      height={90}
      fill={PALETTE.paper}
      stroke={INK}
      strokeWidth={5}
    />
    <path d="M 310 900 L 345 850 L 370 880 L 390 860 L 410 900 Z" fill="#7fb37a" />
    {/* bàn, đèn bàn và quầng đèn cục bộ */}
    <ellipse cx={195} cy={1230} rx={190} ry={140} fill="url(#mk-room-lamp)" />
    <ellipse cx={290} cy={1535} rx={240} ry={18} fill="#000" opacity={0.22} />
    <polygon
      points="120,1290 470,1290 520,1360 60,1360"
      fill={PALETTE.wood}
      stroke={INK}
      strokeWidth={5}
    />
    <rect x={85} y={1360} width={18} height={170} fill={PALETTE.woodDark} />
    <rect x={480} y={1360} width={18} height={170} fill={PALETTE.woodDark} />
    <line x1={170} y1={1290} x2={190} y2={1180} stroke={INK} strokeWidth={6} />
    <polygon
      points="150,1180 240,1180 220,1130 170,1130"
      fill="#f2c14e"
      stroke={INK}
      strokeWidth={5}
    />
    {/* chậu cây và bóng */}
    <ellipse cx={925} cy={1432} rx={60} ry={10} fill="#000" opacity={0.25} />
    <rect
      x={880}
      y={1330}
      width={90}
      height={100}
      rx={10}
      fill="#c8693c"
      stroke={INK}
      strokeWidth={5}
    />
    <ellipse
      cx={905}
      cy={1290}
      rx={36}
      ry={60}
      fill="#5f9e4f"
      stroke={INK}
      strokeWidth={4}
      transform="rotate(-18 905 1290)"
    />
    <ellipse
      cx={950}
      cy={1280}
      rx={34}
      ry={64}
      fill="#6cb05a"
      stroke={INK}
      strokeWidth={4}
      transform="rotate(16 950 1280)"
    />
    {lightShaft ? (
      <polygon points="600,900 820,900 1000,1700 420,1700" fill="url(#mk-room-beam)" />
    ) : null}
  </g>
);

export const bgRoom: BackgroundAsset = {
  stage: {
    groundY: 1580,
    actorScale: 1.7,
    slots: { left: 310, center: 540, right: 770 },
    trioSlots: { left: 230, center: 540, right: 850 },
    bounds: { x0: 0, x1: 1080, y0: 0, y1: 2615 },
  },
  Component: Room,
};
