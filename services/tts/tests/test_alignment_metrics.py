import pytest

from app.alignment.gate import evaluate_go_gate
from app.alignment.schema import AlignmentArtifact, AlignmentValidation, AlignmentWord


def _artifact(delta: int, *, ok: bool = True) -> AlignmentArtifact:
    duration_ms = 1000 + delta
    coverage_end = 1000
    return AlignmentArtifact(
        audioId="b" * 32,
        durationMs=duration_ms,
        transcript="a",
        engine="whisper",
        modelId="base",
        words=[AlignmentWord(text="a", startMs=0, endMs=coverage_end)],
        validation=AlignmentValidation(
            ok=ok,
            errors=[] if ok else ["bad"],
            warnings=[],
            wordCount=1,
            alignedWordCount=1 if ok else 0,
            missingWords=[],
            coverageStartMs=0,
            coverageEndMs=coverage_end,
            durationDeltaMs=delta,
            nonMonotonicWordRatio=0.0,
            timelineOrderRatio=1.0,
        ),
        processingMs=1,
    )


def test_passes_gate_requires_validation_ok() -> None:
    gate = evaluate_go_gate(_artifact(100, ok=False), None)
    assert gate["validationOk"] is False
    assert gate["passesGate"] is False


def test_passes_gate_true_when_structural_and_coverage_ok() -> None:
    gate = evaluate_go_gate(_artifact(100), None)
    assert gate["passesGate"] is True
    assert gate["coverageAcceptanceReason"] == "within_250ms"
