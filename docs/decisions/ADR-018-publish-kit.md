# ADR-018: Bộ đăng bài YouTube, Facebook, TikTok sau khi xuất video

- Trạng thái: **Accepted** (Director chọn phương án 2026-11-11)
- Ngày: 2026-11-11
- Liên quan: [ADR-004](ADR-004-human-approval.md), [ADR-007](ADR-007-llm-adapter.md), [04](../04-AGENT-ORCHESTRATION.md), [07](../07-API-CONTRACTS.md)

## Bối cảnh

Director yêu cầu (2026-11-11):
- sau bước xuất video, app có tiêu đề và thông tin để đăng YouTube, Facebook, TikTok, mỗi mạng một bộ riêng;
- có hướng dẫn cách đăng, dùng chung cho mọi video;
- sau này có thể bật kiếm tiền, nên mô tả cần nói rõ video làm với AI và có liên hệ khi có khiếu nại bản quyền.

Director chọn: tự tạo sau khi xuất video; liên hệ bản quyền nhập ở Bộ nhận diện kênh; mô tả ghi "nội dung gốc, có hỗ trợ AI" thay vì câu fair use. Lý do: câu fair use không tạo ra quyền sử dụng, và video của kênh là nội dung gốc.

## Quyết định

1. **Job mới `publish`** (vai agent `publish`, queue `llm`).
   - Job export xong thì tạo job này trong cùng transaction (`publish:<run>:export:<exportJob>`).
   - Run giữ `exported`: không thêm trạng thái workflow. Lỗi ở job này không đổi trạng thái run (`failJob` không có `runTransition`), vì video đã xuất vẫn dùng được.
2. **Đầu vào:** phương án kịch bản đã duyệt, brief, thời lượng thật (từ `render_props`), tên kênh và liên hệ bản quyền.
3. **Một lượt gọi LLM** (cùng provider và model với kịch bản của run), kiểm bằng Zod `publishCopySchema`, sửa tối đa một lần. Lượt này không tính vào trần lượt gọi của run, cùng lý do với vai `visual` ở ADR-017.
4. **Phần chân do code ghép, không do LLM viết:** nội dung gốc có hỗ trợ AI và có người duyệt, nguồn tham khảo của kịch bản, liên hệ bản quyền.
   - Chưa có liên hệ thì mô tả có dòng nhắc `[CHƯA CÓ LIÊN HỆ…]`, giao diện cũng cảnh báo.
   - YouTube: video ≤ 180 giây thêm `#Shorts`. TikTok: chú thích ≤ 2.200 ký tự; phần LLM viết bị cắt trước, dòng bản quyền luôn còn.
5. **Artifact `publish_kit`** (schema `publishKitSchema`): mỗi nền tảng một danh sách ô `{ label, value }` để dán thẳng, kèm bản LLM viết.
6. **Giao diện:**
   - Tab Bản cuối có khối "Bộ đăng bài": ba tab YouTube, Facebook, TikTok; nút Sao chép từng ô; nút "Tạo lại" (`POST /api/workflow-runs/:runId/publish-kit`, chỉ khi run `exported` và không có job `publish` đang chờ).
   - Trang "Hướng dẫn đăng bài" (`#/publish-guide`): quy trình chung cho mọi video, có ngày cập nhật và lời nhắc đọc trang trợ giúp chính thức.
   - Bộ nhận diện kênh có ô "Liên hệ bản quyền" (`GET/PUT /api/brand-profile/contact`).
7. **DB:** migration `0006`: thêm `publish` vào `agent_run_role`, `publish_kit` vào `artifact_type`, cột `brand_profiles.copyright_contact`.

## Phương án đã cân nhắc

- **Bấm nút mới tạo:** không tốn lượt gọi khi Director không đăng. Director chọn tự tạo.
- **Gộp vào job export:** export ở queue `render`; gọi LLM ở đó sai phân vai queue và làm lỗi LLM thành lỗi export.
- **Để LLM viết cả phần bản quyền:** câu chữ có thể sai hoặc thiếu. Phần này cố định nên code ghép.

## Hệ quả

- Mỗi video xuất xong tốn thêm một lượt gọi LLM nhỏ.
- Hướng dẫn chính sách nền tảng có thể lỗi thời: trang ghi ngày cập nhật, không ghi con số ngưỡng kiếm tiền.
- Agent không tự đăng lên mạng xã hội; Director đăng tay.
