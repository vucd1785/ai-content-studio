# Tầm nhìn

AI Content Studio là công cụ local-first để một người làm video dọc ngắn cho một kênh có dấu ấn riêng. Video là 1080×1920, 30 fps; thời lượng tùy gói thể loại.

Giáo dục kỹ thuật phần mềm là thể loại đầu tiên, không còn là giới hạn. Kênh có dàn nhân vật vẽ bằng code (người que Tí, robot Bit, hạt đậu Đậu), tính cách, bảng màu và âm thanh nhận diện riêng, dùng cho nhiều thể loại như giải thích, "Nếu như…?" hay tiểu phẩm ([ADR-013](decisions/ADR-013-brand-kit-and-formats.md)).

## Director

Director là người dùng duy nhất của MVP. Director đưa chủ đề, đối tượng, mục tiêu, thời lượng, giọng điệu và phong cách hình, có thể kèm ghi chú hoặc tài liệu. Director xem nghiên cứu, so sánh phương án kịch bản, sửa cảnh, nghe thoại, xem preview, rồi quyết định duyệt hoặc yêu cầu sửa.

Quyền duyệt nội dung sáng tạo thuộc về Director. Agent chuẩn bị artifact và dừng tại cổng duyệt.

## Hệ thống phải làm được

Studio tạo một mạch sản xuất lặp lại: brief theo kênh (một gói "Hoạt hình" chung, ADR-013 bổ sung (2)), nghiên cứu có nguồn, kịch bản có schema kèm danh sách cảnh, storyboard ảnh tĩnh, giọng theo nhân vật, preview, QA, export MP4. Công việc dở có thể chạy tiếp. Mỗi hành động quan trọng có trạng thái đọc được từ database.

Giao diện có một studio 3D để theo dõi vai trò đang chạy, và các panel 2D để đọc, sửa, duyệt và xem video.

## Nguyên tắc

- Local-first. Cấu hình bằng environment để sau này đổi object storage hoặc triển khai trên máy khác.
- Ít lần gọi LLM. Việc đo đạc, validate, render và phần lớn QA là code.
- Nhân vật và hình động là code trong repo (motion kit), không do model ảnh hay video sinh. LLM chỉ trả dữ liệu (kịch bản, danh sách cảnh); ứng dụng không thực thi code do LLM sinh lúc chạy ([ADR-014](decisions/ADR-014-motion-kit-and-shot-list.md), [ADR-016](decisions/ADR-016-creative-mode-motion-assets.md)).
- Mọi câu khẳng định là sự thật có nguồn, ở mọi thể loại. Nội dung hư cấu không được trình bày như sự thật.
- Artifact có version. Sửa một phần thì chỉ làm bẩn phần phụ thuộc phần đó.
- Chi phí token và thời gian xử lý được ghi lại.
- Ứng dụng hoàn thành tự trả phí API của provider (Gemini). Gói Cursor không trả các cuộc gọi đó. Ngoại lệ Director duyệt: client Claude Code dùng gói thuê bao Claude của Director cho research và script ([ADR-007](decisions/ADR-007-llm-adapter.md), bổ sung 2026-11-02).

## Ngoài tầm nhìn hiện tại

Nhiều người dùng, đăng mạng xã hội, video điện ảnh hay nhân vật do model ảnh/video sinh, và cụm microservice không thuộc sản phẩm này.

Xem hành vi cụ thể ở [01-PRD.md](01-PRD.md) và ranh giới phase ở [10-IMPLEMENTATION-PLAN.md](10-IMPLEMENTATION-PLAN.md).
