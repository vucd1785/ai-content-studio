import { PALETTE } from "../palette.js";
import type { SkinSpec } from "./skin.js";

/**
 * Trang phục nhân vật (ADR-032): vẽ đè lên da của nhân vật khi câu chuyện cần (ra ngoài không gian, phòng thí
 * nghiệm, công trường, đóng vai lãnh đạo). Hình học của rig (tay, chân, khớp, vùng đầu) không đổi, nên mọi hành
 * động và kiểm tay-khuỷu vẫn đúng; trang phục chỉ tính từ các điểm neo của da nên Tí, Đậu, Bit đều mặc được.
 */
export type OutfitKind = "spacesuit" | "lab_coat" | "hard_hat" | "business_suit";

export const OUTFIT_KINDS: readonly OutfitKind[] = [
  "spacesuit",
  "lab_coat",
  "hard_hat",
  "business_suit",
];

const ink = PALETTE.ink;
const SUIT_WHITE = "#eef2f7";
const SUIT_GREY = "#c3ccd8";
const COAT_WHITE = "#fbfbf8";
const VEST_ORANGE = "#ff8a1f";
const REFLECT = "#eef4ff";
const HAT_YELLOW = "#ffc933";
const JACKET = "#2d3550";
const TIE_RED = "#d8402f";

/** Bán kính "bao" quanh đầu (hệ tọa độ đầu, gốc ở điểm neo). */
function headRadius(skin: SkinSpec): number {
  return skin.headZone.kind === "circle"
    ? skin.headZone.r
    : Math.hypot(skin.headZone.halfWidth, skin.headZone.halfHeight) * 0.86;
}

/** Đỉnh đầu (y âm) trong hệ tọa độ đầu. */
function headTop(skin: SkinSpec): number {
  return skin.headZone.kind === "circle" ? -skin.headZone.r : -skin.headZone.halfHeight;
}

/** Thân áo: từ cổ tới hông, rộng theo thân của nhân vật. */
function torsoBox(skin: SkinSpec) {
  const top = skin.neck.y + 4;
  const bottom = skin.hip.y + 14;
  const half = Math.min(64, Math.max(30, skin.bodyHalfWidth * 0.62));
  return { top, bottom, half, height: bottom - top };
}

const fmt = (n: number) => Number(n.toFixed(1));

