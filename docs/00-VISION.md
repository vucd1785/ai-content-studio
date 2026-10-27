# Tầm nhìn

AI Content Studio là công cụ local-first để một người tạo video giáo dục ngắn về kỹ thuật phần mềm. Sản phẩm đầu là video dọc 1080×1920, 30 fps, khoảng 30–90 giây.

## Director

Director là người dùng duy nhất của MVP. Director đưa chủ đề, đối tượng, mục tiêu, thời lượng, giọng điệu và phong cách hình, có thể kèm ghi chú hoặc tài liệu. Director xem nghiên cứu, so sánh phương án kịch bản, sửa cảnh, nghe thoại, xem preview, rồi quyết định duyệt hoặc yêu cầu sửa.

Quyền duyệt nội dung sáng tạo thuộc về Director. Agent chuẩn bị artifact và dừng tại cổng duyệt.

## Hệ thống phải làm được

Studio tạo một mạch sản xuất lặp lại: brief, nghiên cứu có nguồn, kịch bản có schema, hình và giọng, preview, QA, export MP4. Công việc dở có thể chạy tiếp. Mỗi hành động quan trọng có trạng thái đọc được từ database.

Giao diện có một studio 3D để theo dõi vai trò đang chạy, và các panel 2D để đọc, sửa, duyệt và xem video.

## Nguyên tắc

- Local-first. Cấu hình bằng environment để sau này đổi object storage hoặc triển khai trên máy khác.
- Ít lần gọi LLM. Việc đo đạc, validate, render và phần lớn QA là code.
- Artifact có version. Sửa một phần thì chỉ làm bẩn phần phụ thuộc phần đó.
- Chi phí token và thời gian xử lý được ghi lại.
- Ứng dụng hoàn thành tự trả phí API của provider. Gói Cursor không trả các cuộc gọi đó.

## Ngoài tầm nhìn hiện tại

Nhiều người dùng, đăng mạng xã hội, video điện ảnh do model sinh, và cụm microservice không thuộc sản phẩm này.

Xem hành vi cụ thể ở [01-PRD.md](01-PRD.md) và ranh giới phase ở [10-IMPLEMENTATION-PLAN.md](10-IMPLEMENTATION-PLAN.md).
