/**
 * Spike P6-03: bối cảnh phòng ở ba mức chi tiết, trong hệ tọa độ thế giới 1080×1920.
 * Mức 1: nền phẳng. Mức 2: phòng phối cảnh một điểm tụ, khoảng 20 hình. Mức 3: mức 2 cộng đồ vật,
 * vệt sáng có nguồn, bóng tiếp xúc, bụi trong nắng, tiền cảnh làm mờ.
 */
import type { FC, ReactNode } from "react";

export type DetailLevel = 1 | 2 | 3;

/** Số giả ngẫu nhiên tất định theo (seed, i), thay cho Math.random để render lại ra cùng kết quả. */
export function rnd(seed: number, i: number): number {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const VP = { x: 540, y: 900 };
const BACK = { x1: 180, y1: 520, x2: 900, y2: 1250 };
const INK = "#2a2420";

const Defs: FC = () => (
  <defs>
    <linearGradient id="p603-wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#efe3cf" />
      <stop offset="1" stopColor="#dccbb0" />
    </linearGradient>
    <linearGradient id="p603-floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#b88c5e" />
      <stop offset="1" stopColor="#8f6740" />
    </linearGradient>
    <linearGradient id="p603-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#ffd7a1" />
      <stop offset="1" stopColor="#ffb27a" />
    </linearGradient>
    <linearGradient id="p603-beam" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#fff2cf" stopOpacity="0.55" />
      <stop offset="1" stopColor="#fff2cf" stopOpacity="0" />
    </linearGradient>
    <radialGradient id="p603-lamp" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor="#ffe9a8" stopOpacity="0.85" />
      <stop offset="1" stopColor="#ffe9a8" stopOpacity="0" />
    </radialGradient>
    <radialGradient id="p603-veil" cx="0.5" cy="0.55" r="0.75">
      <stop offset="0.45" stopColor="#120c08" stopOpacity="0" />
      <stop offset="1" stopColor="#120c08" stopOpacity="0.62" />
    </radialGradient>
    <filter id="p603-blur" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="9" />
    </filter>
  </defs>
);

const Shell: FC = () => (
  <>
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
      fill="url(#p603-wall)"
    />
    <polygon
      points={`${BACK.x1},${BACK.y2} ${BACK.x2},${BACK.y2} 1080,1920 0,1920`}
      fill="url(#p603-floor)"
    />
    {/* Sàn kéo dài dưới mép khung: camera rộng và góc cao nhìn thấy phần này. */}
    <rect x={-200} y={1915} width={1480} height={700} fill="#8f6740" />
  </>
);

function planks(): ReactNode[] {
  const out: ReactNode[] = [];
  for (let i = 0; i <= 8; i++) {
    const xBack = BACK.x1 + ((BACK.x2 - BACK.x1) * i) / 8;
    const xFront = (1080 * i) / 8;
    out.push(
      <line
        key={`pl${i}`}
        x1={xBack}
        y1={BACK.y2}
        x2={xFront}
        y2={1920}
        stroke="#7a5634"
        strokeWidth={2}
        opacity={0.5}
      />,
    );
  }
  return out;
}

/** Mức 2: khoảng 20 hình. */
const Furniture: FC = () => (
  <>
    {planks()}
    {/* cửa sổ trên tường sau */}
    <rect
      x={600}
      y={640}
      width={220}
      height={260}
      fill="url(#p603-sky)"
      stroke={INK}
      strokeWidth={6}
    />
    <line x1={710} y1={640} x2={710} y2={900} stroke={INK} strokeWidth={5} />
    <line x1={600} y1={770} x2={820} y2={770} stroke={INK} strokeWidth={5} />
    {/* kệ sách */}
    <rect x={230} y={700} width={220} height={14} fill="#6b4a2e" stroke={INK} strokeWidth={3} />
    {["#c0504d", "#4f81bd", "#9bbb59", "#f79646", "#8064a2", "#4bacc6"].map((c, i) => (
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
    <rect x={300} y={820} width={120} height={90} fill="#f6efe2" stroke={INK} strokeWidth={5} />
    <path d="M 310 900 L 345 850 L 370 880 L 390 860 L 410 900 Z" fill="#7fb37a" />
    {/* bàn và đèn bàn */}
    <polygon
      points="120,1290 470,1290 520,1360 60,1360"
      fill="#8b5e3c"
      stroke={INK}
      strokeWidth={5}
    />
    <rect x={85} y={1360} width={18} height={170} fill="#6b4a2e" />
    <rect x={480} y={1360} width={18} height={170} fill="#6b4a2e" />
    <line x1={170} y1={1290} x2={190} y2={1180} stroke={INK} strokeWidth={6} />
    <polygon
      points="150,1180 240,1180 220,1130 170,1130"
      fill="#f2c14e"
      stroke={INK}
      strokeWidth={5}
    />
    {/* chậu cây */}
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
  </>
);

/** Mức 3: thêm khoảng 20 hình, ánh sáng có nguồn, bóng tiếp xúc, bụi. */
const Extras: FC<{ frame: number }> = ({ frame }) => {
  const dust: ReactNode[] = [];
  for (let i = 0; i < 30; i++) {
    const bx = 600 + rnd(3, i) * 300;
    const by = 900 + rnd(7, i) * 600;
    const drift = (frame * (0.15 + rnd(11, i) * 0.3)) % 120;
    dust.push(
      <circle
        key={`d${i}`}
        cx={bx + Math.sin((frame + i * 13) / 25) * 12}
        cy={by - drift}
        r={1.5 + rnd(5, i) * 2.5}
        fill="#fff6d8"
        opacity={0.35 + rnd(9, i) * 0.4}
      />,
    );
  }
  return (
    <>
      {/* thảm, ghế, đồng hồ, cốc, chồng sách, dây điện */}
      <ellipse cx={560} cy={1640} rx={360} ry={110} fill="#a24d4d" opacity={0.85} />
      <ellipse
        cx={560}
        cy={1640}
        rx={300}
        ry={80}
        fill="none"
        stroke="#e7c48d"
        strokeWidth={6}
        opacity={0.8}
      />
      <circle cx={760} cy={600} r={42} fill="#f6efe2" stroke={INK} strokeWidth={5} />
      <line x1={760} y1={600} x2={760} y2={572} stroke={INK} strokeWidth={4} />
      <line x1={760} y1={600} x2={782} y2={608} stroke={INK} strokeWidth={4} />
      <rect
        x={380}
        y={1240}
        width={34}
        height={44}
        rx={6}
        fill="#e9e4da"
        stroke={INK}
        strokeWidth={4}
      />
      <rect x={300} y={1262} width={70} height={14} fill="#4f81bd" stroke={INK} strokeWidth={3} />
      <rect x={306} y={1248} width={62} height={14} fill="#c0504d" stroke={INK} strokeWidth={3} />
      <rect x={312} y={1234} width={56} height={14} fill="#9bbb59" stroke={INK} strokeWidth={3} />
      <path d="M 190 1290 C 220 1420 120 1480 160 1560" fill="none" stroke={INK} strokeWidth={4} />
      <polygon
        points="560,1380 700,1380 720,1440 540,1440"
        fill="#7a5a3a"
        stroke={INK}
        strokeWidth={5}
      />
      <rect x={555} y={1440} width={14} height={110} fill="#5e4329" />
      <rect x={692} y={1440} width={14} height={110} fill="#5e4329" />
      <rect
        x={570}
        y={1260}
        width={120}
        height={120}
        rx={10}
        fill="#8a6745"
        stroke={INK}
        strokeWidth={5}
      />
      {/* bóng tiếp xúc dưới đồ vật */}
      <ellipse cx={290} cy={1535} rx={240} ry={18} fill="#000" opacity={0.25} />
      <ellipse cx={630} cy={1555} rx={110} ry={12} fill="#000" opacity={0.25} />
      <ellipse cx={925} cy={1432} rx={60} ry={10} fill="#000" opacity={0.3} />
      {/* vệt nắng từ cửa sổ và quầng đèn bàn */}
      <polygon points="600,900 820,900 1000,1700 420,1700" fill="url(#p603-beam)" />
      <ellipse cx={195} cy={1230} rx={260} ry={200} fill="url(#p603-lamp)" />
      {dust}
    </>
  );
};

export const Room: FC<{ level: DetailLevel; frame: number }> = ({ level, frame }) => {
  if (level === 1) {
    return (
      <>
        <Defs />
        <rect x={0} y={0} width={1080} height={1920} fill="#e8dcc8" />
        <rect x={-200} y={1250} width={1480} height={1400} fill="#c9a97f" />
        <line x1={0} y1={1250} x2={1080} y2={1250} stroke={INK} strokeWidth={4} opacity={0.4} />
      </>
    );
  }
  return (
    <>
      <Defs />
      <Shell />
      <Furniture />
      {level === 3 ? <Extras frame={frame} /> : null}
    </>
  );
};

/** Mức 3 vẽ thêm tấm che tối các góc và tiền cảnh mờ phía trên nhân vật. */
export const Foreground: FC<{ level: DetailLevel; blur: boolean }> = ({ level, blur }) =>
  level === 3 ? (
    <>
      <rect x={0} y={0} width={1080} height={1920} fill="url(#p603-veil)" />
      <g filter={blur ? "url(#p603-blur)" : undefined} opacity={blur ? 1 : 0.85}>
        <ellipse
          cx={60}
          cy={1780}
          rx={120}
          ry={230}
          fill="#3f6f35"
          transform="rotate(18 60 1780)"
        />
        <ellipse
          cx={150}
          cy={1840}
          rx={90}
          ry={200}
          fill="#4d8240"
          transform="rotate(-10 150 1840)"
        />
      </g>
    </>
  ) : null;

export const VANISHING_POINT = VP;
