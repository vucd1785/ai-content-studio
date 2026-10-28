from app.alignment.schema import AlignmentWord
from app.alignment.tokenize import tokenize_transcript_words
from app.alignment.validate import validate_alignment


def test_tokenize_preserves_vietnamese() -> None:
    words = tokenize_transcript_words("Redis giúp tăng tốc ứng dụng.")
    assert words == ["Redis", "giúp", "tăng", "tốc", "ứng", "dụng."]


def test_preprocess_em_dash() -> None:
    words = tokenize_transcript_words("Redis — nhanh")
    assert words == ["Redis", "nhanh"]


def test_validate_rejects_negative_and_overlap() -> None:
    words = [
        AlignmentWord(text="a", startMs=0, endMs=100),
        AlignmentWord(text="b", startMs=50, endMs=200),
    ]
    result = validate_alignment(words, ["a", "b"], duration_ms=500)
    assert not result.ok
    assert any("out-of-order" in e or "overlapping" in e for e in result.errors)


def test_validate_rejects_exceed_duration() -> None:
    words = [AlignmentWord(text="a", startMs=0, endMs=600)]
    result = validate_alignment(words, ["a"], duration_ms=500)
    assert not result.ok


def test_validate_token_count_mismatch_fails() -> None:
    words = [AlignmentWord(text="a", startMs=0, endMs=100)]
    result = validate_alignment(words, ["a", "b"], duration_ms=500)
    assert not result.ok
    assert any("token count mismatch" in e for e in result.errors)


def test_validate_timeline_order_ratio() -> None:
    words = [
        AlignmentWord(text="a", startMs=0, endMs=100),
        AlignmentWord(text="b", startMs=50, endMs=200),
    ]
    result = validate_alignment(words, ["a", "b"], duration_ms=500)
    assert result.timelineOrderRatio == 0.5
    assert result.nonMonotonicWordRatio == 0.5


def test_validate_empty_transcript_words() -> None:
    result = validate_alignment([], [], duration_ms=1000)
    assert result.ok


def test_validate_zero_duration_interval() -> None:
    words = [AlignmentWord(text="x", startMs=10, endMs=10)]
    result = validate_alignment(words, ["x"], duration_ms=1000)
    assert not result.ok
