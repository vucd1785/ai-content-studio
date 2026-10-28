from __future__ import annotations

import re
from pathlib import Path

from app.config import ALIGNMENT_SUBDIR, DATA_DIR, OUTPUT_SUBDIR

# Hex artifact ids from synthesize (uuid4().hex)
_ARTIFACT_ID = re.compile(r"^[a-f0-9]{32}$")

_TRAVERSAL_MARKERS = ("..", "..\\", "../", "\\", "/")


def validate_artifact_id(artifact_id: str) -> None:
    raw = artifact_id.strip()
    if not raw or raw != artifact_id:
        raise ValueError("artifact id must not contain surrounding whitespace")
    lowered = raw.lower()
    for marker in _TRAVERSAL_MARKERS:
        if marker in lowered or marker in raw:
            raise ValueError("artifact id contains invalid path segments")
    if Path(raw).is_absolute():
        raise ValueError("artifact id must not be an absolute path")
    if not _ARTIFACT_ID.match(lowered):
        raise ValueError("artifact id must be 32 lowercase hex characters")


def resolve_tts_wav_path(artifact_id: str) -> Path:
    validate_artifact_id(artifact_id)
    candidate = (DATA_DIR / OUTPUT_SUBDIR / f"{artifact_id.lower()}.wav").resolve()
    data_root = DATA_DIR.resolve()
    if data_root not in candidate.parents and candidate != data_root:
        raise ValueError("resolved wav path escapes data directory")
    return candidate


def alignment_json_path(artifact_id: str) -> Path:
    validate_artifact_id(artifact_id)
    candidate = (DATA_DIR / ALIGNMENT_SUBDIR / f"{artifact_id.lower()}.json").resolve()
    data_root = DATA_DIR.resolve()
    if data_root not in candidate.parents and candidate != data_root:
        raise ValueError("resolved alignment path escapes data directory")
    return candidate
