# Service TTS (P0-03)

Facade FastAPI bọc **VieNeu-TTS v3 Turbo** (ONNX/CPU mặc định). Model tải từ Hugging Face lần đầu; không commit weight vào Git.

## Chạy với Docker Compose (khuyến nghị)

Từ thư mục gốc monorepo:

```bash
docker compose --profile cpu up -d --build tts
curl http://localhost:8000/health
```

Tổng hợp một câu mẫu:

```bash
curl -s -X POST http://localhost:8000/synthesize \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"Xin chào.\"}" | jq
```

File WAV nằm trong `./data/tts/` (volume `DATA_DIR`).

## Spike CLI (tùy chọn, cùng engine)

```bash
cd services/tts
pip install .
python scripts/synthesize_once.py --text "Redis là một hệ thống lưu trữ dữ liệu trong bộ nhớ."
```

Biến môi trường: `DATA_DIR`, `TTS_DEFAULT_VOICE`, `VIENEU_BACKEND`, `VIENEU_PRECISION`.

## Spike alignment (P0-04)

Cài optional deps và chạy trên WAV + transcript đã biết (không chia đều duration):

```bash
pip install -e ".[align,align-whisper]"
python scripts/align_once.py --wav "$DATA_DIR/tts/<id>.wav" --transcript "..." --engine whisper
python scripts/inspect_alignment.py "$DATA_DIR/alignment/<id>.json"
```

Chi tiết model, license và cổng Go: [docs/spikes/P0-04-alignment.md](../../docs/spikes/P0-04-alignment.md).
