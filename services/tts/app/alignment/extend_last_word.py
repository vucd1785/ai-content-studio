"""Kéo dài từ cuối theo năng lượng PCM (ADR-012, bổ sung 2026-11-04).

Whisper đôi khi cắt sớm từ cuối được kéo dài (câu cảm thán như "Chật quá!"): giọng còn vang
khoảng 300 ms sau `endMs`, nên độ lệch cuối vượt cổng dù mọi từ đã căn được. Từ cuối được dời
`endMs` tới chỗ tiếng nói dừng thật, chỉ khi năng lượng liền mạch và đoạn kéo dài có giới hạn.
"""

from __future__ import annotations

from pathlib import Path

from app.alignment.schema import AlignmentWord
from app.alignment.trailing_silence import (
    SILENCE_PEAK_THRESHOLD_DBFS,
    STRICT_COVERAGE_MS,
    TAIL_WINDOW_MS,
    read_mono_pcm16,
    window_peak_dbfs,
)

MAX_LAST_WORD_EXTENSION_MS = 500


def speech_end_after(
    wav_path: Path, start_ms: int, duration_ms: int
) -> tuple[int | None, str | None]:
    """Điểm tiếng nói dừng sau `start_ms`: cuối cửa sổ có tiếng liền mạch tính từ `start_ms`.

    Trả (None, lý do) khi không nên kéo dài: không đọc được WAV, cửa sổ đầu đã im, sau một đoạn im
    lại có tiếng (có thể là từ bị sót), hoặc tiếng kéo quá `MAX_LAST_WORD_EXTENSION_MS`.
    """
    pcm, reason = read_mono_pcm16(wav_path)
    if pcm is None:
        return None, reason
    samples, rate, nframes = pcm
    file_ms = int(round(nframes / rate * 1000))
    end_limit = min(duration_ms, file_ms)
    if start_ms < 0 or start_ms >= end_limit:
        return None, "invalid_tail_bounds"

    windows: list[tuple[int, bool]] = []
    cursor = start_ms
    while cursor < end_limit:
        win_end = min(cursor + TAIL_WINDOW_MS, end_limit)
        peak = window_peak_dbfs(samples, rate, cursor, win_end)
        if peak is None:
            return None, "inconclusive_empty_window"
        windows.append((win_end, peak >= SILENCE_PEAK_THRESHOLD_DBFS))
        cursor = win_end

    # Đoạn có tiếng phải bắt đầu ngay tại `start_ms` và liền mạch.
    loud_run = 0
    while loud_run < len(windows) and windows[loud_run][1]:
        loud_run += 1
    if loud_run == 0:
        return None, "no_energy_after_last_word"
    if any(loud for _end, loud in windows[loud_run:]):
        return None, "gap_before_energy"
    speech_end = windows[loud_run - 1][0]
    if speech_end - start_ms > MAX_LAST_WORD_EXTENSION_MS:
        return None, "extension_exceeds_max"
    return speech_end, None


def extend_last_word(
    words: list[AlignmentWord], duration_ms: int, wav_path: Path | None
) -> tuple[list[AlignmentWord], int]:
    """Trả bản sao (đã kéo dài nếu đủ điều kiện) và số ms đã kéo dài (0 nếu không sửa)."""
    out = [w.model_copy() for w in words]
    if wav_path is None or not out:
        return out, 0
    last = out[-1]
    if last.endMs <= last.startMs or duration_ms - last.endMs <= STRICT_COVERAGE_MS:
        return out, 0
    speech_end, _reason = speech_end_after(wav_path, last.endMs, duration_ms)
    if speech_end is None or speech_end <= last.endMs:
        return out, 0
    extended = speech_end - last.endMs
    last.endMs = speech_end
    return out, extended
