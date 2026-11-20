# Bảo mật và độ tin cậy

Kiểm soát này áp dụng từ task đầu tiên có I/O. Kiểm thử tương ứng nằm ở [09-TEST-STRATEGY.md](09-TEST-STRATEGY.md).

## Secret

Mọi secret đến từ environment: `STUDIO_PASSWORD`, `STUDIO_SESSION_SECRET`, `DATABASE_URL`, `REDIS_URL`, `GEMINI_API_KEY`, `YOUTUBE_CLIENT_SECRET`, `STUDIO_TOKEN_KEY` (ADR-031), khóa provider khác. `.env` không commit. `.env.example` chỉ chứa tên biến và giá trị trống.

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
- Từ [ADR-017](decisions/ADR-017-auto-asset-generation.md) (Director duyệt 2026-11-10): worker được tự tạo tài sản `prop`, `background`, `action` và `pose` bằng **Claude Code CLI headless** trong job storyboard, với các rào sau:
  - **Cách chạy.** Claude Code chạy trong thư mục tạm, không công cụ, không MCP, chỉ trả JSON. Nó không ghi file.
  - **Kiểm tĩnh AST trước khi ghi** (`apps/worker/src/assets/generate/static-check.ts`):
    - chỉ import `react`, `remotion` và module thuần của kit;
    - cấm định danh mạng, hệ thống, thời gian, ngẫu nhiên, thực thi động, `constructor` và `prototype`;
    - cấm truy cập phần tử bằng chuỗi;
    - cấm URL;
    - cấm `<text>`, `<image>`, `<foreignObject>`, `<script>`;
    - cấm thuộc tính `on*` và `href`;
    - đồ vật phải có kích thước trong giới hạn.
  - **Typecheck** bằng compiler API, không chạy code.
  - **Render thử trong Chromium của Remotion:** cùng frame ra cùng ảnh, đồ vật có chuyển động. Đạt mới được đăng ký vào `generated.ts` và nạp vào tiến trình worker.
  - **Giới hạn:** tối đa 3 tài sản mới mỗi run, 2 lần thử mỗi tài sản. Mỗi lần gọi ghi `usage_records`.
  - **Duyệt.** Tài sản là `candidate` cho tới khi Director duyệt phương án dùng nó ở Cổng 1. Export chỉ dùng tài sản đã duyệt.
  - **Giới hạn của rào:** kiểm AST là danh sách cấm, không phải sandbox OS. Phần còn lại của bảo mật mục C (sandbox, bind cổng) vẫn để sau.
- Gọi Claude API trả phí để sinh code vẫn cần ADR riêng.
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

Chỉ có đường đăng YouTube theo [ADR-031](decisions/ADR-031-youtube-upload.md); Facebook, TikTok vẫn đăng tay. Thêm mạng khác cần ADR mới.

- **Xác nhận riêng:** mỗi lần đăng đi qua hộp xác nhận của Director (tên kênh, chế độ hiển thị mặc định Riêng tư, khai báo "Dành cho trẻ em" bắt buộc chọn). Không đăng tự động sau export, không gắn vào route approval.
- **OAuth:** dự án Google Cloud của Director, client "Desktop app", PKCE S256, `state` ngẫu nhiên 32 byte, sống 10 phút, dùng một lần, chỉ phiên đã đăng nhập tạo được. Callback `/api/youtube/oauth/callback` không cần cookie (Google chuyển về host của API) và chỉ nhận `state` còn hiệu lực.
- **Scope:** `youtube.upload` và `youtube.readonly`; không xin quyền sửa hay xóa video.
- **Token:** refresh token mã hóa AES-256-GCM bằng `STUDIO_TOKEN_KEY`, AAD là id kênh trong Studio; access token chỉ trong bộ nhớ worker. Không route nào trả token.
- **Ghi `.env` từ giao diện** (bổ sung 2026-11-16): `PUT /api/youtube/config` chỉ ghi `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` và tạo `STUDIO_TOKEN_KEY` khi chưa có. Giá trị kiểm bằng regex, không có ký tự điều khiển, nên không chèn được biến khác. Không trả secret; log che `req.body.clientSecret`.
- **Log:** query của URL callback (`code`, `state`) bị thay bằng `[REDACTED]` trong log request; lỗi Google chỉ ghi mã.
- **Mạng:** chỉ gọi `oauth2.googleapis.com`, `www.googleapis.com`, `youtube.googleapis.com` qua https; không theo redirect. URI phiên upload phải ở `www.googleapis.com`.
- **Để sau (mục C):** xoay khóa `STUDIO_TOKEN_KEY`, keychain của hệ điều hành, tách quyền đọc bảng `youtube_connections`.
