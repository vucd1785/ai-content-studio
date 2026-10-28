import json
import struct
import wave
from pathlib import Path

import pytest

from app.alignment.gate import evaluate_go_gate
from app.alignment.schema import AlignmentArtifact, AlignmentValidation, AlignmentWord
from app.alignment.trailing_silence import (
    MAX_SILENCE_EXCEPTION_TRAILING_MS,
    STRICT_COVERAGE_MS,
    verify_trailing_silence,
)


def _write_wav_mono(
    path: Path,
    duration_ms: int,
    *,
    rate: int = 48_000,
    fill_amplitude: int = 0,
    speech_windows: list[tuple[int, int, int]] | None = None,
) -> None:
    """speech_windows: (start_ms, end_ms, peak amplitude 0..32767)."""
    n_samples = int(duration_ms * rate / 1000)
    samples = [fill_amplitude] * n_samples
    for start_ms, end_ms, amp in speech_windows or []:
        s0 = int(start_ms * rate / 1000)
        s1 = min(int(end_ms * rate / 1000), n_samples)
        for i in range(s0, s1):
            samples[i] = amp
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(rate)
        packed = struct.pack("<" + "h" * len(samples), *samples)
        wf.writeframes(packed)


def _artifact(
    *,
    duration_ms: int,
    coverage_end_ms: int,
    validation_ok: bool = True,
    words: list[AlignmentWord] | None = None,
) -> AlignmentArtifact:
    delta = duration_ms - coverage_end_ms
    word = AlignmentWord(text="x", startMs=0, endMs=coverage_end_ms)
    return AlignmentArtifact(
        audioId="a" * 32,
        durationMs=duration_ms,
        transcript="x",
        engine="whisper",
        modelId="base",
        words=words or [word],
        validation=AlignmentValidation(
            ok=validation_ok,
            errors=[] if validation_ok else ["fail"],
            warnings=[],
            wordCount=1,
            alignedWordCount=1 if validation_ok else 0,
            missingWords=[],
            coverageStartMs=0,
            coverageEndMs=coverage_end_ms,
            durationDeltaMs=delta,
            nonMonotonicWordRatio=0.0,
            timelineOrderRatio=1.0,
        ),
        processingMs=1,
    )


def test_strict_delta_249_passes(tmp_path: Path) -> None:
    art = _artifact(duration_ms=1249, coverage_end_ms=1000)
    assert art.validation.durationDeltaMs == 249
    gate = evaluate_go_gate(art, tmp_path / "x.wav")
    assert gate["passesGate"] is True
    assert gate["coverageAcceptanceReason"] == "within_250ms"
    assert gate["coverageWithin250Ms"] is True


def test_strict_delta_250_passes(tmp_path: Path) -> None:
    art = _artifact(duration_ms=1250, coverage_end_ms=1000)
    gate = evaluate_go_gate(art, tmp_path / "x.wav")
    assert gate["passesGate"] is True
    assert gate["coverageWithin250Ms"] is True


def test_delta_251_fails_without_wav(tmp_path: Path) -> None:
    art = _artifact(duration_ms=1251, coverage_end_ms=1000)
    gate = evaluate_go_gate(art, None)
    assert gate["passesGate"] is False
    assert gate["coverageWithin250Ms"] is False


def test_delta_260_fails_without_silent_wav(tmp_path: Path) -> None:
    wav = tmp_path / "loud.wav"
    _write_wav_mono(wav, 1251, speech_windows=[(0, 1251, 8000)])
    art = _artifact(duration_ms=1251, coverage_end_ms=991)
    assert art.validation.durationDeltaMs == 260
    gate = evaluate_go_gate(art, wav)
    assert gate["passesGate"] is False


def test_delta_260_passes_with_silent_tail(tmp_path: Path) -> None:
    duration_ms = 1260
    coverage_end = 1000
    wav = tmp_path / "silent_tail.wav"
    _write_wav_mono(
        wav,
        duration_ms,
        speech_windows=[(0, 200, 5000)],
    )
    art = _artifact(duration_ms=duration_ms, coverage_end_ms=coverage_end)
    assert art.validation.durationDeltaMs == 260
    gate = evaluate_go_gate(art, wav)
    assert gate["passesGate"] is True
    assert gate["coverageAcceptanceReason"] == "verified_trailing_silence"
    assert gate["trailingSilenceVerified"] is True
    assert gate["coverageWithin250Ms"] is False
    assert gate["durationDeltaMs"] == 260


def test_delta_401_fails_even_if_silent(tmp_path: Path) -> None:
    duration_ms = 1401
    coverage_end = 1000
    wav = tmp_path / "long_silent.wav"
    _write_wav_mono(wav, duration_ms)
    art = _artifact(duration_ms=duration_ms, coverage_end_ms=coverage_end)
    gate = evaluate_go_gate(art, wav)
    assert gate["passesGate"] is False


def test_boundary_400_silent_tail_passes(tmp_path: Path) -> None:
    duration_ms = 1400
    coverage_end = 1000
    wav = tmp_path / "b400.wav"
    _write_wav_mono(wav, duration_ms)
    art = _artifact(duration_ms=duration_ms, coverage_end_ms=coverage_end)
    gate = evaluate_go_gate(art, wav)
    assert gate["passesGate"] is True


def test_validation_not_ok_fails_despite_silent_tail(tmp_path: Path) -> None:
    wav = tmp_path / "s.wav"
    _write_wav_mono(wav, 1260)
    art = _artifact(duration_ms=1260, coverage_end_ms=1000, validation_ok=False)
    gate = evaluate_go_gate(art, wav)
    assert gate["passesGate"] is False


def test_missing_wav_fail_closed() -> None:
    art = _artifact(duration_ms=1260, coverage_end_ms=1000)
    gate = evaluate_go_gate(art, Path("/nonexistent/file.wav"))
    assert gate["passesGate"] is False


REPO_ROOT = Path(__file__).resolve().parents[3]
INTRO_WAV = REPO_ROOT / "data" / "tts" / "c1739d5fed364ed69221d7392ebf5f05.wav"
INTRO_JSON = REPO_ROOT / "data" / "alignment" / "c1739d5fed364ed69221d7392ebf5f05.json"


@pytest.mark.integration
def test_intro_saved_artifact_passes_silence_gate_without_whisper() -> None:
    if not INTRO_WAV.is_file() or not INTRO_JSON.is_file():
        pytest.skip("intro artifacts missing")

    from app.alignment.revalidate import artifact_from_saved_json

    data = json.loads(INTRO_JSON.read_text(encoding="utf-8"))
    artifact = artifact_from_saved_json(data, "c1739d5fed364ed69221d7392ebf5f05")
    assert artifact.validation.durationDeltaMs == 260
    assert artifact.validation.ok is True

    verified, reason = verify_trailing_silence(
        INTRO_WAV,
        artifact.validation.coverageEndMs or 0,
        artifact.durationMs,
    )
    assert verified is True, reason

    gate = evaluate_go_gate(artifact, INTRO_WAV)
    assert gate["passesGate"] is True
    assert gate["coverageAcceptanceReason"] == "verified_trailing_silence"
    assert gate["coverageWithin250Ms"] is False
    assert gate["durationDeltaMs"] == 260
