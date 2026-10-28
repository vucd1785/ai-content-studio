from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.alignment.schema import AlignmentArtifact, AlignmentValidation, AlignmentWord
from app.main import app

client = TestClient(app)

P0_03_ID = "42daebb50e1a43759a1cdc7a439deb04"
TRANSCRIPT = "Redis nhanh hơn."


def _sample_artifact(audio_id: str) -> AlignmentArtifact:
    words = [AlignmentWord(text="Redis", startMs=0, endMs=100)]
    validation = AlignmentValidation(
        ok=True,
        errors=[],
        warnings=[],
        wordCount=1,
        alignedWordCount=1,
        missingWords=[],
        coverageStartMs=0,
        coverageEndMs=100,
        durationDeltaMs=0,
        nonMonotonicWordRatio=0.0,
        timelineOrderRatio=1.0,
    )
    return AlignmentArtifact(
        audioId=audio_id,
        durationMs=1000,
        transcript=TRANSCRIPT,
        engine="whisper",
        modelId="base",
        words=words,
        validation=validation,
        processingMs=5,
    )


def test_align_invalid_body_schema() -> None:
    response = client.post("/align", json={"transcript": "only text"})
    assert response.status_code == 400
    body = response.json()
    assert body["error"]["code"] == "validation_error"


FAKE_ID = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"


def _patch_data_dir(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr("app.main.DATA_DIR", tmp_path)
    monkeypatch.setattr("app.artifacts.DATA_DIR", tmp_path)


def test_align_invalid_artifact_id() -> None:
    response = client.post(
        "/align",
        json={
            "audioArtifactId": "../etc/passwd000000000000000000",
            "transcript": TRANSCRIPT,
        },
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "validation_error"


def test_align_missing_audio_artifact(tmp_path, monkeypatch) -> None:
    _patch_data_dir(monkeypatch, tmp_path)
    response = client.post(
        "/align",
        json={"audioArtifactId": FAKE_ID, "transcript": TRANSCRIPT},
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "artifact_not_found"


def test_align_empty_transcript(tmp_path, monkeypatch) -> None:
    _patch_data_dir(monkeypatch, tmp_path)
    wav_dir = tmp_path / "tts"
    wav_dir.mkdir(parents=True)
    wav = wav_dir / f"{P0_03_ID}.wav"
    wav.write_bytes(
        b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00"
        b"D\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00"
    )
    response = client.post(
        "/align",
        json={"audioArtifactId": P0_03_ID, "transcript": "   "},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "empty_transcript"


def test_align_success_persists_json(tmp_path, monkeypatch) -> None:
    _patch_data_dir(monkeypatch, tmp_path)
    wav_dir = tmp_path / "tts"
    wav_dir.mkdir(parents=True)
    wav = wav_dir / f"{P0_03_ID}.wav"
    wav.write_bytes(
        b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00"
        b"D\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00"
    )

    artifact = _sample_artifact(P0_03_ID)
    with patch("app.main.align_transcript_to_wav", return_value=artifact):
        response = client.post(
            "/align",
            json={"audioArtifactId": P0_03_ID, "transcript": TRANSCRIPT},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["alignmentArtifactId"] == P0_03_ID
    assert data["engine"] == "whisper"
    assert data["gate"]["passesGate"] is True
    assert "relativePath" not in data
    assert "model" not in data or data.get("modelId") == "base"

    out = tmp_path / "alignment" / f"{P0_03_ID}.json"
    assert out.is_file()
    saved = json.loads(out.read_text(encoding="utf-8"))
    assert saved["audioId"] == P0_03_ID
    assert "gate" in saved


def test_align_default_engine_whisper(tmp_path, monkeypatch) -> None:
    _patch_data_dir(monkeypatch, tmp_path)
    wav_dir = tmp_path / "tts"
    wav_dir.mkdir(parents=True)
    wav = wav_dir / f"{P0_03_ID}.wav"
    wav.write_bytes(
        b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00"
        b"D\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00"
    )

    artifact = _sample_artifact(P0_03_ID)
    with patch("app.main.align_transcript_to_wav", return_value=artifact) as mocked:
        client.post(
            "/align",
            json={"audioArtifactId": P0_03_ID, "transcript": TRANSCRIPT},
        )
        assert mocked.call_args.kwargs.get("engine") == "whisper"


def test_health_reports_default_alignment_engine() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["defaultAlignmentEngine"] == "whisper"


@pytest.mark.integration
def test_align_api_real_p0_03_wav() -> None:
    import os
    from pathlib import Path

    if os.environ.get("ALIGN_INTEGRATION") != "1":
        pytest.skip("set ALIGN_INTEGRATION=1")
    repo = Path(__file__).resolve().parents[3]
    wav = repo / "data" / "tts" / f"{P0_03_ID}.wav"
    if not wav.is_file():
        pytest.skip("P0-03 WAV missing")

    transcript = (
        "Redis là một hệ thống lưu trữ dữ liệu trong bộ nhớ. "
        "Khi ứng dụng sử dụng Redis Cache, dữ liệu thường xuyên được truy cập "
        "có thể được lấy nhanh hơn, giúp giảm tải cho cơ sở dữ liệu."
    )
    response = client.post(
        "/align",
        json={"audioArtifactId": P0_03_ID, "transcript": transcript},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["gate"]["passesGate"] is True
    assert data["validation"]["ok"] is True
    out = repo / "data" / "alignment" / f"{P0_03_ID}.json"
    assert out.is_file()

