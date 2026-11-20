# ADR-020: Sửa câu tại Cổng 1, tự kiểm kịch bản, QA hình, báo việc chờ duyệt

- Trạng thái: **Accepted** (Director 2026-11-11: "Các cải thiện còn lại sẽ theo đề xuất cách giải quyết của bạn")
- Ngày: 2026-11-12
- Liên quan: [ADR-004](ADR-004-human-approval.md), [ADR-009](ADR-009-3d-monitoring.md), [ADR-014](ADR-014-motion-kit-and-shot-list.md), [ADR-017](ADR-017-auto-asset-generation.md), [07](../07-API-CONTRACTS.md)

## Bối cảnh

Review dự án ngày 2026-11-11:
- Muốn đổi một chữ trong câu (ví dụ "Bít" thành "Bit") phải bấm "Yêu cầu sửa", tức gọi lại LLM và tốn token.
- Lỗi phổ biến của video ngắn (câu hỏi đến muộn, giải thích không có hình, ba cảnh cùng nền, câu dài) chỉ phát hiện khi xem video.
- QA chỉ kiểm kỹ thuật; luật hình (đầu bị mép cắt, mặt dưới phụ đề, nhân vật chồng nhau) chỉ chạy trên một ảnh mỗi cảnh ở storyboard.
- Director không biết khi nào có việc chờ duyệt nếu không mở app.

## Quyết định

1. **Sửa câu tại Cổng 1:** `POST /api/workflow-runs/:runId/script-edits`.
   - Body: `{ artifactId, variantIndex, edits: [{ lineId, text }] }`.
   - Chỉ khi run đang `waiting_script_approval` và `artifactId` là script mới nhất. Ngược lại: 409, tương ứng `invalid_transition` và `conflict`.
   - Server ghi file script mới và artifact `script` version kế tiếp (phụ thuộc bản cũ). Metadata ghi `editedBy`, `baseArtifactId`, `editedLineIds`.
   - Chép mọi `motion_asset_requests` sang artifact mới, nên tài sản đã tạo vẫn được dùng.
   - Không gọi LLM, không ghi approval, không đổi trạng thái run.
   - Shot neo vào câu đã sửa mà `cutOnWord` không còn trong câu: đổi sang từ đầu câu và báo trong response.
   - Giao diện: nút "Sửa câu" ở từng phương án, sửa trong ô nhiều dòng, chỉ gửi câu đã đổi.
2. **Tự kiểm kịch bản bằng luật** (`reviewScriptV2` trong contracts). Chạy ở web, không tốn token, không chặn duyệt.
   - Cảnh báo ("Nên sửa"):
     - hai câu đầu không có câu hỏi;
     - cảnh giải thích (`play`, `fact`, `fun`) không có đồ vật hay minh họa.
   - Gợi ý:
     - ba cảnh liền cùng nền;
     - câu dài hơn 110 ký tự;
     - ít hơn 2 nguồn;
     - chưa chọn nhạc.
   - Prompt kịch bản có cùng luật: câu hỏi trong 2 giây đầu, câu ≤ 110 ký tự, không quá hai cảnh liền cùng nền, cảnh cuối có một câu nói mời theo dõi hoặc hỏi người xem.
   - Lời mời là lời thoại, không phải chữ trên màn hình (giữ quyết định ADR-014 bổ sung 2026-11-03).
3. **QA hình trên mọi shot của bản render.**
   - Job QA chạy `checkStill` (cùng luật storyboard) cho từng shot của `render_props`. Mã mới `visual_unsafe_area` và `visual_overlap`, mức `warning`, gộp theo loại, không chặn duyệt.
   - Giới hạn: chỉ kiểm hình học ở đầu shot, không xem pixel của MP4.
4. **Báo việc chờ duyệt.**
   - Web đọc lại danh sách dự án mỗi 15 giây.
   - Tiêu đề tab có số việc chờ.
   - Khi một dự án mới chuyển sang chờ duyệt: hiện toast; nếu Director đã bấm "Bật thông báo trình duyệt" thì có thêm thông báo hệ điều hành.
5. **Giao diện khác:**
   - Thanh quyết định ở Cổng 1 gọn (ô ghi chú một dòng, mở khi gõ); hai nút duyệt ngang hàng, không tô nổi một nút.
   - Cổng 2: video lớn hơn (22 rem), thanh quyết định không dính đáy nên không che video.
   - Thẻ bước chỉ hiện thời gian ở bước đang chạy.
   - Panel Giám sát: thu gọn được, mặc định thu gọn khi không có lượt chạy; có vai `publish`.
   - Tổng quan: "Token LLM tháng này" (mọi provider); chi phí ghi "0 USD" hoặc "< 0,01 USD"; ô tên dự án có gợi ý chủ đề.
6. **Nghiên cứu và bộ đăng bài.**
   - Prompt nghiên cứu yêu cầu trích mọi tài liệu nêu cùng một số liệu, và ghi vào tóm tắt khi chỉ một tài liệu nêu số đó hoặc khi các tài liệu mâu thuẫn.
   - Bộ đăng bài sửa tên nhân vật viết sai dấu theo dàn nhân vật (`fixCastNames`).

## Chưa làm (để task sau)

- Làm lại từng phần: đọc lại một cảnh, đổi nền một cảnh, tạo lại một hình, không chạy lại cả bước.
- Ảnh bìa tự tạo cho bộ đăng bài; buộc nhập tên kênh trước lần xuất đầu tiên.
- Lọc "dùng trong video nào" ở Kho hình động.
- Intro hoặc outro dạng thẻ chữ: cần Director đổi quyết định "không chữ trên màn hình" (ADR-014 bổ sung 2026-11-03).
