#!/usr/bin/env python3
"""Chạy inference một lần, ghi WAV và in metadata (spike P0-03)."""

from __future__ import annotations

import argparse
import sys
import uuid
from pathlib import Path

# Cho phép chạy từ repo root hoặc services/tts
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from app.audio_meta import wav_metadata  # noqa: E402
from app.config import DATA_DIR, DEFAULT_VOICE_ID, OUTPUT_SUBDIR  # noqa: E402
from app import engine  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--text", required=True)
    parser.add_argument("--voice", default=DEFAULT_VOICE_ID)
    args = parser.parse_args()

    result = engine.synthesize(args.text, voice=args.voice)
    out_dir = DATA_DIR / OUTPUT_SUBDIR
    out_dir.mkdir(parents=True, exist_ok=True)
    artifact_id = uuid.uuid4().hex
    out_path = out_dir / f"{artifact_id}.wav"
    engine.get_engine().save(result.audio, str(out_path))
    meta = wav_metadata(out_path)
    duration = float(meta["durationSeconds"])
    rtf = result.inference_seconds / duration if duration > 0 else 0.0

    print(f"path={out_path}")
    print(f"durationSeconds={duration:.4f}")
    print(f"sampleRate={meta['sampleRate']}")
    print(f"inferenceSeconds={result.inference_seconds:.4f}")
    print(f"rtf={rtf:.4f}")
    print(f"backend={result.backend}")
    print(f"voice={result.voice}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
