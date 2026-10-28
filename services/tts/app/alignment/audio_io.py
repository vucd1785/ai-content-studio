from __future__ import annotations

from pathlib import Path

import numpy as np
import soundfile as sf
import torch
import torchaudio

from app.audio_meta import wav_metadata

TARGET_SAMPLE_RATE = 16_000


def load_wav_mono(path: Path) -> tuple[torch.Tensor, int, float]:
    if not path.is_file():
        raise FileNotFoundError(f"audio not found: {path}")

    meta = wav_metadata(path)
    duration_sec = float(meta["durationSeconds"])
    if duration_sec <= 0:
        raise ValueError("audio duration is zero")

    data, sample_rate = sf.read(str(path), dtype="float32", always_2d=True)
    waveform = torch.from_numpy(data.mean(axis=1))

    if sample_rate != TARGET_SAMPLE_RATE:
        waveform = torchaudio.functional.resample(
            waveform.unsqueeze(0),
            sample_rate,
            TARGET_SAMPLE_RATE,
        ).squeeze(0)

    return waveform, TARGET_SAMPLE_RATE, duration_sec


def waveform_to_tensor(waveform: torch.Tensor) -> torch.Tensor:
    if waveform.dim() == 1:
        return waveform.unsqueeze(0)
    return waveform
