# VieNeu-TTS v3 Turbo — CPU/ONNX (torch-free), Apache 2.0 SDK
FROM python:3.12-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HF_HOME=/cache/huggingface \
    DATA_DIR=/data \
    VIENEU_BACKEND=onnx \
    VIENEU_PRECISION=fp32 \
    TTS_DEFAULT_VOICE="Mai Anh" \
    TTS_PRELOAD_MODEL=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml README.md ./
COPY app ./app

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir .

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=300s --retries=5 \
    CMD python -c "import urllib.request,sys; r=urllib.request.urlopen('http://127.0.0.1:8000/health',timeout=5); d=r.read(); sys.exit(0 if b'\"status\":\"ok\"' in d else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
