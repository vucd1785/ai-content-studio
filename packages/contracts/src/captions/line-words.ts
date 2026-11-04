import type { AlignmentWord } from "../media/tts.js";
import { tokenizeWords } from "../script/words.js";

/**
 * Chia từ của cảnh về từng câu (ADR-015, bổ sung 2026-11-02). Cảnh được căn một lần; ranh giới câu
 * lấy từ vị trí ghép mà code biết chính xác.
 */

/** Dung sai (ms) cho từ nằm ngoài đoạn câu của nó; quá dung sai thì kẹp lại (spike P6-02 dùng ±120 ms). */
export const WORD_LINE_TOLERANCE_MS = 120;

/** Đoạn của một câu trong audio cảnh (ms, tính từ đầu WAV cảnh). */
export type LineSpan = {
  lineId: string;
  speaker: string;
  text: string;
  startMs: number;
  endMs: number;
};

export type LineWordWarning =
  | {
      code: "word_clamped_to_line";
      lineId: string;
      wordIndex: number;
      word: string;
      fromMs: [number, number];
      toMs: [number, number];
    }
  | { code: "word_line_count_mismatch"; expected: number; actual: number };

export type LineWordAssignment = {
  /** Từ của cảnh sau khi kẹp, cùng thứ tự và số lượng với đầu vào. */
  words: AlignmentWord[];
  /** `lineId` của từng từ. */
  lineIds: string[];
  /** Người nói của từng từ. */
  speakers: string[];
  warnings: LineWordWarning[];
};

/** Số từ của câu theo đúng cách tách transcript của service alignment. */
export function lineWordCount(text: string): number {
  return tokenizeWords(text).length;
}

/**
 * Gán mỗi từ cho một câu theo thứ tự token. Khi số từ đã căn khác tổng số token của các câu
 * (ví dụ service chuẩn hóa số khác đi), gán theo điểm giữa của từ và ghi `word_line_count_mismatch`.
 * Từ nằm ngoài đoạn câu quá `toleranceMs` được kẹp về trong đoạn, kèm `word_clamped_to_line`.
 */
export function assignWordsToLines(
  words: readonly AlignmentWord[],
  lines: readonly LineSpan[],
  toleranceMs = WORD_LINE_TOLERANCE_MS,
): LineWordAssignment {
  const warnings: LineWordWarning[] = [];
  const counts = lines.map((line) => lineWordCount(line.text));
  const expected = counts.reduce((sum, n) => sum + n, 0);
  const owner: number[] = [];
  if (expected === words.length) {
    counts.forEach((n, li) => {
      for (let k = 0; k < n; k++) {
        owner.push(li);
      }
    });
  } else {
    warnings.push({ code: "word_line_count_mismatch", expected, actual: words.length });
    let li = 0;
    for (const word of words) {
      const mid = (word.startMs + word.endMs) / 2;
      // Điểm giữa còn trước điểm giữa khoảng nghỉ tới câu sau thì vẫn thuộc câu hiện tại.
      while (li < lines.length - 1) {
        const cur = lines[li] as LineSpan;
        const next = lines[li + 1] as LineSpan;
        if (mid < (cur.endMs + next.startMs) / 2) {
          break;
        }
        li += 1;
      }
      owner.push(li);
    }
  }

  const out: AlignmentWord[] = [];
  const lineIds: string[] = [];
  const speakers: string[] = [];
  words.forEach((word, wi) => {
    const line = lines[owner[wi] ?? lines.length - 1] as LineSpan;
    lineIds.push(line.lineId);
    speakers.push(line.speaker);
    const outside =
      word.startMs < line.startMs - toleranceMs || word.endMs > line.endMs + toleranceMs;
    if (!outside) {
      out.push({ ...word });
      return;
    }
    let startMs = Math.min(Math.max(word.startMs, line.startMs), line.endMs - 1);
    let endMs = Math.min(Math.max(word.endMs, startMs + 1), line.endMs);
    if (endMs <= startMs) {
      startMs = Math.max(line.startMs, endMs - 1);
      endMs = startMs + 1;
    }
    warnings.push({
      code: "word_clamped_to_line",
      lineId: line.lineId,
      wordIndex: wi,
      word: word.text,
      fromMs: [word.startMs, word.endMs],
      toMs: [startMs, endMs],
    });
    out.push({ ...word, startMs, endMs });
  });
  return { words: out, lineIds, speakers, warnings };
}
