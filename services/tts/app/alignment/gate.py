from __future__ import annotations

from pathlib import Path

from app.alignment.schema import AlignmentArtifact, AlignmentWord
from app.alignment.trailing_silence import (
    GATE_POLICY_VERSION,
    MAX_SILENCE_EXCEPTION_TRAILING_MS,
    STRICT_COVERAGE_MS,
    verify_trailing_silence,
)


def aligned_word_ratio(words: list[AlignmentWord]) -> float:
    if not words:
        return 0.0
    valid = sum(1 for w in words if w.endMs > w.startMs)
    return valid / len(words)


def evaluate_go_gate(
    artifact: AlignmentArtifact,
    wav_path: Path | None = None,
) -> dict[str, object]:
    """Alignment quality gate; optional wav_path required for silence-aware exception."""
    ratio = aligned_word_ratio(artifact.words)
    validation_ok = artifact.validation.ok
    ratio_ok = ratio >= 0.9
    delta = artifact.validation.durationDeltaMs
    abs_delta = abs(delta) if delta is not None else None
    coverage_within_250 = abs_delta is not None and abs_delta <= STRICT_COVERAGE_MS

    trailing_silence_verified = False
    trailing_silence_ms: int | None = None
    coverage_acceptance_reason: str | None = None
    passes = False

    if not validation_ok or not ratio_ok:
        passes = False
    elif coverage_within_250:
        passes = True
        coverage_acceptance_reason = "within_250ms"
    elif (
        delta is not None
        and delta > STRICT_COVERAGE_MS
        and delta <= MAX_SILENCE_EXCEPTION_TRAILING_MS
    ):
        trailing_silence_ms = delta
        last_end = artifact.validation.coverageEndMs
        if wav_path is None or last_end is None:
            passes = False
        else:
            verified, _reason = verify_trailing_silence(
                wav_path,
                last_end,
                artifact.durationMs,
            )
            trailing_silence_verified = verified
            if verified:
                passes = True
                coverage_acceptance_reason = "verified_trailing_silence"
    else:
        passes = False

    return {
        "alignedWordRatio": round(ratio, 4),
        "durationDeltaMs": delta,
        "coverageWithin250Ms": coverage_within_250,
        "ratioAtLeast90Pct": ratio_ok,
        "validationOk": validation_ok,
        "passesGate": passes,
        "gatePolicyVersion": GATE_POLICY_VERSION,
        "trailingSilenceVerified": trailing_silence_verified,
        "trailingSilenceMs": trailing_silence_ms,
        "coverageAcceptanceReason": coverage_acceptance_reason,
    }
