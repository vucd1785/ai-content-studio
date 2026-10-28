# ADR-011: Whisper là engine alignment mặc định của MVP

- Trạng thái: Accepted
- Ngày: 2026-10-28
- Liên quan: [ADR-005](ADR-005-tts-alignment.md)

## Bối cảnh

MVP cần forced alignment giữa transcript kịch bản và WAV VieNeu-TTS. Spike `P0-04` đo trên audio thật từ VieNeu v3 Turbo (CPU/ONNX).

Hướng CTC trong ADR-005 dùng acoustic model `nguyenvulebinh/wav2vec2-base-vietnamese-250h` (Apache-2.0) với `torchaudio.functional.forced_align`. Trên WAV TTS VieNeu, CTC **không đạt cổng số** trong [../05-VIDEO-PIPELINE.md](../05-VIDEO-PIPELINE.md): phủ thời gian không đủ so với duration ffprobe (chi tiết trong [../spikes/P0-04-alignment.md](../spikes/P0-04-alignment.md) và `reports/P0-04.md`).

Phương án dự phòng cùng spike: OpenAI Whisper `base` (MIT) qua `stable-ts` 2.17+ (MIT), align với **transcript đã biết**, language `vi`. Trên artifact mẫu giáo dục đã đo:

- ffprobe WAV: **44.000 s** (Director chấp nhận là đủ bằng chứng Phase 0 cho mục “khoảng 45–60 giây”; không yêu cầu synthesize lại chỉ để đạt 45.000 s).
- 143/143 token có `endMs > startMs`, timeline đơn điệu (0 overlap theo validator spike), `durationDeltaMs` 120 (ngưỡng ±250 ms).

Cổng trên là **khả thi số và cấu trúc timestamp**, không chứng minh độ khớp nghe từng từ với miệng đọc TTS.

## Quyết định

1. Engine alignment **mặc định của MVP** (CLI spike, sau đó `POST /align` trong `P1-02`): **`whisper`**, model **`base`**, language **`vi`**, transcript cố định từ kịch bản (known transcript), qua `stable-ts`.
2. Alignment vẫn nằm trong **`services/tts`**, cùng volume `DATA_DIR` với synthesize. Không thêm process hay service alignment riêng.
3. Module **CTC** (`ctc_backend.py`) **giữ lại** như đường **tùy chọn / thử nghiệm**, không phải default MVP, cho đến khi một acoustic model khác đạt cùng cổng trên audio VieNeu và Director duyệt đổi default.
4. Thay engine sau này (Whisper size khác, CTC mới, v.v.) cần spike hoặc task có đo cổng và cập nhật ADR nếu đổi default.

Implementation spike `P0-04` vẫn có thể default CLI là `ctc` cho đến `P1-02`; ADR này ghi **quyết định kiến trúc**, không bắt buộc đổi code trong closeout Phase 0.

## Hạn chế cổng số (Phase 0)

- Metric spike (`alignedWordRatio`, `durationDeltaMs`, field `nonMonotonicWordRatio`) mô tả **hợp lệ cấu trúc**, chưa thay QA nghe thử Director.
- `passesGate` trong spike chưa ràng buộc đủ `validation.ok` và thứ tự thời gian; sửa thuộc `P1-02`.
- Cache model Whisper `base` trên máy dev hiện có thể nằm ngoài `HF_HOME` (ví dụ `%USERPROFILE%\.cache\whisper`); di chuyển cache thuộc task vận hệnh sau.

## Hệ quả

- Phase 1 task **P1-02** khóa hợp đồng JSON alignment và đặt default runtime `whisper` theo ADR này.
- ADR-005 vẫn đúng cho VieNeu v3 CPU, hai endpoint facade, và `caption_override`.
- Pipeline doc [../05-VIDEO-PIPELINE.md](../05-VIDEO-PIPELINE.md) tham chiếu ADR-011 cho bước alignment MVP.

Xem [../05-VIDEO-PIPELINE.md](../05-VIDEO-PIPELINE.md) và [../spikes/P0-04-alignment.md](../spikes/P0-04-alignment.md).
