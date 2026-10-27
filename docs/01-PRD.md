# PRD

Tài liệu này mô tả điều Director làm được. Cấu trúc process nằm ở [02-SYSTEM-ARCHITECTURE.md](02-SYSTEM-ARCHITECTURE.md).

## Bối cảnh

Người dùng tạo video giải thích backend, database, Redis, API và công nghệ AI. Ngôn ngữ giao diện và lời thoại của MVP là tiếng Việt. Có thể có thuật ngữ English trong câu thoại và khung code.

## Việc Director làm

1. Tạo project và nhập brief: chủ đề, đối tượng, mục tiêu, thời lượng 30–90 giây, ngôn ngữ `vi`, giọng điệu, phong cách hình.
2. Đính kèm ghi chú, file `md`, `txt`, `pdf`, hoặc URL. Mỗi file tối đa 10 MB.
3. Gửi brief cho luồng sản xuất.
4. Đọc nghiên cứu, trong đó mỗi nhận định có trạng thái `verified`, `assumption` hoặc `user_provided`.
5. Xem hai phương án kịch bản từ cùng một response LLM, sửa lời thoại từng cảnh, rồi duyệt, từ chối, hoặc yêu cầu sửa.
6. Nghe audio, xem storyboard và phụ đề, sửa timing từng từ.
7. Xem preview, đọc báo cáo QA, rồi duyệt, từ chối, hoặc yêu cầu sửa cảnh.
8. Tải MP4 sau khi đã duyệt đúng artifact preview đó.
9. Xem log, lỗi, version, thời gian và chi phí ước tính.
10. Hủy job đang chạy hoặc tiếp tục sau lỗi.

Hai phương án kịch bản là đầu ra của một lần gọi có cấu trúc, không phải hai cuộc hội thoại.

## Định dạng đầu ra

- Khung hình 1080×1920, 30 fps, H.264 trong MP4.
- Phụ đề tiếng Việt theo trang, timing theo từ, sửa tay được.
- Hình MVP là template: tiêu đề, đoạn giải thích, code, sơ đồ hộp-mũi tên. Footage điện ảnh không bắt buộc.

## MVP kỹ thuật và MVP sản phẩm

MVP kỹ thuật kết thúc ở Phase 1: một lệnh local đi từ Script JSON tới MP4, với TTS, alignment và QA tối thiểu.

MVP sản phẩm kết thúc ở Phase 4: web tiếng Việt, hai cổng duyệt, orchestration, SSE, và studio 3D đọc trạng thái thật.

## Ngoài MVP

Adapter OpenAI ở môi trường chạy thật, VieNeu v4, voice clone, S3, template thứ ba trở đi, Google Search grounding, nhiều ngôn ngữ UI, nhiều tài khoản, Remotion Lambda, và mọi đường đăng bài mạng xã hội.

## Tiêu chí nghiệm thu sản phẩm

- Export không chạy khi chưa có bản ghi approval `final` / `approved` trỏ tới đúng preview.
- Từ chối hoặc yêu cầu sửa không xóa artifact cũ.
- Một project mẫu về Redis hoặc API xem được trên màn hình dọc, phụ đề khớp lời thoại ở mức cổng Phase 0.
- Reload trang vẫn thấy trạng thái workflow từ database.

Chi tiết phase nằm ở [10-IMPLEMENTATION-PLAN.md](10-IMPLEMENTATION-PLAN.md).
