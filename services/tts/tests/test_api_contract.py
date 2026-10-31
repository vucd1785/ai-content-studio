import os

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_degraded_without_model() -> None:
    # Không tải model trong unit test mặc định
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["model"] == "VieNeu-TTS-v3-Turbo"
    assert body["status"] in ("ok", "degraded")


def test_main_does_not_bind_align_pipeline_at_import() -> None:
    import app.main as main

    assert "align_transcript_to_wav" not in main.__dict__


@pytest.mark.integration
def test_synthesize_redis_sentence() -> None:
    if os.environ.get("TTS_INTEGRATION") != "1":
        pytest.skip("set TTS_INTEGRATION=1 to run model inference")

    sentence = (
        "Redis là một hệ thống lưu trữ dữ liệu trong bộ nhớ. "
        "Khi ứng dụng sử dụng Redis Cache, dữ liệu thường xuyên được truy cập "
        "có thể được lấy nhanh hơn, giúp giảm tải cho cơ sở dữ liệu."
    )
    response = client.post("/synthesize", json={"text": sentence})
    assert response.status_code == 200
    data = response.json()
    assert data["durationSeconds"] > 0
    assert data["sampleRate"] > 0
    assert data["rtf"] > 0
