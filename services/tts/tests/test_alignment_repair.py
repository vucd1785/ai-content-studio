"""ADR-012 bổ sung 2026-11-02: sửa từ độ dài 0 trước khi validate; cổng tính tỷ lệ trên số từ đo được thật."""

from __future__ import annotations

import json
from pathlib import Path

from app.alignment.gate import evaluate_go_gate
from app.alignment.repair import (
    REPAIR_TARGET_MS,
    repair_zero_length_words,
    validate_with_repair,
)
from app.alignment.revalidate import revalidate_on_disk
from app.alignment.schema import AlignmentArtifact, AlignmentWord


def w(text: str, start: int, end: int) -> AlignmentWord:
    return AlignmentWord(text=text, startMs=start, endMs=end)


def test_uses_silence_after_word() -> None:
    fixed, repaired = repair_zero_length_words([w("a", 0, 100), w("code", 300, 300), w("b", 600, 800)], 1000)
    assert repaired == [1]
    assert (fixed[1].startMs, fixed[1].endMs) == (300, 300 + REPAIR_TARGET_MS)


def test_uses_silence_before_word_when_next_is_adjacent() -> None:
    fixed, repaired = repair_zero_length_words([w("a", 0, 100), w("về", 300, 300), w("b", 300, 500)], 1000)
    assert repaired == [1]
    assert (fixed[1].startMs, fixed[1].endMs) == (300 - REPAIR_TARGET_MS, 300)


def test_steals_from_longer_neighbour_without_gap() -> None:
    fixed, repaired = repair_zero_length_words([w("a", 0, 100), w("x", 100, 100), w("dàiii", 100, 700)], 1000)
    assert repaired == [1]
    assert fixed[1].startMs == 100 and fixed[1].endMs > fixed[1].startMs
    assert fixed[2].startMs == fixed[1].endMs and fixed[2].endMs == 700
    # Thứ tự và độ dài file được giữ.
    assert all(fixed[i].startMs >= fixed[i - 1].endMs for i in range(1, len(fixed)))


def test_does_not_touch_out_of_order_or_input() -> None:
    words = [w("a", 0, 500), w("b", 200, 200), w("c", 600, 700)]
    fixed, repaired = repair_zero_length_words(words, 1000)
    assert repaired == []
    assert fixed[1].endMs == 200
    assert words[1].endMs == 200  # không đổi bản gốc


def test_last_word_stays_within_duration() -> None:
    fixed, repaired = repair_zero_length_words([w("a", 0, 900), w("z", 980, 980)], 1000)
    assert repaired == [1]
    assert fixed[1].endMs <= 1000 and fixed[1].endMs > fixed[1].startMs


def test_validation_counts_and_warns() -> None:
    words = [w("a", 0, 100), w("code", 300, 300), w("b", 600, 800)]
    fixed, validation = validate_with_repair(words, ["a", "code", "b"], 900)
    assert validation.ok
    assert validation.repairedWordCount == 1
    assert any("repaired zero-length interval at index 1" in m for m in validation.warnings)
    assert fixed[1].endMs > fixed[1].startMs


def _artifact(words: list[AlignmentWord], duration: int) -> AlignmentArtifact:
    fixed, validation = validate_with_repair(words, [x.text for x in words], duration)
    return AlignmentArtifact(
        audioId="a" * 32,
        durationMs=duration,
        transcript=" ".join(x.text for x in words),
        engine="whisper",
        modelId="base",
        words=fixed,
        validation=validation,
        processingMs=0,
    )


def _scene_s3_words() -> list[AlignmentWord]:
    """26 từ như cảnh s3 run ba4dc84c: từ 16 ("code") và 21 ("về") dài 0, cuối lệch 240 ms."""
    words = [w(f"t{i}", i * 260, i * 260 + 200) for i in range(26)]
    words[16] = w("code", 16 * 260, 16 * 260)
    words[21] = w("về", 21 * 260, 21 * 260)
    return words


def test_gate_passes_scene_like_s3_with_ratio_before_repair() -> None:
    words = _scene_s3_words()
    duration = words[-1].endMs + 240
    gate = evaluate_go_gate(_artifact(words, duration))
    assert gate["passesGate"] is True
    assert gate["alignedWordRatio"] == round(24 / 26, 4)
    assert gate["gatePolicyVersion"] == "2.1.0-repair-zero-length"


def test_gate_still_fails_when_too_many_words_repaired() -> None:
    words = [w(f"t{i}", i * 300, i * 300 + 200) for i in range(10)]
    words[3] = w("x", 900, 900)
    words[6] = w("y", 1800, 1800)
    gate = evaluate_go_gate(_artifact(words, words[-1].endMs + 100))
    assert gate["ratioAtLeast90Pct"] is False
    assert gate["passesGate"] is False


def test_revalidate_on_disk_repairs_saved_failing_alignment(tmp_path: Path) -> None:
    words = _scene_s3_words()
    duration = words[-1].endMs + 240
    saved = {
        "audioId": "b" * 32,
        "durationMs": duration,
        "transcript": " ".join(x.text for x in words),
        "engine": "whisper",
        "modelId": "base",
        "words": [x.model_dump() for x in words],
        "validation": {"ok": False, "errors": ["invalid interval at index 16: 'code'"], "warnings": []},
        "processingMs": 0,
        "gate": {"passesGate": False},
    }
    json_path = tmp_path / "b.json"
    json_path.write_text(json.dumps(saved, ensure_ascii=False), encoding="utf-8")
    artifact, gate = revalidate_on_disk(tmp_path / "b.wav", json_path, "b" * 32)
    assert gate["passesGate"] is True
    assert artifact.validation.ok and artifact.validation.repairedWordCount == 2
    on_disk = json.loads(json_path.read_text(encoding="utf-8"))
    assert on_disk["validation"]["repairedWordCount"] == 2
    assert on_disk["gate"]["passesGate"] is True
    assert all(x["endMs"] > x["startMs"] for x in on_disk["words"])
