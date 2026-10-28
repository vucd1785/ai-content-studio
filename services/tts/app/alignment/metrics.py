from __future__ import annotations

from app.alignment.schema import AlignmentArtifact, AlignmentWord


def aligned_word_ratio(words: list[AlignmentWord]) -> float:
    if not words:
        return 0.0
    valid = sum(1 for w in words if w.endMs > w.startMs)
    return valid / len(words)


def evaluate_go_gate(artifact: AlignmentArtifact) -> dict[str, object]:
    """Cổng trong docs/05-VIDEO-PIPELINE.md (spike)."""
    ratio = aligned_word_ratio(artifact.words)
    delta = artifact.validation.durationDeltaMs
    abs_delta = abs(delta) if delta is not None else None
    coverage_ok = abs_delta is not None and abs_delta <= 250
    ratio_ok = ratio >= 0.9
    return {
        "alignedWordRatio": round(ratio, 4),
        "durationDeltaMs": delta,
        "coverageWithin250Ms": coverage_ok,
        "ratioAtLeast90Pct": ratio_ok,
        "passesGate": coverage_ok and ratio_ok,
    }
