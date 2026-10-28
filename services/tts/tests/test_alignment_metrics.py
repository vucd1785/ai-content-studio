from app.alignment.metrics import evaluate_go_gate
from app.alignment.schema import AlignmentArtifact, AlignmentValidation, AlignmentWord


def test_passes_gate_requires_validation_ok() -> None:
    words = [AlignmentWord(text="a", startMs=0, endMs=100)]
    validation_bad = AlignmentValidation(
        ok=False,
        errors=["invalid interval at index 0: 'a'"],
        warnings=[],
        wordCount=1,
        alignedWordCount=0,
        missingWords=["a"],
        coverageStartMs=0,
        coverageEndMs=0,
        durationDeltaMs=900,
        nonMonotonicWordRatio=0.0,
        timelineOrderRatio=1.0,
    )
    artifact = AlignmentArtifact(
        audioId="x",
        durationMs=1000,
        transcript="a",
        engine="whisper",
        modelId="base",
        words=words,
        validation=validation_bad,
        processingMs=1,
    )
    gate = evaluate_go_gate(artifact)
    assert gate["validationOk"] is False
    assert gate["passesGate"] is False


def test_passes_gate_true_when_structural_and_coverage_ok() -> None:
    words = [AlignmentWord(text="a", startMs=0, endMs=900)]
    validation = AlignmentValidation(
        ok=True,
        errors=[],
        warnings=[],
        wordCount=1,
        alignedWordCount=1,
        missingWords=[],
        coverageStartMs=0,
        coverageEndMs=900,
        durationDeltaMs=100,
        nonMonotonicWordRatio=0.0,
        timelineOrderRatio=1.0,
    )
    artifact = AlignmentArtifact(
        audioId="x",
        durationMs=1000,
        transcript="a",
        engine="whisper",
        modelId="base",
        words=words,
        validation=validation,
        processingMs=1,
    )
    gate = evaluate_go_gate(artifact)
    assert gate["passesGate"] is True
