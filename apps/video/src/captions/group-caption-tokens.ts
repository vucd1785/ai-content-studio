import type { RemotionCaption } from "@studio/contracts";

const DEFAULT_WINDOW_MS = 1200;

export type CaptionDisplayGroup = {
  startMs: number;
  endMs: number;
  tokens: RemotionCaption[];
};

/**
 * Groups word-level captions into ~windowMs display lines without altering token timings.
 */
export function groupCaptionTokens(
  captions: RemotionCaption[],
  windowMs: number = DEFAULT_WINDOW_MS,
): CaptionDisplayGroup[] {
  if (captions.length === 0) {
    return [];
  }

  const sorted = [...captions].sort((a, b) => a.startMs - b.startMs);
  const groups: CaptionDisplayGroup[] = [];
  let current: RemotionCaption[] = [];
  let windowStart = sorted[0]?.startMs ?? 0;

  for (const token of sorted) {
    if (current.length === 0) {
      windowStart = token.startMs;
      current.push(token);
      continue;
    }
    if (token.startMs - windowStart >= windowMs) {
      groups.push(finishGroup(current));
      current = [token];
      windowStart = token.startMs;
    } else {
      current.push(token);
    }
  }

  if (current.length > 0) {
    groups.push(finishGroup(current));
  }

  return groups;
}

function finishGroup(tokens: RemotionCaption[]): CaptionDisplayGroup {
  const startMs = tokens[0]?.startMs ?? 0;
  const endMs = tokens.reduce((max, token) => Math.max(max, token.endMs), startMs);
  return { startMs, endMs, tokens };
}

export function findActiveToken(
  captions: RemotionCaption[],
  timeMs: number,
): RemotionCaption | undefined {
  for (const token of captions) {
    if (timeMs >= token.startMs && timeMs < token.endMs) {
      return token;
    }
  }
  return undefined;
}

export function findActiveGroup(
  groups: CaptionDisplayGroup[],
  timeMs: number,
): CaptionDisplayGroup | undefined {
  for (const group of groups) {
    if (timeMs >= group.startMs && timeMs < group.endMs) {
      return group;
    }
  }
  return undefined;
}

/** Giới hạn một khung phụ đề theo cụm nghĩa (ADR-014 bổ sung 2026-11-12): khoảng hai dòng ở cỡ chữ 58. */
export const PHRASE_MAX_CHARS = 42;
export const PHRASE_MAX_MS = 2600;
/** Cụm ngắn hơn số ký tự này không tự kết thúc ở dấu câu, để "Ực ực!" đi cùng vế sau. */
export const PHRASE_MIN_CHARS = 10;
/** Khoảng lặng giữa hai từ dài hơn mức này thì sang khung mới. */
export const PHRASE_GAP_MS = 450;

const PHRASE_END = /[.!?…,;:]["”')]*\s*$/;

const groupText = (tokens: readonly RemotionCaption[]) =>
  tokens
    .map((t) => t.text)
    .join("")
    .trim();

/**
 * Chia phụ đề theo cụm nghĩa: ngắt ở dấu câu, khi đổi người nói, khi ngừng lâu, hoặc khi khung đã đủ dài
 * (`PHRASE_MAX_CHARS`, `PHRASE_MAX_MS`). Không đổi thời điểm của từ.
 */
export function groupCaptionPhrases(captions: readonly RemotionCaption[]): CaptionDisplayGroup[] {
  const sorted = [...captions].sort((a, b) => a.startMs - b.startMs);
  const groups: CaptionDisplayGroup[] = [];
  let current: RemotionCaption[] = [];
  const flush = () => {
    if (current.length > 0) {
      groups.push(finishGroup(current));
      current = [];
    }
  };
  /** Tối đa hai từ nữa là hết câu và vẫn vừa khung nới thêm: giữ chung khung thay vì để vế cụt. */
  const endsSoon = (index: number) => {
    const next = sorted.slice(index, index + 2);
    const end = next.findIndex(
      (t) => PHRASE_END.test(t.text) && t.speaker === sorted[index]?.speaker,
    );
    return end === -1
      ? false
      : groupText([...current, ...next.slice(0, end + 1)]).length <= PHRASE_MAX_CHARS + 12;
  };
  for (const [index, token] of sorted.entries()) {
    const last = current[current.length - 1];
    const first = current[0];
    if (last !== undefined && first !== undefined) {
      const tooLong =
        (groupText([...current, token]).length > PHRASE_MAX_CHARS ||
          token.endMs - first.startMs > PHRASE_MAX_MS) &&
        !endsSoon(index);
      if (token.speaker !== last.speaker || token.startMs - last.endMs > PHRASE_GAP_MS || tooLong) {
        flush();
      }
    }
    current.push(token);
    if (PHRASE_END.test(token.text) && groupText(current).length >= PHRASE_MIN_CHARS) {
      flush();
    }
  }
  flush();
  // Từ cuối câu bị tách lẻ (một từ ngắn) thì nhập lại vào khung trước nếu còn chỗ.
  const merged: CaptionDisplayGroup[] = [];
  for (const group of groups) {
    const prev = merged[merged.length - 1];
    if (
      prev !== undefined &&
      group.tokens.length === 1 &&
      prev.tokens[0]?.speaker === group.tokens[0]?.speaker &&
      group.startMs - prev.endMs <= PHRASE_GAP_MS &&
      !PHRASE_END.test(prev.tokens[prev.tokens.length - 1]?.text ?? "") &&
      groupText([...prev.tokens, ...group.tokens]).length <= PHRASE_MAX_CHARS + 8
    ) {
      merged[merged.length - 1] = finishGroup([...prev.tokens, ...group.tokens]);
    } else {
      merged.push(group);
    }
  }
  return merged;
}

/**
 * Khung phụ đề đang hiện: khung chứa thời điểm, hoặc khung vừa xong còn giữ thêm `holdMs` (không quá lúc khung
 * sau bắt đầu) để chữ không nháy tắt giữa hai cụm.
 */
export function findDisplayedGroup(
  groups: readonly CaptionDisplayGroup[],
  timeMs: number,
  holdMs = 400,
): CaptionDisplayGroup | undefined {
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i] as CaptionDisplayGroup;
    const nextStart = groups[i + 1]?.startMs ?? Number.POSITIVE_INFINITY;
    if (timeMs >= group.startMs && timeMs < Math.min(group.endMs + holdMs, nextStart)) {
      return group;
    }
  }
  return undefined;
}
