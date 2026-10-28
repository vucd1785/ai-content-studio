import os
from pathlib import Path

DATA_DIR = Path(os.environ.get("DATA_DIR", "/data")).resolve()
OUTPUT_SUBDIR = "tts"
ALIGNMENT_SUBDIR = "alignment"
DEFAULT_VOICE_ID = os.environ.get("TTS_DEFAULT_VOICE", "Mai Anh")
VIENEU_BACKEND = os.environ.get("VIENEU_BACKEND", "onnx")
VIENEU_PRECISION = os.environ.get("VIENEU_PRECISION", "fp32")
SAMPLE_RATE_V3_TURBO = 48_000

DEFAULT_ALIGNMENT_ENGINE = os.environ.get("ALIGNMENT_ENGINE", "whisper")
WHISPER_MODEL_NAME = os.environ.get("WHISPER_MODEL", "base")
_whisper_cache = os.environ.get("WHISPER_CACHE_DIR", "").strip()
WHISPER_CACHE_DIR: Path | None = (
    Path(_whisper_cache).resolve() if _whisper_cache else None
)
