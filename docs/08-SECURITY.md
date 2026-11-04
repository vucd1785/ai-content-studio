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

Worker không nhận shell tool và không mở browser tự do. Client Claude Code (ADR-007, bổ sung 2026-11-02) chạy với `--tools ""`, `--safe-mode`, `--strict-mcp-config`, trong thư mục tạm trống; không công cụ nào được bật.

## Prompt injection

Nội dung tài liệu và trang fetch nằm trong khối dữ liệu, có nhãn untrusted. System prompt yêu cầu model chỉ trích xuất fact theo schema. Validator bỏ fact `verified` nếu URL không có trong `fetch_log` hoặc reference của project. Đây là chặn ở code, mô tả ở [04-AGENT-ORCHESTRATION.md](04-AGENT-ORCHESTRATION.md).

## Code do LLM sinh (Phase 6)

Ứng dụng **không thực thi code do LLM sinh lúc chạy** ([ADR-014](decisions/ADR-014-motion-kit-and-shot-list.md), [ADR-016](decisions/ADR-016-creative-mode-motion-assets.md)):

- LLM của ứng dụng chỉ trả dữ liệu (research, kịch bản, shot list). Shot list chỉ chứa id tài sản; Zod từ chối id không có trong kho.
- Remotion chỉ bundle code nằm trong repo: `apps/video` và `packages/motion-kit`. Không nạp component, module hay chuỗi code từ `DATA_DIR`, DB hay response LLM; không `eval`, `new Function`, `import()` động theo dữ liệu.
- Tài sản mới của chế độ sáng tạo (cách A) do phiên Claude Code của Director viết bằng skill `create-motion-asset`, vào repo dưới dạng `candidate`, qua test, typecheck và Director duyệt rồi mới được shot list dùng. Commit chỉ khi Director yêu cầu.
- Tài sản motion kit là hàm thuần của frame: không mạng, không `Math.random`, không đọc file, không `process`, không truy cập DOM ngoài SVG của chính nó. Skill và review kiểm các điều này.
- Worker gọi Claude API để sinh code lúc chạy (cách B) bị cấm cho đến khi có ADR riêng, sau khi bảo mật mục C xong; ADR đó phải có sandbox không mạng, kiểm AST, trần chi phí.
- Không cài skill, package hay repo bên ngoài (ví dụ `kelano86/*`) khi chưa kiểm license và chưa có Director cho phép.

## Media và giọng

Font và icon trong template có tên license trong manifest. Không tải footage tùy ý vào render.

Phase 6: mọi file SFX và mọi tài sản motion kit dùng file ngoài (font, âm thanh) có nguồn và license trong manifest (`asset.json` hoặc manifest SFX). Nguồn SFX là cổng Director (P6-12). Thẻ nhận diện và nhân vật vẽ bằng code, không lấy hình từ nguồn ngoài.

Preset VieNeu v3 Turbo là giọng được bật sẵn, theo tuyên bố quyền Apache-2.0 của dự án VieNeu tại thời điểm khảo sát. Voice clone ở ngoài MVP. Khi có, `voice_profiles.kind = clone` chỉ bật sau `consent_recorded_at`.

Giọng của nhân vật kênh ([ADR-015](decisions/ADR-015-multi-speaker-voice.md)) chỉ chọn từ danh sách service TTS trả về; agent không điền tên giọng vào seed, tài liệu hay code.

## Job

Idempotency key ngăn gọi lại provider khi artifact đã xong. Retry có trần. Hủy là trạng thái bền, không xóa approval cũ.

Approval và đổi trạng thái workflow cùng transaction. Không có hàm nội bộ nào ghi `decision = approved` ngoài route approval.

## Xuất bản

Không có client đăng YouTube, TikTok hay mạng khác. Thêm đường đó cần ADR mới và một hành động xác nhận riêng của Director, không gắn vào export.
