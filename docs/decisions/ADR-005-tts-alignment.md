# ADR-005: TTS và alignment

- Trạng thái: Accepted
- Ngày: 2026-10-27

## Bối cảnh

MVP cần giọng tiếng Việt chạy local và phụ đề theo từ. Endpoint speech của VieNeu trả audio, không trả word timestamp. Chia duration đều cho các từ không đủ để khớp miệng chữ trên màn hình.

## Quyết định

`services/tts` expose `POST /synthesize` và `POST /align`. Bên trong synthesize là VieNeu-TTS v3 Turbo, preset voice, profile CPU mặc định. v4 và voice clone không thuộc image MVP.

Alignment là forced alignment giữa transcript đã biết và WAV. Spike `P0-04` đã thử CTC với acoustic model tiếng Việt; engine **mặc định MVP** sau go là Whisper theo [ADR-011](ADR-011-whisper-alignment-default.md). Whisper align với cùng transcript là phương án dự phòng trong spike khi CTC không đạt ngưỡng của [../05-VIDEO-PIPELINE.md](../05-VIDEO-PIPELINE.md). CTC vẫn có thể giữ như đường thử nghiệm tùy chọn trong `services/tts`.

Sửa timing là `caption_override`, không gọi lại TTS.

## Hệ quả

`P0-04` có thể kết thúc `no-go`. Khi đó Phase 1 dừng để xem lại ADR này, không tự chuyển sang ước lượng theo số từ. Khi `Decision: go` với Whisper, engine mặc định MVP được ghi trong [ADR-011](ADR-011-whisper-alignment-default.md).

Xem [../05-VIDEO-PIPELINE.md](../05-VIDEO-PIPELINE.md).
