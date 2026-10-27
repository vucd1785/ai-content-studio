---
name: build-agent-workflow
description: Hiện thực job, transition và event của workflow đã mô tả trong docs/04-AGENT-ORCHESTRATION.md. Dùng khi người dùng gọi build-agent-workflow hoặc làm các task P3.
disable-model-invocation: true
---

# build-agent-workflow

## Mục đích và cách gọi

Dùng cho task hàng đợi, state machine, research, script, media job, QA, SSE, hủy và resume. Gọi cùng `implement-task`.

## Đầu vào và tài liệu bắt buộc

- `docs/04-AGENT-ORCHESTRATION.md`
- `docs/03-DATABASE-DESIGN.md`
- `docs/08-SECURITY.md` khi task có fetch hoặc approval
- Khối task `P3-*` tương ứng

## Quy trình

1. Viết hoặc sửa hàm transition thuần trước, kèm test cạnh hợp lệ và cạnh bị cấm.
2. Job chỉ nhận `jobId`, đọc PostgreSQL, ghi artifact và event.
3. Gắn idempotency key trước khi gọi LLM, TTS hoặc render.
4. Áp quy tắc làm bẩn version của đúng loại artifact task đang đụng.
5. Chạy test worker với provider giả.

## Lệnh được phép

`pnpm` test của `apps/worker` và `packages/db`, Docker Compose Postgres và Redis. Gọi Gemini chỉ khi task là `P1-07` hoặc task ghi rõ external.

## Đầu ra

Job hoặc transition mới, test, report của task.

## Cách kiểm tra

Một test cho transition bị cấm, một test cho không gọi lại bước cha còn hợp lệ, một test approval nếu task đụng cổng duyệt.

## Định nghĩa xong

Trạng thái trong DB khớp state machine và report dẫn lệnh test đã chạy.

## Dừng và leo thang

Dừng nếu cần vai trò LLM mới, queue mới, hoặc transition chưa có trong tài liệu orchestration. Không thêm hội thoại giữa các agent để vá lỗi.
