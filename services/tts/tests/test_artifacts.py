import pytest

from app.artifacts import (
    alignment_json_path,
    resolve_tts_wav_path,
    validate_artifact_id,
)
from app.config import DATA_DIR, OUTPUT_SUBDIR


def test_valid_artifact_id() -> None:
    validate_artifact_id("42daebb50e1a43759a1cdc7a439deb04")


@pytest.mark.parametrize(
    "bad_id",
    [
        "../42daebb50e1a43759a1cdc7a439deb04",
        "42daebb50e1a43759a1cdc7a439deb04..",
        "not-hex-id",
        "",
        "e:\\windows\\path00000000000000000",
    ],
)
def test_invalid_artifact_id_rejected(bad_id: str) -> None:
    with pytest.raises(ValueError):
        validate_artifact_id(bad_id)


def test_resolve_wav_under_data_dir(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr("app.artifacts.DATA_DIR", tmp_path)
    wav_dir = tmp_path / OUTPUT_SUBDIR
    wav_dir.mkdir(parents=True)
    artifact = "42daebb50e1a43759a1cdc7a439deb04"
    wav = wav_dir / f"{artifact}.wav"
    wav.write_bytes(b"RIFF")

    resolved = resolve_tts_wav_path(artifact)
    assert resolved == wav.resolve()


def test_alignment_json_path(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr("app.artifacts.DATA_DIR", tmp_path)
    artifact = "42daebb50e1a43759a1cdc7a439deb04"
    path = alignment_json_path(artifact)
    assert path.parent == (tmp_path / "alignment").resolve()
