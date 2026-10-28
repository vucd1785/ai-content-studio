"""PCM tail verification for bounded silence-aware alignment gate (ADR-012)."""

from __future__ import annotations

import math
import struct
import wave
from pathlib import Path

GATE_POLICY_VERSION = "2.0.0-silence-aware"
STRICT_COVERAGE_MS = 250
MAX_SILENCE_EXCEPTION_TRAILING_MS = 400
SILENCE_PEAK_THRESHOLD_DBFS = -40.0
TAIL_WINDOW_MS = 50


def _peak_dbfs(samples: list[int]) -> float:
    if not samples:
        return float("-inf")
    peak = max(abs(s) for s in samples)
    return 20 * math.log10(peak / 32768.0 + 1e-12)


def verify_trailing_silence(
    wav_path: Path,
    tail_start_ms: int,
    duration_ms: int,
    *,
    peak_threshold_dbfs: float = SILENCE_PEAK_THRESHOLD_DBFS,
    window_ms: int = TAIL_WINDOW_MS,
) -> tuple[bool, str | None]:
    """
    True when every window in [tail_start_ms, duration_ms) has peak below threshold.
    Fail closed on I/O errors or invalid bounds.
    """
    if not wav_path.is_file():
        return False, "wav_missing"
    if tail_start_ms < 0 or duration_ms <= 0 or tail_start_ms >= duration_ms:
        return False, "invalid_tail_bounds"

    trailing_ms = duration_ms - tail_start_ms
    if trailing_ms > MAX_SILENCE_EXCEPTION_TRAILING_MS:
        return False, "trailing_exceeds_max_exception"

    try:
        with wave.open(str(wav_path), "rb") as wf:
            rate = wf.getframerate()
            nch = wf.getnchannels()
            sw = wf.getsampwidth()
            if sw != 2 or rate <= 0:
                return False, "unsupported_wav_format"
            nframes = wf.getnframes()
            raw = wf.readframes(nframes)
    except (OSError, wave.Error) as exc:
        return False, f"wav_read_failed:{exc}"

    if len(raw) < 2:
        return False, "empty_pcm"

    samples = struct.unpack("<" + "h" * (len(raw) // 2), raw)
    if nch > 1:
        samples = samples[::nch]

    file_duration_ms = int(round(nframes / rate * 1000))
    if abs(file_duration_ms - duration_ms) > 2:
        duration_ms = file_duration_ms
        trailing_ms = duration_ms - tail_start_ms
        if trailing_ms > MAX_SILENCE_EXCEPTION_TRAILING_MS:
            return False, "trailing_exceeds_max_exception"

    cursor = tail_start_ms
    while cursor < duration_ms:
        end_ms = min(cursor + window_ms, duration_ms)
        s0 = int(cursor / 1000 * rate)
        s1 = max(s0 + 1, int(end_ms / 1000 * rate))
        seg = samples[s0:s1]
        if not seg:
            return False, "inconclusive_empty_window"
        if _peak_dbfs(seg) >= peak_threshold_dbfs:
            return False, "audible_energy_in_tail"
        cursor = end_ms

    return True, None
