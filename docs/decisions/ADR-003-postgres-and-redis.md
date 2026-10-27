# ADR-003: PostgreSQL và Redis

- Trạng thái: Accepted
- Ngày: 2026-10-27

## Bối cảnh

Cần hàng đợi có retry và một lịch sử workflow chịu được mất process. BullMQ trên Redis đáp ứng hàng đợi. Stream sự kiện của BullMQ bị cắt dần.

## Quyết định

PostgreSQL là nguồn sự thật cho run, artifact, approval, job và event. Redis giữ queue BullMQ. Payload job chỉ chứa `jobId`. Worker lúc khởi động tạo lại job còn dở từ bảng `jobs`. SSE đọc `events` rồi nghe tiến độ đang chạy.

ORM là Drizzle. Tag Postgres dự kiến là 17, Redis là 7, xác nhận lúc viết Compose ở `P0-01`.

## Hệ quả

Hai datastore. Mất Redis không mất approval. Không chuyển BullMQ sang backend Postgres trong MVP.

Xem [../03-DATABASE-DESIGN.md](../03-DATABASE-DESIGN.md).
