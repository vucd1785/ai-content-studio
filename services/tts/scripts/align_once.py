#!/usr/bin/env python3
"""Chạy forced alignment một lần (spike P0-04)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from app.alignment.pipeline import align_transcript_to_wav  # noqa: E402
from app.config import DATA_DIR  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--wav", type=Path, required=True)
    parser.add_argument("--transcript", required=True)
    parser.add_argument("--audio-id", default=None)
    parser.add_argument("--engine", choices=("ctc", "whisper"), default="ctc")
    parser.add_argument("--out", type=Path, default=None)
    args = parser.parse_args()

    audio_id = args.audio_id or args.wav.stem
    artifact = align_transcript_to_wav(
        args.wav,
        args.transcript,
        audio_id,
        engine=args.engine,
    )

    out_path = args.out
    if out_path is None:
        out_dir = DATA_DIR / "alignment"
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"{audio_id}.json"

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps(artifact.to_json_dict(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"path={out_path}")
    print(f"engine={artifact.engine}")
    print(f"model={artifact.modelId}")
    print(f"durationMs={artifact.durationMs}")
    print(f"wordCount={len(artifact.words)}")
    print(f"validationOk={artifact.validation.ok}")
    print(f"processingMs={artifact.processingMs}")
    print(f"durationDeltaMs={artifact.validation.durationDeltaMs}")
    print(f"nonMonotonicWordRatio={artifact.validation.nonMonotonicWordRatio}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
