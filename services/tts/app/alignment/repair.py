"""Sửa từ có độ dài 0 trước khi validate (ADR-012, bổ sung 2026-11-02).

Whisper đôi khi gán `startMs == endMs` cho từ vay mượn hoặc từ rất ngắn (ví dụ "code", "về").
Từ đó được cho một khoảng ngắn để phụ đề hiển thị được; cổng vẫn tính tỷ lệ trên số từ đo được thật
(`repairedWordCount` bị trừ ra trong `gate.aligned_word_ratio_before_repair`).
"""

from __future__ import annotations

from pathlib import Path

from app.alignment.extend_last_word import extend_last_word
from app.alignment.schema import AlignmentValidation, AlignmentWord
from app.alignment.validate import validate_alignment

# Độ dài gán cho từ được sửa: gần một âm tiết tiếng Việt đọc nhanh.
REPAIR_TARGET_MS = 120
# Khoảng nhỏ nhất đủ để từ hiện trên phụ đề; ít hơn thì không sửa.
REPAIR_MIN_MS = 40


def repair_zero_length_words(
    words: list[AlignmentWord], duration_ms: int
) -> tuple[list[AlignmentWord], list[int]]:
    """Trả bản sao đã sửa và danh sách index được sửa. Không đổi thứ tự, không vượt `duration_ms`."""
    out = [w.model_copy() for w in words]
    repaired: list[int] = []
    for i, word in enumerate(out):
        if word.endMs > word.startMs:
            continue
        t = word.startMs
        prev = out[i - 1] if i > 0 else None
        nxt = out[i + 1] if i + 1 < len(out) else None
        prev_end = prev.endMs if prev else 0
        next_start = nxt.startMs if nxt else duration_ms
        if t < prev_end or t > next_start or t > duration_ms:
            # Từ nằm sai thứ tự: để validate báo lỗi như cũ.
            continue

        if next_start - t >= REPAIR_MIN_MS:
            word.endMs = t + min(next_start - t, REPAIR_TARGET_MS)
        elif t - prev_end >= REPAIR_MIN_MS:
            word.startMs = t - min(t - prev_end, REPAIR_TARGET_MS)
            word.endMs = t
        else:
            # Không có khoảng lặng: lấy bớt từ từ bên cạnh có cửa sổ dài hơn.
            right_window = (nxt.endMs - t) if nxt and nxt.endMs > t else 0
            left_window = (t - prev.startMs) if prev and t > prev.startMs else 0
            if max(right_window, left_window) < 2 * REPAIR_MIN_MS:
                continue
            if right_window >= left_window and nxt is not None:
                give = min(REPAIR_TARGET_MS, right_window // 2)
                word.endMs = t + give
                nxt.startMs = max(nxt.startMs, word.endMs)
            elif prev is not None:
                give = min(REPAIR_TARGET_MS, left_window // 2)
                word.startMs = t - give
                word.endMs = t
                prev.endMs = min(prev.endMs, word.startMs)
            else:
                continue
        repaired.append(i)
    return out, repaired


def validate_with_repair(
    words: list[AlignmentWord],
    expected_tokens: list[str],
    duration_ms: int,
    wav_path: Path | None = None,
) -> tuple[list[AlignmentWord], AlignmentValidation]:
    """Sửa từ độ dài 0, kéo dài từ cuối theo PCM nếu có `wav_path`, rồi validate.

    Ghi `repairedWordCount`, `lastWordExtendedMs` và một warning cho mỗi lần sửa.
    """
    fixed, repaired = repair_zero_length_words(words, duration_ms)
    fixed, extended_ms = extend_last_word(fixed, duration_ms, wav_path)
    validation = validate_alignment(fixed, expected_tokens, duration_ms)
    validation.repairedWordCount = len(repaired)
    validation.lastWordExtendedMs = extended_ms
    if extended_ms > 0:
        validation.warnings.append(
            f"extended last word {fixed[-1].text!r} by {extended_ms} ms to "
            f"{fixed[-1].endMs} ms (PCM energy)"
        )
    validation.warnings.extend(
        f"repaired zero-length interval at index {i}: {fixed[i].text!r} -> "
        f"{fixed[i].startMs}-{fixed[i].endMs} ms (estimated)"
        for i in repaired
    )
    return fixed, validation
