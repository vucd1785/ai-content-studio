import wave
from pathlib import Path

from app.audio_meta import is_valid_wav_header, wav_duration_seconds, wav_metadata


def test_wav_metadata_roundtrip(tmp_path: Path) -> None:
    path = tmp_path / "t.wav"
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(48_000)
        wf.writeframes(b"\x00\x00" * 48_000)

    assert is_valid_wav_header(path)
    assert abs(wav_duration_seconds(path) - 1.0) < 0.01
    meta = wav_metadata(path)
    assert meta["sampleRate"] == 48_000
    assert meta["durationSeconds"] == 1.0


def test_invalid_header(tmp_path: Path) -> None:
    path = tmp_path / "bad.wav"
    path.write_bytes(b"not-a-wav")
    assert not is_valid_wav_header(path)
