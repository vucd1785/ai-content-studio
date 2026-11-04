# ADR-015: Nhiều giọng đọc theo nhân vật

- Trạng thái: Accepted (Director duyệt 2026-11-02)
- Ngày: 2026-11-02

## Bối cảnh

Script schema `1` chỉ có `narration` theo cảnh. Toàn video dùng một giọng (`TTS_DEFAULT_VOICE`). Dàn nhân vật của ADR-013 có hai nhân vật nói (Tí, Bit), nên cần biết câu nào của ai và đọc bằng giọng nào.

`services/tts` đã nhận `{ text, voiceId }` (ADR-005). Service đang nạp 25 giọng mẫu của VieNeu v3 Turbo. Cache synthesize đã có khóa theo `text` + `voice`. Máy chỉ có CPU: một cảnh khoảng 5–8 giây đọc mất vài phút.

## Quyết định

**Đơn vị lời thoại là câu, có người nói.** Script schema `2` thay `narration` của cảnh bằng `lines[]`, mỗi phần tử gồm:

- `id`;
- `speaker`: id nhân vật trong kênh, hoặc `narrator`;
- `text`;
- `emotion` tùy chọn, để chọn biểu cảm, không đổi giọng.

Nhân vật có `speaks = false` trong kênh không được làm `speaker`. Zod chặn trường hợp này. (Bổ sung ADR-013 ngày 2026-11-03: Đậu có lời thoại, nên câu này không còn gọi tên Đậu.)

**Giọng do kênh quyết định.** `brand_profiles` gán một giọng VieNeu (preset) cho mỗi nhân vật nói. Director chọn giọng trên giao diện. Agent không tự điền tên giọng vào tài liệu hay seed.

**Synthesize theo câu.** Voice job đọc từng câu với giọng của người nói. Cache theo `text` + `voice` như hiện tại, nên sửa một câu chỉ đọc lại câu đó. Các câu nối thành audio của cảnh. Khoảng nghỉ giữa hai câu là hằng số trong code, đổi người nói thì nghỉ dài hơn. Độ dài cảnh vẫn là tổng duration đo được bằng ffprobe (05-VIDEO-PIPELINE).

**Alignment theo câu.** Mỗi câu được căn riêng với transcript của chính câu đó, rồi dịch thời gian theo vị trí câu trong cảnh. Cổng alignment (ADR-011, ADR-012) áp dụng cho từng câu.

**Phụ đề có người nói.** Mỗi từ trong `captions[]` mang thêm `speaker`. Template tô màu phụ đề theo nhân vật. Shot list (ADR-014) dùng `speaker` để chọn ai mở miệng, ai phản ứng.

**Tương thích.** Script `1` được đọc như một chuỗi câu của `narrator` với giọng mặc định. Video cũ render lại vẫn ra kết quả như cũ.

## Phương án đã cân nhắc

- **Một giọng kể chuyện, nhân vật chỉ diễn.** Không đổi pipeline, nhưng mất phần hội thoại, vốn là chất liệu chính của tiểu phẩm và "Nếu như…?".
- **Đổi giọng bằng hậu kỳ** (pitch shift trên một giọng). Rẻ, nhưng nghe giả, và vẫn cần biết câu nào của ai.
- **Voice clone.** Ngoài MVP (ADR-005, 08-SECURITY). Khi mở cần ghi nhận consent.

## Hệ quả

- ADR-005 giữ nguyên hợp đồng `POST /synthesize` và `POST /align`; chỉ số lần gọi tăng.
- Rủi ro: Whisper căn câu rất ngắn (dưới 1 giây, ví dụ "Tua lại.") có thể kém chính xác. Cần một spike đo trên các câu ngắn trước khi chốt. Nếu không đạt, gộp câu ngắn liền nhau của cùng người nói trước khi căn.
- Thời gian voice tăng nhẹ vì mỗi câu là một lần gọi riêng; tổng thời lượng audio không đổi. Ước tính thời gian trên giao diện phải đo lại.
- Sửa [05-VIDEO-PIPELINE.md](../05-VIDEO-PIPELINE.md) (Script JSON, TTS, Alignment), [03-DATABASE-DESIGN.md](../03-DATABASE-DESIGN.md) (giọng của nhân vật), và màn duyệt kịch bản cho phép sửa câu theo người nói (P2-12).
- Âm thanh không lời của nhân vật không nói lấy từ kho SFX có license (ADR-014), không qua TTS.

Liên quan: [ADR-005](ADR-005-tts-alignment.md), [ADR-013](ADR-013-brand-kit-and-formats.md), [ADR-014](ADR-014-motion-kit-and-shot-list.md).

## Bổ sung 2026-11-02: căn chữ theo cảnh

Director duyệt sau spike [P6-02](../spikes/P6-02-short-line-alignment.md). Mục này thay đoạn **Alignment theo câu** ở trên.

Kết quả spike, đo bằng Whisper `base` với cổng hiện hành:

- căn từng câu ngắn (dưới 1 giây) qua cổng 16/20, do hai lỗi: từ đầu dài 0, và từ cuối kết thúc sớm quá 250 ms;
- căn từng câu vừa qua cổng 20/20;
- đệm im lặng làm kết quả tệ hơn (2/20);
- căn cả cảnh ghép từ các câu đọc riêng của hai giọng qua cổng 4/4, 88/89 từ rơi đúng câu.

Một lần căn mất khoảng 7 giây, gần như không đổi theo độ dài.

**Quyết định.**

- **Đọc theo câu, căn theo cảnh.**
  - Synthesize vẫn theo câu, cache theo `text` + `voice`.
  - Voice job ghép các câu của cảnh với khoảng nghỉ hằng số, rồi căn **một lần** với transcript của cả cảnh.
  - Cổng ADR-011/012 áp dụng cho cả cảnh, như trước.
- **Chia từ về câu.**
  - Từ được gán cho câu theo thứ tự token sau chuẩn hóa.
  - Ranh giới câu lấy từ vị trí ghép, do code biết chính xác.
  - Từ nằm ngoài đoạn câu quá dung sai (hằng số trong code) thì được kẹp về trong đoạn, kèm warning QA.
- **Dự phòng.** Cảnh trượt cổng thì căn lại từng câu vừa, gộp các câu ngắn liền nhau. Vẫn trượt thì voice job fail với lỗi alignment như hiện nay.
- **Sửa một câu.** Đọc lại đúng câu đó, rồi căn lại cả cảnh.

**Hệ quả thêm.** Service TTS cần căn được WAV đã ghép, nhưng hiện chỉ căn được WAV nằm trong thư mục đầu ra của nó. P6-08 chọn cách nào giữ nguyên hợp đồng ADR-005, ví dụ worker ghi WAV cảnh vào cùng thư mục với tên artifact hợp lệ. Nếu phải thêm endpoint thì P6-08 báo `blocked` và trình Director.
