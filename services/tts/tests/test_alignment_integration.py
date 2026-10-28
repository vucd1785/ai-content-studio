import json
import os
from pathlib import Path

import pytest

from app.alignment.pipeline import align_transcript_to_wav

REPO_ROOT = Path(__file__).resolve().parents[3]
P0_03_WAV = REPO_ROOT / "data" / "tts" / "42daebb50e1a43759a1cdc7a439deb04.wav"
P0_03_TRANSCRIPT = (
    "Redis là một hệ thống lưu trữ dữ liệu trong bộ nhớ. "
    "Khi ứng dụng sử dụng Redis Cache, dữ liệu thường xuyên được truy cập "
    "có thể được lấy nhanh hơn, giúp giảm tải cho cơ sở dữ liệu."
)
TECH_WAV = REPO_ROOT / "data" / "tts" / "cbee8631da2d45d988740aae1ee99fb3.wav"
TECH_TRANSCRIPT = "API, Redis, Laravel và PostgreSQL."


@pytest.mark.integration
def test_align_p0_03_redis_wav_whisper() -> None:
    if os.environ.get("ALIGN_INTEGRATION") != "1":
        pytest.skip("set ALIGN_INTEGRATION=1")
    if not P0_03_WAV.is_file():
        pytest.skip("P0-03 WAV missing")

    from app.alignment.metrics import evaluate_go_gate

    artifact = align_transcript_to_wav(
        P0_03_WAV,
        P0_03_TRANSCRIPT,
        "42daebb50e1a43759a1cdc7a439deb04",
        engine="whisper",
    )
    assert artifact.durationMs > 0
    assert len(artifact.words) > 0
    gate = evaluate_go_gate(artifact)
    assert gate["passesGate"] is True


@pytest.mark.integration
def test_align_technical_terms_wav_whisper() -> None:
    if os.environ.get("ALIGN_INTEGRATION") != "1":
        pytest.skip("set ALIGN_INTEGRATION=1")
    if not TECH_WAV.is_file():
        pytest.skip("technical terms WAV missing")

    artifact = align_transcript_to_wav(
        TECH_WAV,
        TECH_TRANSCRIPT,
        "cbee8631da2d45d988740aae1ee99fb3",
        engine="whisper",
    )
    assert len(artifact.words) == len(TECH_TRANSCRIPT.split())
    valid = sum(1 for w in artifact.words if w.endMs > w.startMs)
    assert valid >= 4


@pytest.mark.integration
def test_ctc_fails_coverage_gate_on_p0_03_sample() -> None:
    """CTC Việt Nam không đạt cổng phủ trên WAV TTS — ghi nhận cho spike."""
    if os.environ.get("ALIGN_INTEGRATION") != "1":
        pytest.skip("set ALIGN_INTEGRATION=1")
    if not P0_03_WAV.is_file():
        pytest.skip("P0-03 WAV missing")

    from app.alignment.metrics import evaluate_go_gate

    artifact = align_transcript_to_wav(
        P0_03_WAV,
        P0_03_TRANSCRIPT,
        "42daebb50e1a43759a1cdc7a439deb04",
        engine="ctc",
    )
    gate = evaluate_go_gate(artifact)
    assert gate["passesGate"] is False


@pytest.mark.integration
def test_align_empty_transcript_raises() -> None:
    if os.environ.get("ALIGN_INTEGRATION") != "1":
        pytest.skip("set ALIGN_INTEGRATION=1")
    if not P0_03_WAV.is_file():
        pytest.skip("P0-03 WAV missing")
    with pytest.raises(ValueError, match="empty transcript"):
        align_transcript_to_wav(P0_03_WAV, "   ", "x", engine="ctc")


def test_alignment_json_roundtrip_schema() -> None:
    sample = {
        "audioId": "a",
        "durationMs": 1000,
        "words": [{"text": "hi", "startMs": 0, "endMs": 100}],
    }
    assert sample["words"][0]["endMs"] > sample["words"][0]["startMs"]
    json.dumps(sample)
