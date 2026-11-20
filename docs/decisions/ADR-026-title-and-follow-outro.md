# ADR-026: Mở đầu đọc tiêu đề, kết bằng cảnh ba nhân vật mời theo dõi

- Trạng thái: **Accepted**. Director 2026-11-12: "tui muốn thêm giọng đọc cuối để bảo người xem follow để xem thêm nhiều kiến thức thú vị nữa … mở đầu nên có giọng đọc chủ đề của video và một cảnh tượng trưng cho chủ đề, sau đó mới bắt đầu câu chuyện, ảnh cuối cũng nên tạo một ảnh có chung 3 nhân vật thể hiện người dùng follow".
- Ngày: 2026-11-12
- Liên quan:
  - [ADR-013](ADR-013-brand-kit-and-formats.md): gói thể loại có version;
  - [ADR-020](ADR-020-director-review-tools.md): luật mở và kết của kịch bản;
  - [ADR-021](ADR-021-cards-redo-and-export.md): thẻ tiêu đề, thẻ kết;
  - [ADR-024](ADR-024-editing-rhythm.md): gói `story` v3;
  - [ADR-025](ADR-025-acting-effects-camera.md): hành động, hiệu ứng.

## Bối cảnh

Video hiện vào thẳng câu chuyện. Thẻ tiêu đề hiện 2,4 giây đầu nhưng không ai đọc nó.

Câu kết là "mời theo dõi hoặc hỏi người xem". Agent kịch bản thường chọn câu hỏi, nên ít video có lời mời theo dõi. Ảnh cuối cũng là shot bất kỳ của cảnh chốt.

## Quyết định

### 1. Gói `story` v4

Gói `story` v4 giống v3: cùng nhịp cắt, cùng thời lượng. Gói thêm hai nhịp:

| Nhịp | Vị trí | Nội dung |
|---|---|---|
| `title` | Đầu video | Một cảnh ngắn, 1–2 shot, khoảng 3 giây. Câu duy nhất là tiêu đề của phương án, một nhân vật đọc nguyên văn. Hình tượng trưng cho chủ đề: nhân vật bên đồ vật hoặc minh họa của chủ thể chính, tông `wonder`, hiệu ứng `sparkle`. |
| `outro` | Cuối video | Một cảnh, đúng một câu và một shot. Nhân vật tự mời người xem theo dõi, xưng "chúng mình", dưới 80 ký tự. Ví dụ "Follow chúng mình để biết thêm nhiều kiến thức thú vị nhé!" (Director chọn cách nói này 2026-11-12). |

- Cảnh `payoff` trước đó kết bằng câu hỏi để người xem trả lời trong bình luận.
- Brief mới dùng v4 (`DEFAULT_FORMAT`). Brief cũ giữ gói đã ghi. Lưu lại brief thì brief lên v4.
- Gói cũ giữ luật kết của ADR-020.

### 2. Code dựng hình cảnh `outro`

Sau khi đổi kịch bản về dạng lồng nhau và trước khi kiểm Zod, `stageOutroScenes` thay shot của cảnh `outro` bằng một shot cố định:

- Cỡ `wide`. Nếu shot ngay trước cũng `wide` thì dùng `high`, để giữ luật không hai shot liền cùng cỡ.
- Cả dàn nhân vật có trong video, tối đa 3, đều `action_follow` và `expr_happy`.
- Máy `cam_end_card` (mục 4), tông `warm`, hiệu ứng `confetti`.
- Shot neo câu đầu của cảnh. Không có đồ vật, không minh họa.

LLM chỉ viết câu mời. Director vẫn sửa được chữ ở Cổng 1.

- **Thiếu tài sản:** kho chưa có `action_follow` thì dùng `action_wave`. Chưa có `cam_end_card` thì dùng `cam_push_in`; chưa có cả hai thì bỏ trường máy.
- **Danh mục:** `action_follow`, `expr_happy`, `cam_end_card`, `cam_push_in` luôn có trong danh mục kịch bản khi kho có.

### 3. Hành động `action_follow`, làm tay, `approved`