function spacesuit(skin: SkinSpec): SkinSpec {
  const t = torsoBox(skin);
  const R = headRadius(skin) * 1.3;
  return {
    ...skin,
    limbColor: SUIT_GREY,
    limbWidth: skin.limbWidth + 6,
    torso: () => (
      <>
        {/* Ba lô dưỡng khí sau lưng (nhân vật nhìn sang phải, lưng ở bên trái). */}
        <rect
          x={fmt(-t.half - 18)}
          y={fmt(t.top - 6)}
          width={fmt(t.half * 0.8)}
          height={fmt(t.height * 0.8)}
          rx={10}
          fill={SUIT_GREY}
          stroke={ink}
          strokeWidth={5}
        />
        {skin.torso()}
        <rect
          x={fmt(-t.half)}
          y={fmt(t.top)}
          width={fmt(t.half * 2)}
          height={fmt(t.height)}
          rx={fmt(Math.min(24, t.half * 0.6))}
          fill={SUIT_WHITE}
          stroke={ink}
          strokeWidth={5}
        />
        <rect
          x={fmt(-t.half * 0.45)}
          y={fmt(t.top + t.height * 0.22)}
          width={fmt(t.half * 0.9)}
          height={fmt(t.height * 0.3)}
          rx={6}
          fill={PALETTE.metalDark}
          stroke={ink}
          strokeWidth={3}
        />
        <circle
          cx={fmt(-t.half * 0.2)}
          cy={fmt(t.top + t.height * 0.37)}
          r={fmt(Math.max(3, t.half * 0.09))}
          fill={PALETTE.alert}
        />
        <circle
          cx={fmt(t.half * 0.2)}
          cy={fmt(t.top + t.height * 0.37)}
          r={fmt(Math.max(3, t.half * 0.09))}
          fill={PALETTE.ok}
        />
        <rect
          x={fmt(t.half * 0.35)}
          y={fmt(t.top + 8)}
          width={fmt(t.half * 0.45)}
          height={fmt(t.half * 0.3)}
          rx={3}
          fill={PALETTE.shield}
        />
        <line
          x1={fmt(-t.half)}
          y1={fmt(t.bottom - 10)}
          x2={fmt(t.half)}
          y2={fmt(t.bottom - 10)}
          stroke={ink}
          strokeWidth={4}
        />
      </>
    ),
    head: (face) => (
      <>
        {skin.head(face)}
        {/* Mũ kính trong suốt và vòng cổ. */}
        <circle cx={0} cy={0} r={fmt(R)} fill={PALETTE.screen} opacity={0.18} />
        <circle cx={0} cy={0} r={fmt(R)} fill="none" stroke={ink} strokeWidth={6} />
        <path
          d={`M ${fmt(-R * 0.62)} ${fmt(-R * 0.45)} A ${fmt(R * 0.78)} ${fmt(R * 0.78)} 0 0 1 ${fmt(-R * 0.05)} ${fmt(-R * 0.8)}`}
          fill="none"
          stroke="#ffffff"
          strokeWidth={fmt(R * 0.08)}
          strokeLinecap="round"
          opacity={0.85}
        />
        <rect
          x={fmt(-R * 0.62)}
          y={fmt(R * 0.86)}
          width={fmt(R * 1.24)}
          height={fmt(R * 0.2)}
          rx={fmt(R * 0.08)}
          fill={SUIT_GREY}
          stroke={ink}
          strokeWidth={4}
        />
      </>
    ),
    hand: (p) => (
      <circle
        cx={p.x}
        cy={p.y}
        r={fmt(skin.handRadius + 3)}
        fill={SUIT_WHITE}
        stroke={ink}
        strokeWidth={4}
      />
    ),
    foot: (p, side) => (
      <rect
        x={fmt(p.x + side * 10 - 19)}
        y={fmt(p.y - 12)}
        width={38}
        height={18}
        rx={7}
        fill={SUIT_GREY}
        stroke={ink}
        strokeWidth={4}
      />
    ),
  };
}

function labCoat(skin: SkinSpec): SkinSpec {
  const t = torsoBox(skin);
  const bottom = t.bottom + 26;
  return {
    ...skin,
    torso: () => (
      <>
        {skin.torso()}
        <path
          d={`M ${fmt(-t.half * 0.7)} ${fmt(t.top)} L ${fmt(t.half * 0.7)} ${fmt(t.top)} L ${fmt(t.half * 1.05)} ${fmt(bottom)} L ${fmt(-t.half * 1.05)} ${fmt(bottom)} Z`}
          fill={COAT_WHITE}
          stroke={ink}
          strokeWidth={4.5}
          strokeLinejoin="round"
        />
        <path
          d={`M ${fmt(-t.half * 0.45)} ${fmt(t.top)} L 0 ${fmt(t.top + t.height * 0.4)} L ${fmt(t.half * 0.45)} ${fmt(t.top)}`}
          fill="#9fd3ff"
          stroke={ink}
          strokeWidth={4}
          strokeLinejoin="round"
        />
        <line
          x1={0}
          y1={fmt(t.top + t.height * 0.4)}
          x2={0}
          y2={fmt(bottom)}
          stroke={ink}
          strokeWidth={3}
        />
        <rect
          x={fmt(t.half * 0.25)}
          y={fmt(t.top + t.height * 0.55)}
          width={fmt(t.half * 0.5)}
          height={fmt(t.half * 0.35)}
          rx={3}
          fill="none"
          stroke={ink}
          strokeWidth={3}
        />
        <line
          x1={fmt(t.half * 0.35)}
          y1={fmt(t.top + t.height * 0.5)}
          x2={fmt(t.half * 0.35)}
          y2={fmt(t.top + t.height * 0.62)}
          stroke={PALETTE.shield}
          strokeWidth={4}
          strokeLinecap="round"
        />
      </>
    ),
  };
}

