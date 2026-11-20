import type { MotionAssetKind } from "@studio/contracts";
import type { CatalogEntry } from "./script-v2-prompt.js";

/**
 * Chọn tài sản đưa vào prompt script `2` (ADR-017 mục 1): danh mục không dài theo kho.
 *
 * - Loại diễn xuất (nhân vật, hành động, tư thế, biểu cảm, góc máy) dùng cho mọi chủ đề: lấy hết, tối đa `cap`,
 *   tài sản khớp brief xếp trước.
 * - Loại theo ngữ cảnh (bối cảnh, đồ vật, …) chỉ lấy khi khớp brief/research (điểm ≥ `MIN_CONTEXT_SCORE`);
 *   bối cảnh luôn có ít nhất `minimum` cái để cảnh nào cũng dựng được.
 */
type KindRule = { cap: number; contextual: boolean; minimum: number };

const RULES: Record<MotionAssetKind, KindRule> = {
  character_skin: { cap: 12, contextual: false, minimum: 0 },
  // ADR-025: thêm sáu hành động và ba góc máy làm tay; trần đủ để không bỏ hành động nào của kit.
  action: { cap: 16, contextual: false, minimum: 0 },
  pose: { cap: 8, contextual: false, minimum: 0 },
  expression: { cap: 10, contextual: false, minimum: 0 },
  camera: { cap: 10, contextual: false, minimum: 0 },
  // Ba bối cảnh gốc luôn có: lớp học, phòng, và đồng cỏ ngoài trời ba lớp (ADR-023).
  background: { cap: 4, contextual: true, minimum: 3 },
  prop: { cap: 8, contextual: true, minimum: 0 },
  sfx: { cap: 8, contextual: true, minimum: 0 },
  brand_card: { cap: 2, contextual: true, minimum: 0 },
};

/** Luôn trong danh mục khi kho có: cảnh mời theo dõi do code dựng bằng các tài sản này (ADR-026). */
export const PINNED_ASSET_IDS: ReadonlySet<string> = new Set([
  "action_follow",
  "expr_happy",
  "cam_end_card",
  "cam_push_in",
]);

const DEFAULT_RULE: KindRule = { cap: 8, contextual: true, minimum: 0 };
/** Cờ quốc gia: tối đa 6 nước mỗi video, chỉ khi brief, research hoặc ghi chú nhắc tới nước đó. */
const FLAG_RULE: KindRule = { cap: 6, contextual: true, minimum: 0 };
const isFlag = (a: CatalogEntry) => a.id.startsWith("flag_");

/** Tag một âm tiết ("người", "tải") dễ khớp nhầm nên chỉ được 1 điểm; tag nhiều âm tiết được 2. */
export const MIN_CONTEXT_SCORE = 2;

/** Chữ thường, NFC, mọi dấu câu thành khoảng trắng, bao bằng khoảng trắng để so cả cụm từ. */
export function normalizeText(text: string): string {
  const cleaned = text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return ` ${cleaned} `;
}

/** Điểm khớp của một tài sản với văn bản đã chuẩn hóa: cộng theo tag xuất hiện nguyên cụm. */
export function relevanceScore(entry: CatalogEntry, normalizedText: string): number {
  let score = 0;
  for (const tag of entry.tags) {
    const t = normalizeText(tag);
    if (t.trim() === "" || !normalizedText.includes(t)) {
      continue;
    }
    // Cờ quốc gia (ADR-029): tên nước một âm tiết ("Chile", "Nga") cũng đủ để chọn cờ của nước đó.
    score += t.trim().includes(" ") || entry.id.startsWith("flag_") ? 2 : 1;
  }
  return score;
}

export type AssetSelection = {
  selected: CatalogEntry[];
  /** Tài sản `approved` bị bỏ vì không khớp hoặc vượt trần, để log và đo. */
  omitted: string[];
};

export function selectRelevantAssets(
  catalog: readonly CatalogEntry[],
  contextParts: readonly (string | undefined | null)[],
): AssetSelection {
  const text = normalizeText(contextParts.filter((p): p is string => !!p).join(" \n "));
  const selected: CatalogEntry[] = [];
  const omitted: string[] = [];
  const kinds = [...new Set(catalog.map((a) => a.kind))];
  // Cờ quốc gia (ADR-029) có suất riêng: không tranh trần đồ vật với hình vẽ của chủ đề, nước nào được nhắc
  // cũng có cờ trong danh mục.
  type Group = { kind: MotionAssetKind; rule: KindRule; pick: (a: CatalogEntry) => boolean };
  const groups = kinds.flatMap((kind): Group[] =>
    kind === "prop"
      ? [
          { kind, rule: RULES.prop, pick: (a: CatalogEntry) => !isFlag(a) },
          { kind, rule: FLAG_RULE, pick: isFlag },
        ]
      : [{ kind, rule: RULES[kind] ?? DEFAULT_RULE, pick: () => true }],
  );
  for (const { kind, rule, pick } of groups) {
    const ranked = catalog
      .filter((a) => a.kind === kind && pick(a))
      .map((a) => ({ a, score: relevanceScore(a, text) }))
      // Hòa điểm thì tài sản gốc của kit trước tài sản tự tạo: bối cảnh mặc định (phòng, lớp học) không bị
      // một bối cảnh riêng chủ đề cũ (bãi biển, mặt trăng) đẩy ra khỏi danh mục (lỗi 2026-11-11).
      .sort(
        (x, y) =>
          Number(PINNED_ASSET_IDS.has(y.a.id)) - Number(PINNED_ASSET_IDS.has(x.a.id)) ||
          y.score - x.score ||
          Number(x.a.generated === true) - Number(y.a.generated === true) ||
          x.a.id.localeCompare(y.a.id),
      );
    const keep = ranked.filter(
      (r, i) =>
        i < rule.cap && (!rule.contextual || r.score >= MIN_CONTEXT_SCORE || i < rule.minimum),
    );
    selected.push(...keep.map((r) => r.a));
    omitted.push(...ranked.filter((r) => !keep.includes(r)).map((r) => r.a.id));
  }
  return {
    selected: selected.sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id)),
    omitted: omitted.sort(),
  };
}
