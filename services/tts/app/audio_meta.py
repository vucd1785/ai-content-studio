import struct
import wave
from pathlib import Path


def wav_duration_seconds(path: Path) -> float:
    with wave.open(str(path), "rb") as wf:
        frames = wf.getnframes()
        rate = wf.getframerate()
        if rate <= 0:
            return 0.0
        return frames / float(rate)


def wav_metadata(path: Path) -> dict[str, int | float]:
    with wave.open(str(path), "rb") as wf:
        frames = wf.getnframes()
        rate = wf.getframerate()
        channels = wf.getnchannels()
        sample_width = wf.getsampwidth()
    duration = frames / float(rate) if rate > 0 else 0.0
    return {
        "sampleRate": rate,
        "channels": channels,
        "sampleWidthBytes": sample_width,
        "durationSeconds": duration,
    }


def is_valid_wav_header(path: Path) -> bool:
    try:
        with path.open("rb") as f:
            header = f.read(12)
        if len(header) < 12:
            return False
        riff, size, wave_tag = struct.unpack("<4sI4s", header)
        return riff == b"RIFF" and wave_tag == b"WAVE" and size > 0
    except OSError:
        return False
