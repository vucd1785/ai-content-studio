from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class AlignmentWord(BaseModel):
    text: str
    startMs: int = Field(ge=0)
    endMs: int = Field(ge=0)


class AlignmentValidation(BaseModel):
    ok: bool
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    wordCount: int = 0
    alignedWordCount: int = 0
    missingWords: list[str] = Field(default_factory=list)
    coverageStartMs: int | None = None
    coverageEndMs: int | None = None
    durationDeltaMs: int | None = None
    nonMonotonicWordRatio: float | None = None
    timelineOrderRatio: float | None = None
    # ADR-012 bổ sung 2026-11-02: số từ độ dài 0 được sửa (khoảng ước lượng, không phải đo được).
    repairedWordCount: int = 0


class AlignmentArtifact(BaseModel):
    audioId: str
    durationMs: int
    transcript: str
    engine: str
    modelId: str
    words: list[AlignmentWord]
    validation: AlignmentValidation
    processingMs: int
    metadata: dict[str, Any] = Field(default_factory=dict)

    def to_json_dict(self) -> dict[str, Any]:
        return self.model_dump(mode="json")
