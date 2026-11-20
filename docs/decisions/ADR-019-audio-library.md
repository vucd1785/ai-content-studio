# ADR-019: Thư viện âm thanh tự tạo (nhạc nền và hiệu ứng)

- Trạng thái: **Accepted** (Director 2026-11-11: "bạn tìm nguồn miễn phí hoặc nếu bạn tự tạo nhạc và lưu vào dự án để dùng lại thì hãy giúp tui thực hiện")
- Ngày: 2026-11-12
- Liên quan: [ADR-014](ADR-014-motion-kit-and-shot-list.md), [05](../05-VIDEO-PIPELINE.md)

## Bối cảnh

Review video "Vì sao nước biển mặn?" (2026-11-11): video chỉ có lời thoại, không nhạc nền, không hiệu ứng âm thanh. Đây là lý do lớn nhất khiến video có cảm giác "máy làm". `render_props.sfx` luôn là mảng rỗng.

Kênh có thể bật kiếm tiền, nên nhạc phải dùng được trong video kiếm tiền và không bị khiếu nại Content ID.

Các nguồn nhạc miễn phí (thư viện của nền tảng, Creative Commons, kho stock) đều có điều kiện riêng: ghi công, cấm phân phối lại, hoặc nhạc đã đăng ký Content ID. AGENTS.md cấm agent tự điền license.

## Quyết định

1. **Tự tạo bằng code trong repo**, không tải nhạc ngoài.
   - Gói mới `@studio/audio-kit`: `src/synth.ts` là bộ tổng hợp tất định (sine, họa âm, lọc biquad, vang Schroeder), không dùng mẫu thu âm.
   - `pnpm --dir packages/audio-kit generate` ghi WAV mono 16-bit 22.050 Hz vào `packages/audio-kit/assets/` cùng `manifest.json` (sha256).
   - File WAV được commit (`.gitignore` có ngoại lệ). Test buộc file khớp code.
   - Chủ dự án là chủ sở hữu (`LICENSE.md`). Không đăng ký nhạc này với dịch vụ Content ID.
2. **Bốn bản nhạc nền theo không khí**, là vòng lặp liền (đuôi ngân và vang cộng vòng về đầu), cùng độ to (RMS khoảng −21 dBFS):

   | Mood | Không khí |
   |---|---|
   | `vui_tuoi` | 112 BPM, ukulele, chuông |
   | `to_mo` | 96 BPM, pizzicato, mõ gỗ |
   | `nhe_nhang` | 84 BPM, pad, rải hợp âm |
   | `soi_dong` | 128 BPM, trống bốn nhịp |

   Script `2` có trường tùy chọn `music` (một trong bốn mood); prompt yêu cầu chọn. Thiếu thì dùng `vui_tuoi`.
3. **Bảy hiệu ứng:** `sfx_pop`, `sfx_whoosh`, `sfx_ding`, `sfx_boing`, `sfx_sparkle`, `sfx_scribble`, `sfx_blip`.
   - Code đặt hiệu ứng bằng luật, không gọi LLM (`planSfx`):
     - vút qua khi sang cảnh;
     - bật ra khi bong bóng nghĩ hiện; tiếng bút khi vẽ bảng;
     - bùng nhún khi nhân vật hoảng; lấp lánh khi ăn mừng; ting khi cận mặt ngạc nhiên.
   - Hai tiếng cách nhau ít nhất 20 frame. Khi trùng, giữ theo thứ tự ưu tiên: sang cảnh, rồi minh họa, rồi phản ứng.
4. **Trộn trong composition** (`StickStory` 1.5.0):
   - Nhạc lặp suốt video, mức 0,5 khi không ai nói, 0,22 khi có lời (ducking theo khoảng nói của nhân vật), lên xuống trong 8 frame.
   - Nhạc vào dần 20 frame đầu, tắt dần 45 frame cuối.
   - Worker chép file vào `publicDir` (`audio-kit/`) trước khi bundle.
5. **Cache:** tạo lại file âm thanh thì phải tăng `STICK_STORY_BASE_VERSION`, để cache MP4 không trả bản trộn cũ.

## Hệ quả

- Video có nhạc và hiệu ứng mà không tốn token, không có rủi ro license bên thứ ba.
- Nhạc tổng hợp đơn giản hơn nhạc thu âm thật.
- Muốn thêm bài thì sửa `TRACKS` trong `synth.ts`, chạy `generate`, thêm mood vào `MUSIC_MOODS`.
- Thay bằng nhạc ngoài sau này cần ADR mới ghi rõ license.
