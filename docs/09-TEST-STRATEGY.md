# Chiến lược kiểm thử

Mục tiêu là chứng minh mạch dữ liệu và các cổng dừng, không phải đạt số coverage chung.

## Lớp

| Lớp | Công cụ | Việc |
|---|---|---|
| Đơn vị | Vitest | Schema Zod, state machine, invalidation, resolve `storage_key`, tính duration. |
| Tích hợp | Vitest + Compose | API approval, repository Drizzle, một job worker với provider giả. |
| Media | Lệnh spike và ffprobe | WAV thật, alignment, MP4 đúng kích thước. Chạy khi task media yêu cầu, không chặn mọi unit test. |
| Giao diện | Playwright từ Phase 2 | Đăng nhập, gửi brief, duyệt kịch bản, thấy trạng thái sau reload. |

Provider LLM trong test tích hợp là fake trả JSON cố định. Một test đánh dấu `external` mới gọi Gemini, và chỉ ở `P1-07`.

## Bộ cố định

- `fixtures/script.edu.json`: bài ngắn về Redis, hợp schema, để pipeline không cần LLM.
- Response LLM mẫu nằm cạnh test của adapter, gồm một bản đúng và một bản sai schema.
- Sau `P0-05`, giữ một MP4 vài giây ngoài Git nếu file lớn. Git chỉ giữ lệnh tạo lại và kết quả ffprobe kỳ vọng.

## Việc mỗi nhóm task phải chứng minh

- Schema từ chối slot `code` thiếu `codeSnippet`.
- Transition lạ không đổi `workflow_runs`.
- Approval thiếu `decision` bị 400.
- Export không có approval đúng artifact bị `approval_required`.
- `storage_key` chứa `..` bị từ chối trước khi đọc đĩa.
- URL nội bộ kiểu metadata bị fetch từ chối.
- Retry sau artifact `completed` không gọi fake provider lần hai.
- Resume sau khi TTS xong không tạo job `media` mới.
- SSE với `afterId` trả event cũ rồi mới tới event mới.
- UI không có nút nào gửi `approved` ngầm khi mở trang.

## Cách ghi kết quả

Task chỉ chuyển `done` khi lệnh trong mục kiểm tra của task đó đã chạy và kết quả nằm trong `reports/<task-id>.md`. Test bị skip để cho xanh là chưa xong.

Spike `P0-04` ghi số đo thật. Không điền sẵn tỷ lệ đạt.
