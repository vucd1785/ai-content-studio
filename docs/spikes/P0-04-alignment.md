# Spike P0-04 — Vietnamese forced alignment

## Mục tiêu

Căn transcript đã biết với WAV TTS (VieNeu P0-03) và đo cổng trong [05-VIDEO-PIPELINE.md](../05-VIDEO-PIPELINE.md).

## Phương án đã thử

| Phương án | Model | License | Kết quả trên WAV TTS |
|---|---|---|---|
| **CTC (ADR chính)** | `nguyenvulebinh/wav2vec2-base-vietnamese-250h` + `torchaudio.functional.forced_align` | Apache-2.0 (model) | **Không đạt cổng**: ~45/184 token CTC khớp; phủ thời gian ~5,2 s / 10,56 s trên mẫu Redis P0-03 |
| **Whisper align (dự phòng ADR-005)** | OpenAI Whisper `base` qua `stable-ts` 2.17+ | MIT (Whisper), MIT (`stable-ts`) | **Đạt cổng** trên mẫu 44 s giáo dục và WAV P0-03 |

## Lựa chọn triển khai spike

**Engine mặc định MVP (ADR-011 Accepted):** `whisper` (`stable-ts`, model `base`, language `vi`, known transcript). Spike CLI có thể vẫn default `ctc` cho đến `P1-02`.

Lý do: giọng TTS VieNeu (ONNX) lệch phát âm so với acoustic model ASR VLSP; forced alignment CTC không giữ đủ token trên audio thật. Whisper align với transcript cố định bám timeline tốt hơn trên cùng WAV.

Module `app/alignment/ctc_backend.py` giữ để thay thế sau (ADR vẫn ưu tiên CTC khi có model phù hợp TTS).

## Lệnh tái hiện

```powershell
cd services\tts
$env:DATA_DIR="e:\Docker\ai-content-studio\data"
$env:HF_HOME="E:\AIModels\HuggingFace"
pip install -e ".[dev,align,align-whisper]"

# WAV P0-03 (transcript khớp reports/P0-03.md + tests/test_api_contract.py)
$t = "Redis là một hệ thống lưu trữ dữ liệu trong bộ nhớ. Khi ứng dụng sử dụng Redis Cache, dữ liệu thường xuyên được truy cập có thể được lấy nhanh hơn, giúp giảm tải cho cơ sở dữ liệu."
python scripts\align_once.py --wav "e:\Docker\ai-content-studio\data\tts\42daebb50e1a43759a1cdc7a439deb04.wav" --transcript $t --engine whisper --audio-id 42daebb50e1a43759a1cdc7a439deb04

# Mẫu cổng ~44 s (fixture script.edu, TTS mới)
python scripts\align_once.py --wav "e:\Docker\ai-content-studio\data\tts\5bf561a3048346639aabb497df357d33.wav" --transcript (Get-Content -Raw "e:\Docker\ai-content-studio\data\tts\p0_04_gate_transcript.txt" -Encoding UTF8) --engine whisper --audio-id 5bf561a3048346639aabb497df357d33

python scripts\inspect_alignment.py "e:\Docker\ai-content-studio\data\alignment\5bf561a3048346639aabb497df357d33.json"

python -m pytest tests/ -q -m "not integration"
$env:ALIGN_INTEGRATION="1"
python -m pytest tests/test_alignment_integration.py -q -m integration
```

## Số đo cổng (Whisper `base`, mẫu 44 s)

- `durationMs`: 44000 (ffprobe)
- **Director (2026-10-28):** chấp nhận **44.000 s** là đủ cho cổng Phase 0 “khoảng 45–60 giây”; không synthesize lại. Chỉ spike khả thi số, không khẳng định độ khớp nghe production.
- `alignedWordRatio`: 1.0 (143/143 token có `endMs > startMs`)
- `durationDeltaMs`: 120 (ngưỡng ±250 ms)
- `processingMs`: ~25 s (CPU i3-4005U, lần chạy spike)

## Kiểm tra thủ công

`scripts/inspect_alignment.py` in bảng `start | end | text` và cờ `[MISSING]` khi interval rỗng.

## Hạn chế đã biết

- Thuật ngữ Latin (Redis, API) phụ thuộc cách VieNeu đọc; cần QA Director quanh từ đó.
- CTC Việt hiện không dùng cho TTS VieNeu cho đến khi có model acoustic khớp hơn.
- Whisper `base` ~139 MB tải lần đầu vào `HF_HOME` / cache Whisper.
- Chuẩn hóa số/ngày nói (bước 1 pipeline) chưa có thư viện Vinorm — chỉ preprocess em dash và gộp punctuation trong spike.

Decision: go
