# ADR-027: Bỏ trần hình tự tạo mỗi run, prompt tạo hình nêu đúng API của kit, tên file tải về theo chủ đề

- Trạng thái: **Accepted**. Director 2026-11-12:
  - "Bỏ giới hạn hình, nó có thể tạo tùy vào chủ đề ko sợ tốn claude";
  - "Sửa prompt tạo hình: liệt kê đúng các hàm chuyển động có sẵn";
  - "khi tải video nên để tên file mặc định là chủ đề video ko dấu".
- Ngày: 2026-11-12
- Liên quan:
  - [ADR-017](ADR-017-auto-asset-generation.md) mục 4: trần 3 hình mới mỗi run. ADR này thay trần đó.
  - [ADR-021](ADR-021-cards-redo-and-export.md): bản xuất.

## Bối cảnh

- **Thiếu hình:** dự án "viễn thị, loạn thị, lão thị" xin 4 hình. Trần 3 hình mới mỗi run làm hình thứ tư (kính đọc sách) không được thử, nên ba cảnh dùng hình tạm sai chủ đề.
- **Lượt thử oan:** log cho thấy Claude gọi `easing.easeInOutCubic` và `easing.inOutSine`. Kit không có hai hàm này, nên hình hỏng lượt thử đầu vì lỗi typecheck. Prompt chỉ ghi "easing", không nêu tên hàm.
- **Tên file tải về:** file tải về mang tên theo đường dẫn URL (`media`), không cho biết video nói về gì.

## Quyết định

1. **Bỏ trần hình mới mỗi run.**
   - `MAX_NEW_ASSETS_PER_RUN` là vô hạn. Mọi yêu cầu cần tạo đều được thử.
   - Mỗi hình vẫn tối đa 2 lượt thử, và vẫn qua kiểm AST, chất lượng, typecheck, render thử.
2. **Kịch bản xin được nhiều hình hơn:** tối đa 8 yêu cầu tài sản mỗi phương án (`MAX_ASSET_REQUESTS`, trước là 5).
   - Bỏ luật "tối đa 3 yêu cầu không dùng cho minh họa".
   - Prompt dặn xin một hình cho mỗi thứ chủ đề thật sự cần mà danh mục không có.
3. **Prompt tạo hình nêu đúng API của kit (`KIT_API`).** Dữ liệu lấy thẳng từ motion kit nên không lệch khi kit đổi:
   - tên các hàm `easing` và cách gọi;
   - chữ ký `lerp`, `clamp`, `rnd`, `wobble`;
   - các khóa của `PALETTE`.
4. **Tên file tải về theo chủ đề.**
   - `GET /api/artifacts/:id/media` của `export` và `preview` trả header `Content-Disposition: inline; filename="<slug>.mp4"`.
   - `<slug>` là chủ đề trong brief mà run dùng, bỏ dấu, chữ thường, nối bằng gạch ngang, tối đa 80 ký tự, cắt theo từ (`topicFileSlug`). Ví dụ: "Vì sao đom đóm phát sáng?" thành `vi-sao-dom-dom-phat-sang.mp4`.
   - Bản xem trước thêm hậu tố `-ban-xem-truoc`.
   - `inline` để thẻ video vẫn phát được. Nút "Tải bản xuất" có thuộc tính `download` nên lấy tên từ header.

## Hệ quả

- **Thời gian và chi phí:** bước storyboard lâu hơn và tốn thêm lượt Claude khi chủ đề cần nhiều hình. Tối đa là 8 yêu cầu × 2 phương án; yêu cầu trùng mô tả được tạo một lần.
- **Lỗi ở một hình:** không chặn các hình khác, như trước.
- **Video đã xuất trước đây:** tải lại sẽ có tên mới. File đã lưu trên máy không đổi tên.
