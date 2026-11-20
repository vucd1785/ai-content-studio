"""ADR-012 bổ sung 2026-11-04: kéo dài từ cuối theo năng lượng PCM rồi chấm cổng như cũ."""

from __future__ import annotations

import json
import struct
import wave
from pathlib import Path

from app.alignment.extend_last_word import (
    MAX_LAST_WORD_EXTENSION_MS,
    extend_last_word,
    speech_end_after,
)
from app.alignment.gate import evaluate_go_gate
from app.alignment.repair import validate_with_repair
from app.alignment.revalidate import revalidate_on_disk
from app.alignment.schema import AlignmentArtifact, AlignmentWord

RATE = 16_000
LOUD = 12_000  # khoảng -8 dBFS
QUIET = 50  # khoảng -56 dBFS


def _wav(path: Path, duration_ms: int, speech: list[tuple[int, int]]) -> Path:
    n = int(duration_ms * RATE / 1000)
    samples = [QUIET] * n
    for start, end in speech:
        for i in range(int(start * RATE / 1000), min(int(end * RATE / 1000), n)):
            samples[i] = LOUD if i % 2 else -LOUD
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(RATE)
        wf.writeframes(struct.pack("<" + "h" * n, *samples))
    return path


def w(text: str, start: int, end: int) -> AlignmentWord:
    return AlignmentWord(text=text, startMs=start, endMs=end)


def _chat_qua_words() -> list[AlignmentWord]:
    """Như câu l10 run DDoS: "Chật quá!" dài 800 ms, Whisper cắt "quá" ở 340 ms."""
    return [w("Chật", 100, 240), w("quá", 240, 340)]


def _artifact(words: list[AlignmentWord], duration: int, wav: Path | None) -> AlignmentArtifact:
    fixed, validation = validate_with_repair(words, [x.text for x in words], duration, wav)
    return AlignmentArtifact(
        audioId="c" * 32,
        durationMs=duration,
        transcript=" ".join(x.text for x in words),
        engine="whisper",
        modelId="base",
        words=fixed,
        validation=validation,
        processingMs=0,
    )


def test_cut_short_last_word_is_extended_and_passes_gate(tmp_path: Path) -> None:
    wav = _wav(tmp_path / "a.wav", 800, [(100, 640)])
    artifact = _artifact(_chat_qua_words(), 800, wav)
    assert artifact.words[-1].endMs == 640
    assert artifact.validation.lastWordExtendedMs == 300
    assert artifact.validation.durationDeltaMs == 160
    assert any("extended last word 'quá' by 300 ms" in m for m in artifact.validation.warnings)
    gate = evaluate_go_gate(artifact, wav)
    assert gate["passesGate"] is True
    assert gate["coverageAcceptanceReason"] == "within_250ms"
    assert gate["alignedWordRatio"] == 1.0
    assert gate["gatePolicyVersion"] == "2.2.0-extend-last-word"


def test_without_extension_same_input_fails_gate(tmp_path: Path) -> None:
    """Không có WAV thì không sửa: giữ hành vi fail closed của ADR-012."""
    artifact = _artifact(_chat_qua_words(), 800, None)
    assert artifact.validation.lastWordExtendedMs == 0
    assert artifact.words[-1].endMs == 340
    assert evaluate_go_gate(artifact, None)["passesGate"] is False


def test_extension_over_max_is_not_applied(tmp_path: Path) -> None:
    end = 340 + MAX_LAST_WORD_EXTENSION_MS + 100
    wav = _wav(tmp_path / "a.wav", end + 200, [(100, end)])
    fixed, extended = extend_last_word(_chat_qua_words(), end + 200, wav)
    assert extended == 0 and fixed[-1].endMs == 340
    assert speech_end_after(wav, 340, end + 200) == (None, "extension_exceeds_max")


def test_gap_then_energy_is_not_applied(tmp_path: Path) -> None:
    """Im lặng rồi lại có tiếng: có thể là từ bị sót, không kéo dài."""
    wav = _wav(tmp_path / "a.wav", 900, [(100, 340), (500, 650)])
    fixed, extended = extend_last_word(_chat_qua_words(), 900, wav)
    assert extended == 0 and fixed[-1].endMs == 340
    assert speech_end_after(wav, 340, 900)[1] == "no_energy_after_last_word"


def test_energy_then_gap_then_energy_is_not_applied(tmp_path: Path) -> None:
    wav = _wav(tmp_path / "a.wav", 900, [(100, 450), (600, 700)])
    assert speech_end_after(wav, 340, 900) == (None, "gap_before_energy")
    assert extend_last_word(_chat_qua_words(), 900, wav)[1] == 0


def test_silent_tail_is_left_to_rule_b(tmp_path: Path) -> None:
    wav = _wav(tmp_path / "a.wav", 640, [(100, 340)])
    fixed, extended = extend_last_word(_chat_qua_words(), 640, wav)
    assert extended == 0
    gate = evaluate_go_gate(_artifact(_chat_qua_words(), 640, wav), wav)
    assert gate["coverageAcceptanceReason"] == "verified_trailing_silence"


def test_small_delta_is_not_touched(tmp_path: Path) -> None:
    wav = _wav(tmp_path / "a.wav", 500, [(100, 500)])
    assert extend_last_word(_chat_qua_words(), 500, wav)[1] == 0


def test_missing_or_broken_wav_fails_closed(tmp_path: Path) -> None:
    assert extend_last_word(_chat_qua_words(), 800, tmp_path / "none.wav")[1] == 0
    broken = tmp_path / "broken.wav"
    broken.write_bytes(b"not a wav")
    assert extend_last_word(_chat_qua_words(), 800, broken)[1] == 0


def test_revalidate_extends_saved_failing_alignment(tmp_path: Path) -> None:
    wav = _wav(tmp_path / ("d" * 32 + ".wav"), 800, [(100, 640)])
    words = _chat_qua_words()
    saved = {
        "audioId": "d" * 32,
        "durationMs": 800,
        "transcript": "Chật quá",
        "engine": "whisper",
        "modelId": "base",
        "words": [x.model_dump() for x in words],
        "validation": {"ok": True, "errors": [], "warnings": []},
        "processingMs": 0,
        "gate": {"passesGate": False},
    }
    json_path = tmp_path / ("d" * 32 + ".json")
    json_path.write_text(json.dumps(saved, ensure_ascii=False), encoding="utf-8")
    artifact, gate = revalidate_on_disk(wav, json_path, "d" * 32)
    assert gate["passesGate"] is True
    assert artifact.validation.lastWordExtendedMs == 300
    on_disk = json.loads(json_path.read_text(encoding="utf-8"))
    assert on_disk["words"][-1]["endMs"] == 640
    assert on_disk["validation"]["lastWordExtendedMs"] == 300
