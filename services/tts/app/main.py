from __future__ import annotations

import json
import logging
import os
import uuid
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app import engine
from app.alignment.gate import evaluate_go_gate
from app.alignment.pipeline import align_transcript_to_wav
from app.alignment.revalidate import artifact_from_saved_json, reevaluate_gate_on_disk
from app.alignment.schema import AlignmentArtifact, AlignmentValidation, AlignmentWord
from app.artifacts import alignment_json_path, resolve_tts_wav_path, validate_artifact_id
from app.audio_meta import is_valid_wav_header, wav_duration_seconds, wav_metadata
from app.config import (
    DATA_DIR,
    DEFAULT_ALIGNMENT_ENGINE,
    DEFAULT_VOICE_ID,
    OUTPUT_SUBDIR,
    VIENEU_BACKEND,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="AI Content Studio TTS", version="0.1.0")


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": "http_error",
                "message": str(exc.detail),
            }
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    _request: object, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=400,
        content={
            "error": {
                "code": "validation_error",
                "message": "Request body failed validation",
                "details": {"issues": exc.errors()},
            }
        },
    )


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


AlignmentEngine = Literal["whisper", "ctc"]


class AlignRequest(BaseModel):
    audioArtifactId: str = Field(..., pattern=r"^[a-fA-F0-9]{32}$")
    transcript: str = Field(..., min_length=1, max_length=50_000)
    engine: AlignmentEngine | None = None


class AlignmentGate(BaseModel):
    alignedWordRatio: float
    durationDeltaMs: int | None
    coverageWithin250Ms: bool
    ratioAtLeast90Pct: bool
    validationOk: bool
    passesGate: bool
    gatePolicyVersion: str
    trailingSilenceVerified: bool
    trailingSilenceMs: int | None
    coverageAcceptanceReason: str | None


class RevalidateGateRequest(BaseModel):
    audioArtifactId: str = Field(..., pattern=r"^[a-fA-F0-9]{32}$")


def _align_response_from_artifact(
    artifact: AlignmentArtifact,
    gate: AlignmentGate,
    audio_id: str,
) -> AlignResponse:
    return AlignResponse(
        alignmentArtifactId=audio_id,
        audioArtifactId=audio_id,
        durationMs=artifact.durationMs,
        transcript=artifact.transcript,
        engine=artifact.engine,  # type: ignore[arg-type]
        modelId=artifact.modelId,
        words=artifact.words,
        validation=artifact.validation,
        gate=gate,
        processingMs=artifact.processingMs,
    )


class AlignResponse(BaseModel):
    alignmentArtifactId: str
    audioArtifactId: str
    durationMs: int
    transcript: str
    engine: AlignmentEngine
    modelId: str
    words: list[AlignmentWord]
    validation: AlignmentValidation
    gate: AlignmentGate
    processingMs: int


def _api_error(status: int, code: str, message: str, **details: Any) -> HTTPException:
    body: dict[str, Any] = {"error": {"code": code, "message": message}}
    if details:
        body["error"]["details"] = details
    return HTTPException(status_code=status, detail=body)


def _resolve_audio_artifact(audio_artifact_id: str) -> Path:
    try:
        validate_artifact_id(audio_artifact_id)
    except ValueError as exc:
        raise _api_error(400, "invalid_artifact_id", str(exc)) from exc

    wav_path = resolve_tts_wav_path(audio_artifact_id)
    if not wav_path.is_file():
        raise _api_error(
            404,
            "artifact_not_found",
            "Audio artifact not found",
            audioArtifactId=audio_artifact_id.lower(),
        )
    if not is_valid_wav_header(wav_path):
        raise _api_error(
            422,
            "invalid_audio_artifact",
            "Audio artifact is missing or not a valid WAV file",
            audioArtifactId=audio_artifact_id.lower(),
        )
    return wav_path


@app.get("/health")
def health() -> dict[str, object]:
    ready = engine.is_ready()
    payload: dict[str, object] = {
        "status": "ok" if ready else "degraded",
        "model": "VieNeu-TTS-v3-Turbo",
        "backend": VIENEU_BACKEND,
        "defaultAlignmentEngine": DEFAULT_ALIGNMENT_ENGINE,
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


@app.post("/align", response_model=AlignResponse)
def align(body: AlignRequest) -> AlignResponse:
    audio_id = body.audioArtifactId.lower()
    wav_path = _resolve_audio_artifact(body.audioArtifactId)
    engine_name = body.engine or DEFAULT_ALIGNMENT_ENGINE

    try:
        artifact = align_transcript_to_wav(
            wav_path,
            body.transcript,
            audio_id,
            engine=engine_name,
        )
    except ValueError as exc:
        message = str(exc)
        if "empty transcript" in message:
            raise _api_error(400, "empty_transcript", message) from exc
        if "unknown alignment engine" in message:
            raise _api_error(400, "invalid_alignment_engine", message) from exc
        raise _api_error(400, "alignment_rejected", message) from exc
    except FileNotFoundError as exc:
        raise _api_error(
            404,
            "artifact_not_found",
            "Audio artifact not found",
            audioArtifactId=audio_id,
        ) from exc
    except ModuleNotFoundError as exc:
        logger.exception("alignment dependency missing")
        raise _api_error(
            503,
            "alignment_engine_unavailable",
            "Alignment engine dependencies are not installed",
        ) from exc
    except Exception as exc:
        logger.exception("alignment failed")
        raise _api_error(
            503,
            "alignment_failed",
            "Alignment engine failed",
        ) from exc

    gate_payload = evaluate_go_gate(artifact, wav_path)
    gate = AlignmentGate.model_validate(gate_payload)

    out_path = alignment_json_path(audio_id)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    payload = artifact.to_json_dict()
    payload["gate"] = gate_payload
    out_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    return _align_response_from_artifact(artifact, gate, audio_id)


@app.post("/align/revalidate-gate", response_model=AlignResponse)
def revalidate_gate(body: RevalidateGateRequest) -> AlignResponse:
    audio_id = body.audioArtifactId.lower()
    wav_path = _resolve_audio_artifact(body.audioArtifactId)
    json_path = alignment_json_path(audio_id)
    if not json_path.is_file():
        raise _api_error(
            404,
            "artifact_not_found",
            "Alignment artifact not found",
            audioArtifactId=audio_id,
        )

    try:
        data = json.loads(json_path.read_text(encoding="utf-8"))
        artifact = artifact_from_saved_json(data, audio_id)
    except (ValueError, json.JSONDecodeError) as exc:
        raise _api_error(422, "invalid_alignment_artifact", str(exc)) from exc

    gate_payload = reevaluate_gate_on_disk(wav_path, json_path, audio_id)
    gate = AlignmentGate.model_validate(gate_payload)
    return _align_response_from_artifact(artifact, gate, audio_id)


@app.get("/voices")
def voices() -> dict[str, list[str]]:
    try:
        ids = engine.list_preset_voice_ids()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"voiceIds": ids}
