from __future__ import annotations

import logging
import os
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from app import engine
from app.audio_meta import is_valid_wav_header, wav_duration_seconds, wav_metadata
from app.config import DATA_DIR, DEFAULT_VOICE_ID, OUTPUT_SUBDIR, VIENEU_BACKEND

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="AI Content Studio TTS", version="0.1.0")


@app.on_event("startup")
def warm_model() -> None:
    if os.environ.get("TTS_PRELOAD_MODEL", "0") != "1":
        return
    try:
        engine.get_engine()
    except Exception:
        logger.warning("Model not loaded at startup; /health will report degraded until load succeeds")


class SynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10_000)
    voiceId: str | None = None


class SynthesizeResponse(BaseModel):
    artifactId: str
    relativePath: str
    durationSeconds: float
    sampleRate: int
    inferenceSeconds: float
    rtf: float
    backend: str
    model: str
    voiceId: str


@app.get("/health")
def health() -> dict[str, object]:
    ready = engine.is_ready()
    payload: dict[str, object] = {
        "status": "ok" if ready else "degraded",
        "model": "VieNeu-TTS-v3-Turbo",
        "backend": VIENEU_BACKEND,
    }
    if not ready:
        payload["error"] = engine.load_error_message() or "model not loaded"
    return payload


@app.post("/synthesize", response_model=SynthesizeResponse)
def synthesize(body: SynthesizeRequest) -> SynthesizeResponse:
    voice = (body.voiceId or DEFAULT_VOICE_ID).strip()
    if not voice:
        raise HTTPException(status_code=400, detail="voiceId empty")

    try:
        result = engine.synthesize(body.text, voice=voice)
    except Exception as exc:
        logger.exception("synthesize failed")
        raise HTTPException(
            status_code=503,
            detail={"code": "TTS_MODEL_UNAVAILABLE", "message": str(exc)},
        ) from exc

    out_dir = DATA_DIR / OUTPUT_SUBDIR
    out_dir.mkdir(parents=True, exist_ok=True)
    artifact_id = uuid.uuid4().hex
    filename = f"{artifact_id}.wav"
    out_path = out_dir / filename

    try:
        engine.get_engine().save(result.audio, str(out_path))
    except Exception as exc:
        logger.exception("save wav failed")
        raise HTTPException(
            status_code=500,
            detail={"code": "TTS_WRITE_FAILED", "message": str(exc)},
        ) from exc

    if not out_path.is_file() or not is_valid_wav_header(out_path):
        raise HTTPException(
            status_code=500,
            detail={"code": "TTS_INVALID_OUTPUT", "message": "WAV output missing or invalid"},
        )

    meta = wav_metadata(out_path)
    duration = float(meta["durationSeconds"])
    if duration <= 0:
        raise HTTPException(
            status_code=500,
            detail={"code": "TTS_ZERO_DURATION", "message": "WAV duration is zero"},
        )

    rtf = result.inference_seconds / duration if duration > 0 else 0.0
    relative = f"{OUTPUT_SUBDIR}/{filename}"

    return SynthesizeResponse(
        artifactId=artifact_id,
        relativePath=relative,
        durationSeconds=duration,
        sampleRate=int(meta["sampleRate"]),
        inferenceSeconds=round(result.inference_seconds, 4),
        rtf=round(rtf, 4),
        backend=result.backend,
        model=result.model,
        voiceId=voice,
    )


@app.get("/voices")
def voices() -> dict[str, list[str]]:
    try:
        ids = engine.list_preset_voice_ids()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"voiceIds": ids}
