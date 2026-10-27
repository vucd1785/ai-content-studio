# ADR-005: TTS và alignment

- Trạng thái: Accepted
- Ngày: 2026-10-27

## Bối cảnh

MVP cần giọng tiếng Việt chạy local và phụ đề theo từ. Endpoint speech của VieNeu trả audio, không trả word timestamp. Chia duration đều cho các từ không đủ để khớp miệng chữ trên màn hình.

## Quyết định

`services/tts` expose `POST /synthesize` và `POST /align`. Bên trong synthesize là VieNeu-TTS v3 Turbo, preset voice, profile CPU mặc định. v4 và voice clone không thuộc image MVP.

Alignment là forced alignment giữa transcript đã biết và WAV. Hướng chính là CTC với acoustic model tiếng Việt có license đã được ghi trong spike. Whisper ở chế độ align với cùng transcript là phương án trong `P0-04` nếu CTC không đạt ngưỡng của [../05-VIDEO-PIPELINE.md](../05-VIDEO-PIPELINE.md).

Sửa timing là `caption_override`, không gọi lại TTS.

## Hệ quả

`P0-04` có thể kết thúc `no-go`. Khi đó Phase 1 dừng để xem lại ADR này, không tự chuyển sang ước lượng theo số từ.

Xem [../05-VIDEO-PIPELINE.md](../05-VIDEO-PIPELINE.md).
