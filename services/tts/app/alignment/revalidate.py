from __future__ import annotations

import json
from pathlib import Path

from app.alignment.gate import evaluate_go_gate
from app.alignment.schema import AlignmentArtifact, AlignmentValidation, AlignmentWord


def artifact_from_saved_json(data: dict[str, object], audio_id: str) -> AlignmentArtifact:
    validation_raw = data.get("validation")
    if not isinstance(validation_raw, dict):
        raise ValueError("missing validation in alignment artifact")

    words_raw = data.get("words")
    if not isinstance(words_raw, list):
        raise ValueError("missing words in alignment artifact")

    words = [AlignmentWord.model_validate(w) for w in words_raw]
    validation = AlignmentValidation.model_validate(validation_raw)

    return AlignmentArtifact(
        audioId=audio_id,
        durationMs=int(data["durationMs"]),
        transcript=str(data["transcript"]),
        engine=str(data.get("engine", "whisper")),
        modelId=str(data.get("modelId", "base")),
        words=words,
        validation=validation,
        processingMs=int(data.get("processingMs", 0)),
        metadata=data.get("metadata") if isinstance(data.get("metadata"), dict) else {},
    )


def reevaluate_gate_on_disk(wav_path: Path, json_path: Path, audio_id: str) -> dict[str, object]:
    data = json.loads(json_path.read_text(encoding="utf-8"))
    artifact = artifact_from_saved_json(data, audio_id)
    gate_payload = evaluate_go_gate(artifact, wav_path)
    data["gate"] = gate_payload
    json_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return gate_payload