function hardHat(skin: SkinSpec): SkinSpec {
  const t = torsoBox(skin);
  const r = headRadius(skin);
  const top = headTop(skin);
  const brimY = top + r * 0.42;
  return {
    ...skin,
    torso: () => (
      <>
        {skin.torso()}
        <path
          d={`M ${fmt(-t.half * 0.85)} ${fmt(t.top)} L ${fmt(t.half * 0.85)} ${fmt(t.top)} L ${fmt(t.half * 0.9)} ${fmt(t.bottom)} L ${fmt(-t.half * 0.9)} ${fmt(t.bottom)} Z`}
          fill={VEST_ORANGE}
          stroke={ink}
          strokeWidth={4.5}
          strokeLinejoin="round"
        />
        {[0.45, 0.72].map((k) => (
          <rect
            key={k}
            x={fmt(-t.half * 0.88)}
            y={fmt(t.top + t.height * k)}
            width={fmt(t.half * 1.76)}
            height={fmt(Math.max(6, t.height * 0.09))}
            fill={REFLECT}
            stroke={ink}
            strokeWidth={2}
          />
        ))}
      </>
    ),
    head: (face) => (
      <>
        {skin.head(face)}
        <path
          d={`M ${fmt(-r * 0.95)} ${fmt(brimY)} A ${fmt(r * 0.95)} ${fmt(r * 0.9)} 0 0 1 ${fmt(r * 0.95)} ${fmt(brimY)} Z`}
          fill={HAT_YELLOW}
          stroke={ink}
          strokeWidth={5}
          strokeLinejoin="round"
        />
        <rect
          x={fmt(-r * 1.2)}
          y={fmt(brimY - 4)}
          width={fmt(r * 2.4)}
          height={12}
          rx={6}
          fill={HAT_YELLOW}
          stroke={ink}
          strokeWidth={4}
        />
        <line
          x1={0}
          y1={fmt(brimY - r * 0.82)}
          x2={0}
          y2={fmt(brimY - 4)}
          stroke={ink}
          strokeWidth={3}
          opacity={0.6}
        />
      </>
    ),
  };
}

function businessSuit(skin: SkinSpec): SkinSpec {
  const t = torsoBox(skin);
  return {
    ...skin,
    limbColor: skin.limbColor === ink ? JACKET : skin.limbColor,
    torso: () => (
      <>
        {skin.torso()}
        <path
          d={`M ${fmt(-t.half * 0.8)} ${fmt(t.top)} L ${fmt(t.half * 0.8)} ${fmt(t.top)} L ${fmt(t.half * 0.95)} ${fmt(t.bottom + 6)} L ${fmt(-t.half * 0.95)} ${fmt(t.bottom + 6)} Z`}
          fill={JACKET}
          stroke={ink}
          strokeWidth={4.5}
          strokeLinejoin="round"
        />
        <path
          d={`M ${fmt(-t.half * 0.4)} ${fmt(t.top)} L 0 ${fmt(t.top + t.height * 0.5)} L ${fmt(t.half * 0.4)} ${fmt(t.top)} Z`}
          fill="#ffffff"
          stroke={ink}
          strokeWidth={3}
          strokeLinejoin="round"
        />
        <path
          d={`M 0 ${fmt(t.top + 3)} L ${fmt(t.half * 0.1)} ${fmt(t.top + t.height * 0.12)} L 0 ${fmt(t.top + t.height * 0.42)} L ${fmt(-t.half * 0.1)} ${fmt(t.top + t.height * 0.12)} Z`}
          fill={TIE_RED}
          stroke={ink}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <circle cx={0} cy={fmt(t.top + t.height * 0.68)} r={3.5} fill={PALETTE.paper} />
      </>
    ),
  };
}

const OUTFITS: Record<OutfitKind, (skin: SkinSpec) => SkinSpec> = {
  spacesuit,
  lab_coat: labCoat,
  hard_hat: hardHat,
  business_suit: businessSuit,
};

/** Da của nhân vật khi mặc `outfit`; không có trang phục thì trả nguyên da. */
export function applyOutfit(skin: SkinSpec, outfit: OutfitKind | undefined): SkinSpec {
  return outfit === undefined ? skin : OUTFITS[outfit](skin);
}
