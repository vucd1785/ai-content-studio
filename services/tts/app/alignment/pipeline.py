from __future__ import annotations

import time
from pathlib import Path

from app.alignment.audio_io import load_wav_mono
from app.alignment.ctc_backend import align_with_ctc, DEFAULT_VI_CTC_MODEL
from app.alignment.schema import AlignmentArtifact
from app.alignment.tokenize import preprocess_transcript, tokenize_transcript_words
from app.alignment.validate import validate_alignment
from app.alignment.whisper_backend import align_with_whisper, DEFAULT_WHISPER_MODEL


def align_transcript_to_wav(
    wav_path: Path,
    transcript: str,
    audio_id: str,
    *,
    engine: str = "ctc",
    ctc_model_id: str = DEFAULT_VI_CTC_MODEL,
    whisper_model: str = DEFAULT_WHISPER_MODEL,
) -> AlignmentArtifact:
    cleaned = preprocess_transcript(transcript)
    if not cleaned:
        raise ValueError("empty transcript")

    started = time.perf_counter()
    waveform, _rate, duration_sec = load_wav_mono(wav_path)
    duration_ms = int(round(duration_sec * 1000))
    expected = tokenize_transcript_words(cleaned)

    if engine == "ctc":
        result = align_with_ctc(waveform, cleaned, ctc_model_id)
        model_id = result.model_id
        words = result.words
    elif engine == "whisper":
        result = align_with_whisper(str(wav_path), cleaned, whisper_model)
        model_id = result.model_id
        words = result.words
    else:
        raise ValueError(f"unknown alignment engine: {engine}")

    validation = validate_alignment(words, expected, duration_ms)
    elapsed_ms = int(round((time.perf_counter() - started) * 1000))

    return AlignmentArtifact(
        audioId=audio_id,
        durationMs=duration_ms,
        transcript=cleaned,
        engine=engine,
        modelId=model_id,
        words=words,
        validation=validation,
        processingMs=elapsed_ms,
        metadata={
            "sampleRateInputHz": 48000,
            "alignmentSampleRateHz": 16000,
        },
    )