Nhân vật đứng nhìn người xem, tay chống hông. Tay kia chỉ chếch lên nút theo dõi ở phần trên khung (thẻ kết), rồi nhấn nhấn như đang bấm nút giúp người xem; người nhún theo mỗi lần nhấn.

Hành động qua kiểm tay và khuỷu không chạm đầu của `kit.test.tsx` với cả ba nhân vật.

### 4. Ảnh kết

- **Vị trí đứng:** người cao nhất đứng giữa, hai người còn lại đứng hai bên và cùng chỉ vào giữa phía trên. Thử với người thấp đứng giữa thì tay chỉ của người giữa chạm tay người bên phải. Video và ảnh storyboard dùng chung `sceneSlots`.
- **Góc máy `cam_end_card`, làm tay, `approved`:** máy lùi nhẹ (zoom 0,9) và nâng lên, nhân vật xuống phần dưới khung, chừa trời phía trên cho thẻ. Với máy thường, ở khung ngang 16:9 đầu nhân vật sát mép trên, nên thẻ nào đặt ở trên cũng che đầu.
- **Không chia shot:** cảnh `outro` không bị `fixPacing` chia hay đổi cỡ, không bị `directCameras` đổi máy, và không tính vào kiểm nhịp.

### 5. Chữ của cảnh mở và cảnh kết

Director 2026-11-12: chữ của cảnh mở và cảnh kết không nên giống phụ đề, mà nên nằm giữa hoặc phía trên. Thẻ kết nên có hiệu ứng động và làm nổi bật tên kênh trong database.

- **Bỏ phụ đề:** câu đọc ở cảnh `title` và `outro` không hiện bằng phụ đề màu ở đáy khung. Chữ của câu đó nằm trên thẻ (`storyCards`).
  - Câu quá dài cho thẻ (tiêu đề trên 80 ký tự, lời mời trên 90 ký tự) thì giữ phụ đề và thẻ như ADR-021.
- **Thẻ tiêu đề:** chữ trắng là câu nhân vật đọc. Thẻ hiện suốt cảnh `title` (`cards.intro.toFrame`), ít nhất 2,4 giây.
- **Vị trí thẻ:** khung dọc đặt thẻ ở vùng trời trống của nửa trên khung, cách mép trên 300 px. Khung ngang đặt thẻ rộng và thấp để không che đầu nhân vật.
- **Thẻ kết `FollowCard`, chuyển động, chạy suốt cảnh `outro`** (`cards.outro.fromFrame`):
  - Tên kênh (`display_name`) chữ to, tô màu nhấn của kênh (`palette.accent`, `cards.outro.accent`), viền trắng. Từng chữ cái bật lên rồi nhấp nhô.
  - Lời mời màu kem, hiện dần từng từ.
  - Nút đỏ "Follow" có chuông lắc. Con trỏ chuột bay vào bấm, nút đổi thành "✓ Đã follow", vòng sáng và sao bung ra: người xem thấy hành động theo dõi.
  - Viền thẻ màu nhấn, phát sáng nhịp nhẹ.
- **Ngoại lệ:** thẻ là ngoại lệ "chữ trên màn hình" của ADR-021, không mở rộng ra chỗ khác.

### 6. Version

Motion kit `0.10.0`. `StickStory` lên `1.10.0+kit.0.10.0`.

## Hệ quả

- **Thời lượng:** video dài thêm khoảng 6–8 giây cho hai cảnh mới, nằm trong thời lượng của brief. Prompt nói rõ hai cảnh này ngắn.
- **Brief cũ:** run của brief v3 trở về trước không đổi.
- **Ảnh storyboard ở Cổng 1:** ảnh có ba nhân vật chỉ tay lên, kèm phụ đề mẫu. Thẻ chữ và hiệu ứng thẻ kết chỉ có trong video.
- **Giọng đọc:** chữ "Follow" do giọng TTS tiếng Việt đọc. Director cần nghe thử; đọc chưa tốt thì sửa câu thành "Theo dõi chúng mình…" ở Cổng 1.
- **Chưa làm:** cảnh `title` vẫn do LLM dựng hình. Code chưa kiểm câu đọc có đúng nguyên văn tiêu đề không.
