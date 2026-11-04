from __future__ import annotations

import json
from pathlib import Path

from app.alignment.gate import evaluate_go_gate
from app.alignment.repair import validate_with_repair
from app.alignment.schema import AlignmentArtifact, AlignmentValidation, AlignmentWord
from app.alignment.tokenize import tokenize_transcript_words


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


def revalidate_on_disk(
    wav_path: Path, json_path: Path, audio_id: str
) -> tuple[AlignmentArtifact, dict[str, object]]:
    """Sửa từ độ dài 0, validate lại và tính lại cổng trên kết quả đã lưu (không chạy lại Whisper).

    Transcript đã lưu là bản đã chuẩn hóa nên tách token trực tiếp. Ghi đè words, validation, gate.
    """
    data = json.loads(json_path.read_text(encoding="utf-8"))
    artifact = artifact_from_saved_json(data, audio_id)
    expected = tokenize_transcript_words(artifact.transcript)
    words, validation = validate_with_repair(artifact.words, expected, artifact.durationMs)
    artifact = artifact.model_copy(update={"words": words, "validation": validation})
    gate_payload = evaluate_go_gate(artifact, wav_path)
    data["words"] = [w.model_dump(mode="json") for w in words]
    data["validation"] = validation.model_dump(mode="json")
    data["gate"] = gate_payload
    json_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return artifact, gate_payload


def reevaluate_gate_on_disk(wav_path: Path, json_path: Path, audio_id: str) -> dict[str, object]:
    return revalidate_on_disk(wav_path, json_path, audio_id)[1]
