# ADR-028: Avatar kênh trên thẻ kết mời theo dõi

- Trạng thái: **Accepted**. Director 2026-11-13 gửi avatar kênh "Tí Hay Hỏi", hỏi có nên thay chữ tên kênh ở cuối video bằng avatar không, rồi chọn làm luôn.
- Ngày: 2026-11-13
- Liên quan:
  - [ADR-026](ADR-026-title-and-follow-outro.md): thẻ kết `FollowCard`;
  - [ADR-021](ADR-021-cards-redo-and-export.md): thẻ chữ là ngoại lệ "không chữ trên màn hình".

## Bối cảnh

Thẻ kết mời theo dõi đang hiện tên kênh bằng chữ, mỗi chữ cái bật lên. Avatar là thứ người xem thấy cạnh mọi video và bình luận trên YouTube, TikTok. Màn hình kết thúc của YouTube cũng đặt avatar kênh cạnh nút Đăng ký. Avatar của kênh đã có sẵn chữ "Tí Hay Hỏi".

## Quyết định

1. **Nơi đặt avatar:** file `data/brand/<slug>/avatar.<png|webp|jpg|jpeg>`, do Director đặt. Có nhiều file thì ưu tiên theo thứ tự `png`, `webp`, `jpg`, `jpeg`. Chưa có trang tải avatar lên; tạm thời chép file vào đúng chỗ.
2. **Đưa vào video:** job render chép avatar sang `render/public/brand/<slug>/avatar-<sha12><ext>` (`publishBrandAvatar`) rồi ghi khóa đó vào `cards.outro.avatar`.
   - Tên file có hash: đổi ảnh thì props đổi, nên cache MP4 không trả bản cũ.
   - Composition đọc ảnh bằng `staticFile`.
3. **Thẻ kết có avatar:**
   - Avatar tròn, viền trắng, vòng sáng màu nhấn của kênh nhấp nháy theo nhịp.
   - Avatar bật ra, xoay nhẹ, lơ lửng; nảy lên khi con trỏ bấm Follow.
   - Avatar thay chữ tên kênh, vì logo đã có tên.
   - Lời mời và nút Follow (chuông, con trỏ, "✓ Đã follow") giữ như ADR-026.
   - Khung dọc: avatar 320 px ở trên, lời mời và nút ở dưới. Thẻ đặt cách mép trên 130 px để đáy thẻ vẫn ở trên đầu nhân vật.
   - Khung ngang: avatar 190 px bên trái, lời mời và nút bên phải. Thẻ thấp, không che đầu nhân vật.
4. **Kênh chưa có avatar:** thẻ hiện tên kênh bằng chữ như ADR-026.
5. **Version:** `StickStory` lên `1.11.0`.

## Hệ quả

- **Dựng lại video:** video đang chờ duyệt bản cuối bấm "Dựng lại" thì có avatar. Không gọi AI, không đọc lại giọng.
- **Avatar là logo, không phải nhân vật hoạt hình:** Tí trong avatar vẽ khác Tí trong video một chút, chấp nhận vì avatar đứng tách khỏi cảnh.
- **Còn thiếu:** trang tải avatar lên trong "Bộ nhận diện kênh".
