/**
 * Tách và chuẩn hóa từ giống service alignment (`services/tts/app/alignment/tokenize.py`,
 * `whisper_backend._normalize_token`), để `cutOnWord` của shot so được với từ đã căn.
 */

/** Tách từ theo khoảng trắng; gạch ngang dài thành khoảng trắng; dấu câu đứng riêng gộp vào từ trước. */
export function tokenizeWords(text: string): string[] {
  const stripped = text.replace(/[——]/g, " ").replace(/\s+/g, " ").trim();
  if (stripped === "") {
    return [];
  }
  const merged: string[] = [];
  for (const tok of stripped.split(" ")) {
    const last = merged.length - 1;
    if (!/[\p{L}\p{N}_]/u.test(tok) && last >= 0) {
      merged[last] = `${merged[last]}${tok}`;
    } else {
      merged.push(tok);
    }
  }
  return merged;
}

/** Chữ thường, bỏ mọi ký tự không phải chữ, số, `_` (giữ dấu tiếng Việt). */
export function normalizeWord(token: string): string {
  return token
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}_]/gu, "");
}

/** Từ đã chuẩn hóa của một câu, bỏ từ rỗng sau chuẩn hóa. */
export function normalizedWords(text: string): string[] {
  return tokenizeWords(text)
    .map(normalizeWord)
    .filter((w) => w !== "");
}
