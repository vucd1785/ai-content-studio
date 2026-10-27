import os
from pathlib import Path

DATA_DIR = Path(os.environ.get("DATA_DIR", "/data")).resolve()
OUTPUT_SUBDIR = "tts"
DEFAULT_VOICE_ID = os.environ.get("TTS_DEFAULT_VOICE", "Mai Anh")
VIENEU_BACKEND = os.environ.get("VIENEU_BACKEND", "onnx")
VIENEU_PRECISION = os.environ.get("VIENEU_PRECISION", "fp32")
SAMPLE_RATE_V3_TURBO = 48_000
