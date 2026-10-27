# Bảo mật và độ tin cậy

Kiểm soát này áp dụng từ task đầu tiên có I/O. Kiểm thử tương ứng nằm ở [09-TEST-STRATEGY.md](09-TEST-STRATEGY.md).

## Secret

Mọi secret đến từ environment: `STUDIO_PASSWORD`, `STUDIO_SESSION_SECRET`, `DATABASE_URL`, `REDIS_URL`, `GEMINI_API_KEY`, khóa provider khác. `.env` không commit. `.env.example` chỉ chứa tên biến và giá trị trống.

Log cấu trúc có `workflowRunId` và `jobId`. Log không chứa API key, cookie, hay nguyên văn `Authorization`.

Dùng paid key của Gemini cho nội dung studio. Trang giá Gemini, lúc chốt kế hoạch, ghi free tier có thể dùng dữ liệu để cải thiện sản phẩm.

## Session và bind

API local lắng nghe `127.0.0.1`. Cookie session mô tả ở [07-API-CONTRACTS.md](07-API-CONTRACTS.md). So khớp mật khẩu bằng SHA-256 hai đầu vào rồi `timingSafeEqual`. Không so sánh chuỗi thường và không ghi hash vào log.

## Upload và path

Chỉ nhận `md`, `txt`, `pdf`. Đo kích thước lúc nhận, dừng ở 10 MB. Đuôi file không đủ; kiểm tra nội dung tối thiểu theo loại đã chọn.

Tên file gốc không dùng làm path. Server tạo `storage_key` mới. Hàm resolve từ chối key chứa `..`, ký tự null, hoặc path tuyệt đối, và kiểm tra path thật vẫn nằm trong volume `data/` sau khi normalize.

## Fetch URL

Research chỉ fetch URL Director đưa hoặc URL cùng host mà redirect còn nằm trong allowlist của run. Giao thức `http` và `https`. Mỗi hop chặn IP private, loopback, link-local và dải metadata. Tối đa 3 redirect, 15 giây, 1 MB. Hết hạn thì ghi `fetch_log` lỗi và fact tương ứng không được `verified`.

Worker không nhận shell tool và không mở browser tự do.

## Prompt injection

Nội dung tài liệu và trang fetch nằm trong khối dữ liệu, có nhãn untrusted. System prompt yêu cầu model chỉ trích xuất fact theo schema. Validator bỏ fact `verified` nếu URL không có trong `fetch_log` hoặc reference của project. Đây là chặn ở code, mô tả ở [04-AGENT-ORCHESTRATION.md](04-AGENT-ORCHESTRATION.md).

## Media và giọng

Font và icon trong template có tên license trong manifest. Không tải footage tùy ý vào render.

Preset VieNeu v3 Turbo là giọng được bật sẵn, theo tuyên bố quyền Apache-2.0 của dự án VieNeu tại thời điểm khảo sát. Voice clone ở ngoài MVP. Khi có, `voice_profiles.kind = clone` chỉ bật sau `consent_recorded_at`.

## Job

Idempotency key ngăn gọi lại provider khi artifact đã xong. Retry có trần. Hủy là trạng thái bền, không xóa approval cũ.

Approval và đổi trạng thái workflow cùng transaction. Không có hàm nội bộ nào ghi `decision = approved` ngoài route approval.

## Xuất bản

Không có client đăng YouTube, TikTok hay mạng khác. Thêm đường đó cần ADR mới và một hành động xác nhận riêng của Director, không gắn vào export.
