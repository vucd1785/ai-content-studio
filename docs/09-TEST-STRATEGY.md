# Chiến lược kiểm thử

Mục tiêu là chứng minh mạch dữ liệu và các cổng dừng, không phải đạt số coverage chung.

## Lớp

| Lớp | Công cụ | Việc |
|---|---|---|
| Đơn vị | Vitest | Schema Zod, state machine, invalidation, resolve `storage_key`, tính duration. |
| Tích hợp | Vitest + Compose | API approval, repository Drizzle, một job worker với provider giả. |
| Media | Lệnh spike và ffprobe | WAV thật, alignment, MP4 đúng kích thước. Chạy khi task media yêu cầu, không chặn mọi unit test. |
| Giao diện | Playwright từ Phase 2 | Đăng nhập, gửi brief, duyệt kịch bản, thấy trạng thái sau reload. |
| Giao diện (P7-10) | Playwright `apps/web/e2e`, `pnpm --dir apps/web e2e` | API giả bằng `page.route` (dữ liệu mẫu ghi "(mẫu)"); tổng quan sáng/tối ở 1440, 1280, tablet; đang chạy bình thường và lỗi; worker tắt; hộp thoại hủy (focus, Esc); Cổng 1 có tài sản mới; Cổng 2 QA đạt và lỗi; usage, kho, nhận diện; chế độ Tập trung và Giám sát; bàn phím và viền focus. Ảnh ghi vào `data/ui-screens/`. |

Test tích hợp chạy trên DB riêng `studio_test` (P3-13): vitest của `api`, `worker`, `db` đặt `DATABASE_URL` từ `TEST_DATABASE_URL` (mặc định `.../studio_test`) và từ chối DB không kết thúc bằng `_test`. Tạo và migrate: `pnpm --filter @studio/db db:test:prepare`. Worker thật đọc DB `studio` nên không bao giờ nhận job của test (lý do: sự cố 2026-10-31, P3-11 mục 6). Queue BullMQ của test dùng prefix riêng.

Provider LLM trong test tích hợp là fake trả JSON cố định. Một test đánh dấu `external` mới gọi Gemini, và chỉ ở `P1-07`.

## Bộ cố định

- `fixtures/script.edu.json`: bài ngắn về Redis, hợp schema, để pipeline không cần LLM.
- Phase 6: một fixture script `2` gói `story` với Tí, Bit, Đậu đều nói, có shot ba người ở góc cao (`apps/worker/src/render/flow-fixtures.ts`, ADR-013 bổ sung (2) 2026-11-03), kèm shot list; một catalog tài sản giả nhỏ cho test schema. TTS giả trả giọng theo người nói cho test voice theo câu. Fixture `fixtures/script.edu.json` của script `1` đã xóa.
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

Phase 6 ([ADR-013](decisions/ADR-013-brand-kit-and-formats.md) đến [ADR-016](decisions/ADR-016-creative-mode-motion-assets.md)):

- Script `2` có `speaker` là nhân vật `speaks = false`, hoặc id tài sản lạ, bị Zod từ chối.
- Luật nhịp có test bảng: số cắt mỗi phút, cảnh tĩnh tối đa, không trùng cỡ cảnh liền nhau; cảnh nhịp cần nguồn mà không có nguồn bị QA chặn.
- Tài sản motion kit render hai lần cùng frame ra cùng SVG; không `Math.random`, không mạng; test vị trí tay không bị đầu che ở tư thế giơ tay.
- Đổi version motion kit thì `content_hash` đổi và cache không trả MP4 cũ.
- Sửa một câu chỉ gọi synthesize cho câu đó; cảnh được căn lại một lần.
- Lỗi storyboard không chặn `waiting_script_approval` và không ghi approval.
- Migration Phase 6 chạy hai lần không lỗi; project cũ gắn kênh mặc định; brief mới có `format_id = story` (migration 0005).
- Duyệt tài sản hay bỏ yêu cầu tài sản không tạo hàng `approvals`.
- Không đường code nào của ứng dụng gọi Claude để sinh code, nạp code từ `DATA_DIR` hay từ response LLM.

## Cách ghi kết quả

Task chỉ chuyển `done` khi lệnh trong mục kiểm tra của task đó đã chạy và kết quả nằm trong `reports/<task-id>.md`. Test bị skip để cho xanh là chưa xong.

Spike `P0-04` ghi số đo thật. Không điền sẵn tỷ lệ đạt.
