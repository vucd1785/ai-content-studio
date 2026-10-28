from pathlib import Path

import pytest

from app.alignment.audio_io import load_wav_mono
from app.alignment.pipeline import align_transcript_to_wav


def test_missing_audio_raises(tmp_path: Path) -> None:
    missing = tmp_path / "nope.wav"
    with pytest.raises(FileNotFoundError):
        load_wav_mono(missing)


def test_corrupt_audio_raises(tmp_path: Path) -> None:
    bad = tmp_path / "bad.wav"
    bad.write_bytes(b"not a wav file")
    with pytest.raises(Exception):
        load_wav_mono(bad)


def test_align_missing_file_propagates(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        align_transcript_to_wav(
            tmp_path / "missing.wav",
            "xin chào",
            "id",
            engine="whisper",
        )
