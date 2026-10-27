"""Facade tới VieNeu-TTS v3 Turbo; có thể thay backend ở phase sau."""

from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass
from typing import Any

from app.config import SAMPLE_RATE_V3_TURBO, VIENEU_BACKEND, VIENEU_PRECISION

logger = logging.getLogger(__name__)

_load_error: str | None = None
_engine: Any = None
_lock = threading.Lock()


@dataclass(frozen=True)
class SynthesisResult:
    audio: Any
    inference_seconds: float
    backend: str
    model: str
    voice: str
    sample_rate: int


def _create_engine() -> Any:
    from vieneu import Vieneu

    kwargs: dict[str, Any] = {
        "mode": "v3turbo",
        "backend": VIENEU_BACKEND,
    }
    if VIENEU_BACKEND == "onnx":
        kwargs["precision"] = VIENEU_PRECISION
    return Vieneu(**kwargs)


def get_engine() -> Any:
    global _engine, _load_error
    if _engine is not None:
        return _engine
    with _lock:
        if _engine is not None:
            return _engine
        try:
            logger.info(
                "Loading VieNeu-TTS v3 Turbo (backend=%s, precision=%s)",
                VIENEU_BACKEND,
                VIENEU_PRECISION if VIENEU_BACKEND == "onnx" else "n/a",
            )
            started = time.perf_counter()
            _engine = _create_engine()
            logger.info("Model ready in %.2fs", time.perf_counter() - started)
            _load_error = None
            return _engine
        except Exception as exc:  # noqa: BLE001 — surface as health/synthesize failure
            _load_error = str(exc)
            logger.exception("Failed to load TTS model")
            raise


def load_error_message() -> str | None:
    return _load_error


def is_ready() -> bool:
    try:
        get_engine()
        return True
    except Exception:
        return False


def synthesize(text: str, voice: str) -> SynthesisResult:
    engine = get_engine()
    started = time.perf_counter()
    audio = engine.infer(text, voice=voice)
    elapsed = time.perf_counter() - started
    backend = VIENEU_BACKEND
    return SynthesisResult(
        audio=audio,
        inference_seconds=elapsed,
        backend=backend,
        model="VieNeu-TTS-v3-Turbo",
        voice=voice,
        sample_rate=SAMPLE_RATE_V3_TURBO,
    )


def list_preset_voice_ids() -> list[str]:
    engine = get_engine()
    voices = engine.list_preset_voices()
    return [voice_id for _label, voice_id in voices]
