from __future__ import annotations

from app.alignment.schema import AlignmentValidation, AlignmentWord


def validate_alignment(
    words: list[AlignmentWord],
    expected_tokens: list[str],
    duration_ms: int,
    *,
    long_gap_ms: int = 1500,
) -> AlignmentValidation:
    errors: list[str] = []
    warnings: list[str] = []

    aligned = [w for w in words if w.endMs > w.startMs]
    missing: list[str] = []

    if len(words) != len(expected_tokens):
        missing_count = abs(len(words) - len(expected_tokens))
        warnings.append(
            f"token count mismatch: expected {len(expected_tokens)}, got {len(words)}"
        )
        if len(words) < len(expected_tokens):
            missing = expected_tokens[len(words) :]

    non_mono = 0
    prev_end = -1
    for idx, word in enumerate(words):
        if word.startMs < 0 or word.endMs < 0:
            errors.append(f"negative timestamp at index {idx}")
        if word.endMs <= word.startMs:
            errors.append(f"invalid interval at index {idx}: {word.text!r}")
        if word.startMs < prev_end:
            non_mono += 1
            errors.append(f"overlapping or out-of-order at index {idx}: {word.text!r}")
        if word.endMs > duration_ms + 1:
            errors.append(
                f"endMs exceeds duration at index {idx}: {word.endMs} > {duration_ms}"
            )
        prev_end = max(prev_end, word.endMs)

    if words:
        for i in range(1, len(words)):
            gap = words[i].startMs - words[i - 1].endMs
            if gap > long_gap_ms:
                warnings.append(
                    f"long silence gap {gap} ms between {words[i - 1].text!r} and {words[i].text!r}"
                )

    coverage_start = words[0].startMs if words else None
    coverage_end = words[-1].endMs if words else None
    duration_delta = None
    if coverage_end is not None:
        duration_delta = duration_ms - coverage_end
        if abs(duration_delta) > 250:
            warnings.append(
                f"coverage end delta {duration_delta} ms vs audio duration (threshold 250 ms)"
            )

    ratio = None
    if words:
        ratio = 1.0 - (non_mono / len(words))

    ok = len(errors) == 0 and len(aligned) == len(words)

    return AlignmentValidation(
        ok=ok,
        errors=errors,
        warnings=warnings,
        wordCount=len(expected_tokens),
        alignedWordCount=len(aligned),
        missingWords=missing,
        coverageStartMs=coverage_start,
        coverageEndMs=coverage_end,
        durationDeltaMs=duration_delta,
        nonMonotonicWordRatio=ratio,
    )
