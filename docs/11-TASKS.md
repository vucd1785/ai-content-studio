# Task thực thi

Một phiên làm một task `pending` khi mọi ID trong **Phụ thuộc** đã `done`.

Định nghĩa xong của mỗi task là toàn bộ **Tiêu chí nghiệm thu** của task đó có bằng chứng trong `reports/<task-id>.md`. Thiếu một tiêu chí thì chưa được `done`.

Mọi task được sửa khối của chính nó trong file này và được tạo `reports/<task-id>.md`. Không sửa `docs/decisions/` trừ khi task nói rõ.

Đường găng tới MP4 đầu tiên:

`P0-01 → P0-02`

`P0-01 → P0-03 → P0-04`

`P0-01 → P0-05`

Phase 1 chỉ mở khi `P0-04` có `Decision: go` và `P0-05` là `done`.

## P0-01 — Skeleton monorepo

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: không
- Skill: `implement-task`
- ADR: [ADR-001](decisions/ADR-001-monorepo-processes.md), [ADR-010](decisions/ADR-010-zod-contracts.md)

File được phép:

- `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `biome.json`, `docker-compose.yml`, `.env.example`, `.gitignore`
- `apps/web/package.json`, `apps/api/package.json`, `apps/worker/package.json`, `apps/video/package.json`
- `packages/contracts/package.json`, `packages/db/package.json`, `packages/config/package.json`
- `packages/config/src/env.ts` chỉ khai báo tên biến, chưa nối network
- `README.md` mục cài đặt
- `docs/11-TASKS.md`, `reports/P0-01.md`

Mục tiêu: workspace pnpm, TypeScript strict, Biome, Compose cho PostgreSQL và Redis. Chưa có route, chưa có TTS, chưa có composition Remotion.

Tiêu chí nghiệm thu:

- Workspace gồm `apps/web`, `apps/api`, `apps/worker`, `apps/video`, `packages/contracts`, `packages/db`, `packages/config`.
- `services/` không phải package pnpm.
- Image Node khai báo là 24. Compose dùng PostgreSQL 17 và Redis 7, có healthcheck, có volume cho dữ liệu Postgres.
- `.env.example` liệt kê biến ở [08-SECURITY.md](08-SECURITY.md) với giá trị secret để trống, và có `DATA_DIR`, `TTS_BASE_URL`.
- `.gitignore` có `.env`, `node_modules`, `data/`, output media.
- `pnpm install` và typecheck của các package placeholder chạy xong.
- `docker compose config` hợp lệ.

Kiểm tra: `pnpm install`, `pnpm exec tsc -p tsconfig.base.json --noEmit` hoặc script `typecheck` tương đương, `docker compose config`.

Ghi chú cho phiên sau: dừng sau task này. Không tạo FastAPI hay Remotion.

## P0-02 — Schema script

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P0-01`
- Skill: `implement-task`
- ADR: [ADR-010](decisions/ADR-010-zod-contracts.md)

File được phép: `packages/contracts/**`, `fixtures/script.edu.json`, `docs/11-TASKS.md`, `reports/P0-02.md`.

Mục tiêu: Zod schema đúng [05-VIDEO-PIPELINE.md](05-VIDEO-PIPELINE.md) và một fixture bài Redis hợp lệ.

Tiêu chí nghiệm thu:

- Fixture parse được.
- Test từ chối scene `code` không có `codeSnippet`, scene `diagram` không có `diagram`, scene đầu không phải `title`, scene cuối không phải `cta`, và `duration` không thuộc schema này.
- Schema version là `1`.

Kiểm tra: `pnpm --filter @studio/contracts test`. Tên package có thể khác nếu `P0-01` đã chọn prefix; dùng đúng tên đã tạo và ghi vào report.

Ghi chú: chưa gọi Gemini.

## P0-03 — TTS một câu

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P0-01`
- Skill: `implement-task`
- ADR: [ADR-005](decisions/ADR-005-tts-alignment.md)

File được phép: `services/tts/**`, `docker-compose.yml` service `tts` profile CPU, `docs/11-TASKS.md`, `reports/P0-03.md`.

Mục tiêu: `GET /health` và `POST /synthesize` với một câu tiếng Việt, ghi WAV vào `data/`, đo duration bằng ffprobe hoặc thư viện đo WAV có header chuẩn.

Tiêu chí nghiệm thu:

- Profile mặc định là CPU/ONNX của VieNeu v3 Turbo.
- Request không nhận path tùy ý từ client.
- WAV phát được và duration lớn hơn 0.
- Nếu model không tải được, report `blocked` và không tạo WAV im lặng thay thế.

Kiểm tra: gọi health và synthesize từ trong Compose; đọc duration.

Ghi chú: chưa có endpoint align. Đó là `P0-04` và `P1-02`.

## P0-04 — Spike alignment

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P0-03`
- Skill: `debug-pipeline` nếu lệch; không thì `implement-task`
- ADR: [ADR-005](decisions/ADR-005-tts-alignment.md)

File được phép: `services/tts/**` phần spike, `docs/spikes/P0-04-alignment.md`, `docs/11-TASKS.md`, `reports/P0-04.md`.

Mục tiêu: căn transcript đã biết với WAV của `P0-03` hoặc một đoạn thoại giáo dục 45–60 giây sinh từ cùng TTS. Ghi license model đã chọn.

Tiêu chí nghiệm thu:

- Báo cáo có lệnh chạy lại, tên model, license, tỷ lệ từ có timestamp, độ lệch so với duration.
- Dòng cuối cùng là `Decision: go` hoặc `Decision: no-go` theo ngưỡng trong [05-VIDEO-PIPELINE.md](05-VIDEO-PIPELINE.md).
- `no-go` sau khi đã thử phương án Whisper-align với cùng transcript thì trạng thái task là `blocked`.

Kiểm tra: chạy lại lệnh trong báo cáo spike trên cùng file WAV.

Ghi chú: không chia đều thời lượng cho các từ để vượt cổng.

## P0-05 — Remotion trong container

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P0-01`
- Skill: `build-video-template`
- ADR: [ADR-006](decisions/ADR-006-remotion-local-render.md)

File được phép: `apps/video/**`, service render trong `docker-compose.yml` nếu cần image có Chrome, `docs/spikes/P0-05-remotion.md`, `docs/11-TASKS.md`, `reports/P0-05.md`.

Mục tiêu: render MP4 vài giây, 1080×1920, 30 fps, H.264, từ props cố định. Ghi version Remotion và kết luận license key cho Free License một người, render local.

Tiêu chí nghiệm thu:

- ffprobe đúng kích thước và fps.
- Composition không import `three` hoặc `@react-three/fiber`.
- Spike ghi version và kết luận license. Nếu bắt buộc key mà chưa có key, task `blocked`.

Kiểm tra: lệnh render trong spike và ffprobe.

Ghi chú: template giáo dục đầy đủ là `P1-04`.

## P1-01 — Duration cảnh

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P0-02`, `P0-03`, `P0-04` với decision `go`
- Skill: `implement-task`

File được phép: `packages/contracts/**` hoặc module thuần trong `apps/worker` nếu `P0-01` chưa có chỗ cho hàm thuần; ưu tiên `packages/contracts` nếu hàm không cần I/O. Cộng report và task file.

Mục tiêu: hàm thuần cộng duration đã đo với đệm 200 ms mỗi đầu, đổi ra frame 30 fps.

Tiêu chí nghiệm thu: test với duration ffprobe giả lập; tổng frame không dùng số từ.

Kiểm tra: unit test của package chứa hàm.

## P1-02 — Hợp đồng media

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P0-03`, `P0-04` với decision `go`
- Skill: `implement-task`

File được phép: `services/tts/**`, client TypeScript nhỏ trong `packages/contracts` hoặc `apps/worker/src/media-client.ts`, tests, report, task file.

Mục tiêu: `POST /synthesize` và `POST /align` ổn định, trả JSON alignment theo báo cáo spike, không lộ path gốc của model.

Tiêu chí nghiệm thu: align lại đúng WAV mẫu; lỗi model trả 5xx có mã, không trả timestamp bịa.

Kiểm tra: test client với service Compose, hoặc test hợp đồng nếu service đã chạy trong `P0-04`.

## P1-03 — Captions

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P1-02`
- Skill: `implement-task`

File được phép: module map alignment sang caption, test, report, task file.

Mục tiêu: mảng tương thích `@remotion/captions`, khoảng trắng trước từ đúng quy ước Remotion.

Tiêu chí nghiệm thu: test từ thiếu bị lỗi; timestamp không đơn điệu bị lỗi; từ đầu không có space thừa làm gộp trang.

Kiểm tra: unit test.

## P1-04 — Template EduVertical

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P0-05`, `P0-02`, `P0-04` với decision `go`
- Skill: `build-video-template`

File được phép: `apps/video/**`, manifest license font, report, task file.

Mục tiêu: composition đọc `render_props` tối thiểu và vẽ năm loại slot trong [05-VIDEO-PIPELINE.md](05-VIDEO-PIPELINE.md).

Tiêu chí nghiệm thu: props mẫu về Redis render ra MP4 dọc; không gọi mạng lúc render; không import R3F.

Kiểm tra: render fixture và ffprobe.

## P1-05 — Preview và export

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P1-04`
- Skill: `build-video-template`

File được phép: `apps/video/**`, module hash props, report, task file.

Mục tiêu: hai mức CRF trong config; cùng hash và `templateVersion` thì không gọi `renderMedia()` lần hai.

Tiêu chí nghiệm thu: test dùng renderer giả đếm số lần gọi; lần hai cùng hash trả path cũ.

Kiểm tra: unit test cộng một render thật ngắn.

## P1-06 — CLI fixture

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P1-01`, `P1-03`, `P1-05`
- Skill: `implement-task`

File được phép: `apps/worker/src/cli/**`, report, task file. Được đọc package media và video, sửa chúng chỉ khi thiếu một hàm nối đã nêu trong task phụ thuộc.

Mục tiêu: một lệnh đọc `fixtures/script.edu.json`, gọi TTS, align, dựng props, render preview.

Tiêu chí nghiệm thu: không có lời gọi Gemini; QA tối thiểu ghi pass hoặc error cụ thể; MP4 1080×1920.

Kiểm tra: chạy CLI và ffprobe.

Ghi chú: đây là mốc MVP kỹ thuật nếu `P1-07` chưa chạy.

## P1-07 — Adapter Gemini

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P0-02`, `P1-06`
- Skill: `implement-task`
- ADR: [ADR-007](decisions/ADR-007-llm-adapter.md)

File được phép: `packages/config` biến model, `apps/worker/src/llm/**`, test, `.env.example` tên biến model, report, task file.

Mục tiêu: một interface structured output. Implementation Gemini. Task `script` trả đúng hai phương án. Ghi usage từ metadata response.

Tiêu chí nghiệm thu: test schema sai đi vào một lần repair rồi fail; test không repair quá một lần; lệnh `external` tùy chọn tạo một script từ brief Redis. Thiếu API key thì phần external `blocked` riêng, unit test fake vẫn phải `done` nếu pass. Trạng thái task là `done` khi fake pass và báo cáo nói rõ external đã chạy hay bị chặn vì thiếu key.

Kiểm tra: unit test adapter; external chỉ khi `GEMINI_API_KEY` có trong environment của phiên đó.

Ghi chú: không thêm OpenAI ở task này. Live `llm:external` **PASS** 2026-10-30 trên **gemini-3.8-flash** (`repairCount` 0). Workaround `diagramJson` ghi trong [ADR-007](decisions/ADR-007-llm-adapter.md). Chưa live-test workaround trên gemini-3.6-flash. Mặc định model không đổi.

## P1-08 — Override phụ đề

- Trạng thái: done
- Ưu tiên: medium
- Phụ thuộc: `P1-03`, `P1-06`
- Skill: `implement-task`

File được phép: schema override, hàm áp override, test CLI, report, task file.

Mục tiêu: file sửa `startMs` và `endMs` của một từ, render dùng bản sửa, không gọi TTS.

Tiêu chí nghiệm thu: test đếm lời gọi synthesize vẫn là số WAV cảnh, không tăng sau override.

Kiểm tra: unit test và một lần chạy CLI với override.

Ghi chú: Director verify props-only PASS — `reports/P1-08.md`; override mẫu `what-is-redis` wordIndex 2 (`6540`–`6960` ms); `contentHash` đổi; `synthesizeReused`/`alignReused` = 5.

## P2-01 — Schema Drizzle

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P0-01`, `P1-06`
- Skill: `implement-task`
- ADR: [ADR-003](decisions/ADR-003-postgres-and-redis.md)

File được phép: `packages/db/**`, migration, report, task file.

Mục tiêu: bảng và khóa ở [03-DATABASE-DESIGN.md](03-DATABASE-DESIGN.md).

Tiêu chí nghiệm thu: migration lên được trên Postgres của Compose; unique `jobs.idempotency_key`; check hoặc enum khớp tập trạng thái đã viết.

Kiểm tra: migration trên database trống rồi chạy lại lần hai không lỗi.

Ghi chú: Director verify PASS 2026-10-30 — migrate ×2, test constraint, volume/media giữ — [reports/P2-01.md](../reports/P2-01.md).

## P2-02 — Session

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P2-01`
- Skill: `implement-task`

File được phép: `apps/api/src/**` session, test, report, task file.

Mục tiêu: login, logout, cookie HMAC, `401` khi chưa đăng nhập.

Tiêu chí nghiệm thu: test sai mật khẩu không nhận cookie; response và log không echo mật khẩu.

Kiểm tra: Vitest với Fastify inject.

Ghi chú: Director verify PASS 2026-10-30 — `@studio/api` test 35/35, typecheck api/contracts/config — [reports/P2-02.md](../reports/P2-02.md). Session stateless; logout không revoke cookie đã copy; Origin loopback + SameSite=Lax (mục 7 report). Volume/media không đổi.

## P2-03 — API project

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P2-02`
- Skill: `implement-task`

File được phép: route project, brief, references, test, report, task file.

Mục tiêu: các route tương ứng trong [07-API-CONTRACTS.md](07-API-CONTRACTS.md). Upload lưu `storage_key` an toàn.

Tiêu chí nghiệm thu: từ chối pdf quá giả lập vượt 10 MB; từ chối key `../`.

Kiểm tra: test API với Postgres.

## P2-04 — API approval

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P2-03`
- Skill: `implement-task`
- ADR: [ADR-004](decisions/ADR-004-human-approval.md)

File được phép: route approval và transition tối thiểu để ghi decision, test, report, task file. Chưa cần đủ mọi job agent.

Mục tiêu: ghi approval và đổi status trong một transaction theo [04-AGENT-ORCHESTRATION.md](04-AGENT-ORCHESTRATION.md).

Tiêu chí nghiệm thu: thiếu `decision` là 400; `approved` không tự sinh từ GET; decision sai cổng là `invalid_transition`.

Kiểm tra: test transaction rollback khi insert event lỗi.

## P2-05 — Vỏ web

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P2-02`
- Skill: `implement-task`

File được phép: `apps/web/**` trừ thư mục `src/studio/` nếu đã tạo. Login, layout, từ điển `vi`, TanStack Query. Report và task file.

Mục tiêu: Vite, Tailwind v4, shadcn, trang login tiếng Việt, shell ba vùng chưa có canvas 3D.

Tiêu chí nghiệm thu: login sai hiện lỗi tiếng Việt; không có chuỗi điều khiển tiếng Anh trên các nút của shell.

Kiểm tra: unit test component login nếu có, và `pnpm --filter <web> typecheck`.

Ghi chú: Playwright đầy đủ có thể gắn ở `P2-07` khi luồng duyệt tồn tại.

## P2-06 — Form brief

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P2-03`, `P2-05`
- Skill: `implement-task`

File được phép: trang project và form brief, test, report, task file.

Mục tiêu: tạo project, nhập brief, đính kèm file hợp lệ.

Tiêu chí nghiệm thu: duration ngoài 30–90 không gửi; form hiển thị lỗi từ `validation_error`.

Kiểm tra: test component hoặc Playwright của form.

## P2-07 — So sánh kịch bản

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P2-04`, `P2-06`
- Skill: `implement-task`

File được phép: UI hai phương án, nút duyệt, từ chối, yêu cầu sửa, test, report, task file.

Mục tiêu: Director gửi đúng body approval. Không có nút “chấp nhận tất cả” tự duyệt im lặng.

Tiêu chí nghiệm thu: yêu cầu sửa bắt buộc note; sau reload vẫn thấy decision đã lưu.

Kiểm tra: Playwright hoặc test API kèm component. Ghi rõ loại đã chạy.

## P2-08 — Preview và version

- Trạng thái: done
- Ưu tiên: medium
- Phụ thuộc: `P2-07`, `P1-05`
- Skill: `implement-task`

File được phép: panel player, danh sách artifact, report, task file.

Mục tiêu: `@remotion/player` nhận props của artifact; danh sách version không ghi đè artifact cũ.

Tiêu chí nghiệm thu: player không gọi export; artifact cũ còn mở được.

Kiểm tra: test danh sách version với hai artifact.

## P2-09 — Route media

- Trạng thái: done
- Ưu tiên: medium
- Phụ thuộc: `P2-08`, `P3-06`
- Skill: `implement-task`

Director mở task 2026-10-31 (quyết định 7 trong checkpoint của [12-MODEL-HANDOFF.md](12-MODEL-HANDOFF.md)).

File được phép: route `GET /api/artifacts/:artifactId/media`, hàm resolve `storage_key`, panel preview, test, `.gitignore` (thư mục panel preview bị bỏ qua), mục route trong 07-API-CONTRACTS, report, task file.

Mục tiêu: player và màn hình phát được preview, export và tiếng của render props mà không thoát volume `data/`.

Tiêu chí nghiệm thu: key chứa `..`, ký tự null hoặc path tuyệt đối bị từ chối trước khi đọc đĩa; preview stream được và tua được (Range); player của render props có tiếng khi WAV tồn tại.

Kiểm tra: test tích hợp route media, unit test resolve, test panel preview.

## P2-10 — UI cổng final, hủy và resume

- Trạng thái: done
- Ưu tiên: medium
- Phụ thuộc: `P2-09`, `P3-06`, `P3-08`
- Skill: `implement-task`

Director mở task 2026-10-31.

File được phép: `apps/web/src/features/final-review/**`, `apps/web/src/lib/media.ts`, chỗ gắn panel trong trang project, chuỗi `vi`, panel preview (dùng chung URL media), test, report, task file.

Mục tiêu: Director xem preview mới nhất cùng QA của đúng bản đó và gửi decision ở cổng final; hủy và resume lượt chạy từ giao diện.

Tiêu chí nghiệm thu: mỗi nút gửi đúng một decision tường minh cho đúng preview; nút duyệt khóa khi QA chưa đạt; hủy cần xác nhận và không ghi approval; resume chỉ hiện khi run `failed` có `resume_from`.

Kiểm tra: test component với server giả có trạng thái.

## P2-11 — Bố cục theo bước và ước tính thời gian

- Trạng thái: pending
- Ưu tiên: medium
- Phụ thuộc: `P2-10`, `P3-11`
- Skill: `implement-task`

Director mở task 2026-10-31 và chọn bố cục "theo bước quy trình".

File được phép: `apps/web/src/features/**`, `apps/web/src/i18n/vi.ts`, test web, mục Bố cục trong 06-3D-UI-DESIGN, report, task file.

Mục tiêu (cập nhật 2026-11-01): giao diện theo [06-3D-UI-DESIGN.md](06-3D-UI-DESIGN.md) mới: trang dự án, năm màn theo bước, thanh tiến trình bảy bước có ước tính, studio 3D là khối chính màn "Đang chạy" với robot từng vai trò. Bố cục ba cột đã làm ở lần đầu (chưa commit) được thay; hàm ước tính và chọn model giữ lại. Chờ Director xác nhận trước khi code.

Tiêu chí nghiệm thu: thanh tiến trình đúng bước theo trạng thái đã lưu (cả lỗi và hủy); bước máy đang chạy hiện thời gian đã chạy thật và khoảng ước tính, không có phần trăm; bước chờ Director không có ước tính; nút bắt đầu hiện ước tính tổng.

Kiểm tra: test hàm ước tính và test web.

## P2-12 — Sửa lời thoại kịch bản trước khi duyệt

- Trạng thái: pending
- Ưu tiên: medium
- Phụ thuộc: `P2-07`, `P3-04`
- Skill: `implement-task`

Director duyệt 2026-11-01 (danh sách 12 mục, theo đề xuất).

File được phép: route sửa kịch bản, hàm DB tạo version mới, contracts, ô sửa trên màn duyệt kịch bản, test, report, task file.

Mục tiêu: Director sửa chữ trên màn hình và lời thoại từng cảnh của một phương án rồi duyệt bản đã sửa (PRD mục 5).

Tiêu chí nghiệm thu: sửa tạo artifact `script` version mới (bản cũ giữ nguyên), metadata ghi là Director sửa; chỉ sửa được khi run ở `waiting_script_approval`; nội dung phải qua `scriptArtifactSchema`; không ghi approval.

Kiểm tra: test API và test web.

## P2-13 — Test Playwright cho giao diện

- Trạng thái: pending
- Ưu tiên: medium
- Phụ thuộc: `P2-11`
- Skill: `implement-task`

Director duyệt 2026-11-01 (danh sách 12 mục, theo đề xuất).

File được phép: cấu hình và test Playwright trong `apps/web`, script chạy, report, task file. Tải trình duyệt Playwright cần Director cho phép.

Director chọn 2026-11-02: dùng Chrome của Remotion (`chrome-headless-shell` trong `apps/video/node_modules/.remotion/`, Chrome for Testing 157) qua `launchOptions.executablePath`, chạy headless; không chạy `playwright install`. Thêm `@playwright/test` (devDependency của `apps/web`) là được phép. Chỉ bắt đầu sau khi `P2-11` là `done`.

Mục tiêu: đăng nhập, tạo dự án và brief, thấy màn duyệt kịch bản và trạng thái sau reload chạy trên trình duyệt thật (09-TEST-STRATEGY).

Tiêu chí nghiệm thu: test chạy với API và DB test, không dùng DB `studio`.

Kiểm tra: lệnh Playwright.

## P2-14 — Nghe audio và sửa timing phụ đề trên web

- Trạng thái: pending
- Ưu tiên: low
- Phụ thuộc: `P1-08`, `P2-11`
- Skill: `implement-task`

Director duyệt 2026-11-01 (danh sách 12 mục, theo đề xuất).

File được phép: để Director mở khi cần; chưa có phạm vi file.

Mục tiêu: PRD mục 6 trên giao diện (hiện chỉ có CLI P1-08).

Tiêu chí nghiệm thu: chốt khi Director mở task.

Kiểm tra: chốt khi Director mở task.

## P3-01 — Hàng đợi

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P2-01`
- Skill: `build-agent-workflow`
- ADR: [ADR-003](decisions/ADR-003-postgres-and-redis.md)

File được phép: `apps/worker` phần queue, repository job, test, report, task file.

Mục tiêu: ba queue, payload `{ jobId }`, đối chiếu job DB với Redis lúc start.

Tiêu chí nghiệm thu: xóa job Redis của một hàng `queued` rồi khởi động worker sẽ enqueue lại đúng một lần.

Kiểm tra: test với Redis Compose.

## P3-02 — State machine

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P3-01`
- Skill: `build-agent-workflow`

File được phép: module transition thuần, test, report, task file.

Mục tiêu: đúng các cạnh trong [04-AGENT-ORCHESTRATION.md](04-AGENT-ORCHESTRATION.md), gồm cancel và resume.

Tiêu chí nghiệm thu: bảng test cho cạnh hợp lệ và cạnh bị từ chối; hàm không đọc network.

Kiểm tra: unit test.

## P3-03 — Job research

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P3-02`, `P1-07`
- Skill: `build-agent-workflow`

File được phép: job research, fetch có chặn SSRF, schema research, test, report, task file.

Mục tiêu: schema research trong tài liệu orchestration. Fact `verified` sai nguồn bị loại.

Tiêu chí nghiệm thu: test URL metadata bị từ chối; test citation lạ không thành `verified`; không dùng Search grounding.

Kiểm tra: unit test fetch và một job với LLM giả.

## P3-04 — Job script và cổng

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P3-03`, `P2-04`
- Skill: `build-agent-workflow`

File được phép: job script, nối approval, test, report, task file.

Mục tiêu: sau research, sinh hai phương án rồi dừng `waiting_script_approval`. `changes_requested` chạy lại script, không chạy lại research.

Tiêu chí nghiệm thu: test đếm job research vẫn là một sau lượt sửa script.

Kiểm tra: test worker với LLM giả và Postgres.

## P3-05 — Visual và voice

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P3-04`, `P1-02`, `P1-04`
- Skill: `build-agent-workflow`

File được phép: hai job và rào phụ thuộc, test, report, task file.

Mục tiêu: sau approval script, visual và voice chạy song song. Preview chưa chạy khi thiếu một trong hai.

Tiêu chí nghiệm thu: test thiếu audio không enqueue render.

Kiểm tra: test hàng đợi.

## P3-06 — Preview, QA, export

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P3-05`, `P1-05`, `P1-08`
- Skill: `build-agent-workflow`

File được phép: job preview, QA, export, test, report, task file.

Mục tiêu: QA tạo report; cổng final; export chỉ với approval đúng preview.

Tiêu chí nghiệm thu: approval của preview A không export được preview B.

Kiểm tra: test tích hợp worker.

## P3-07 — SSE

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P3-02`, `P2-02`
- Skill: `build-agent-workflow`

File được phép: route SSE, publisher event, test, report, task file.

Mục tiêu: `afterId` phát lại hàng đã commit, rồi event mới.

Tiêu chí nghiệm thu: test ngắt kết nối không mất hàng đã insert.

Kiểm tra: test stream Fastify.

## P3-08 — Hủy và resume

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P3-06`, `P3-07`
- Skill: `build-agent-workflow`

File được phép: cancel, resume, test, report, task file.

Mục tiêu: kill giả lập sau audio rồi resume không tạo audio mới; cancel không ghi approval.

Tiêu chí nghiệm thu: đúng hai điều trên trong test.

Kiểm tra: test tích hợp.

## P3-09 — Usage

- Trạng thái: done
- Ưu tiên: medium
- Phụ thuộc: `P1-07`, `P3-02`
- Skill: `implement-task`

File được phép: ghi `usage_records`, API GET usage, test, report, task file.

Mục tiêu: mỗi lần gọi LLM một row token. Trần `cost_ceiling` dừng run.

Tiêu chí nghiệm thu: repair tính thêm một row; lần thứ ba không gọi provider khi trần đặt là 2 trong test.

Kiểm tra: unit test trần.

## P3-10 — Consumer queue llm và bắt đầu run

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P3-01`, `P3-03`, `P3-04`, `P3-09`, `P2-10`
- Skill: `build-agent-workflow`

Director mở quyết định 5 ngày 2026-10-31 (consumer BullMQ queue `llm`, có chi phí Gemini).

File được phép: consumer và process worker queue `llm`, `startWorkflowRun`, route `POST /api/projects/:projectId/workflow-runs`, nút bắt đầu run trên web, chuỗi `vi`, test, report, task file.

Mục tiêu: Director bắt đầu run từ brief; worker chạy research, script và visual qua BullMQ; run dừng ở cổng script chờ Director.

Tiêu chí nghiệm thu: test tích hợp với Redis thật và provider giả đi từ bắt đầu run tới `waiting_script_approval` mà không ghi approval; lỗi bất ngờ hết lượt retry làm run `failed` có `resume_from`, không kẹt. Lần gọi Gemini thật đầu tiên chỉ chạy khi Director xác nhận.

Kiểm tra: test tích hợp consumer, test API route, test nút web.

## P3-11 — Consumer queue media và render

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P3-05`, `P3-06`, `P3-10`
- Skill: `build-agent-workflow`

Director mở task 2026-10-31.

File được phép: consumer và process worker (`apps/worker/src/queue/**`), script worker trong `apps/worker/package.json`, test, report, task file.

Mục tiêu: worker chạy voice và QA (queue `media`), render preview và export (queue `render`), để run đi từ duyệt kịch bản tới `exported`.

Tiêu chí nghiệm thu: test tích hợp với Redis thật, TTS và backend render giả đi từ duyệt kịch bản qua preview, QA, duyệt final tới `exported`; render lỗi bất ngờ hết retry làm run `failed` với `resume_from = preview_rendering` mà không làm lại audio. Lần chạy TTS và render thật đầu tiên (ghi vào `data/`) chỉ chạy khi Director cho phép.

Kiểm tra: test tích hợp consumer.

## P3-12 — Chọn model theo lượt chạy

- Trạng thái: pending
- Ưu tiên: medium
- Phụ thuộc: `P3-10`
- Skill: `implement-task`

Director chọn 2026-10-31 "chọn theo từng lượt chạy" (gồm migration). Danh sách model do Director điền trong `.env` (`GEMINI_MODELS`); agent không tự điền model ID.

File được phép: cột `workflow_runs.llm_model` (migration 0002), config Gemini, contracts run, `startWorkflowRun`, route bắt đầu run và `GET /api/llm-models`, consumer worker, ô chọn model trên web, test, mục liên quan trong 03 và 07, report, task file.

Mục tiêu: Director chọn model khi bắt đầu run; research và script của run gọi đúng model đó.

Tiêu chí nghiệm thu: model ngoài danh sách bị từ chối; run lưu model; worker gọi Gemini bằng model của run và usage ghi đúng model; không có body thì dùng mặc định.

Kiểm tra: test API, test consumer, test web.

## P3-13 — DB test riêng

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P3-11`
- Skill: `implement-task`

Director duyệt 2026-11-01 (danh sách 12 mục, theo đề xuất).

File được phép: script tạo và migrate DB `studio_test`, cấu hình env test của các package, test, report, task file.

Mục tiêu: test tích hợp không bao giờ dùng DB `studio`, nên worker thật không nhận job của test.

Tiêu chí nghiệm thu: mọi suite chạy với `studio_test`; DB `studio` không đổi số hàng sau khi chạy test.

Kiểm tra: chạy toàn bộ suite, so số hàng DB `studio` trước và sau.

## P3-14 — Job cho yêu cầu sửa ở cổng final

- Trạng thái: pending
- Ưu tiên: medium
- Phụ thuộc: `P3-06`, `P3-11`
- Skill: `build-agent-workflow`

Director duyệt 2026-11-01 (danh sách 12 mục, theo đề xuất).

File được phép: `recordApproval` cho `final` + `changes_requested`, job worker liên quan, test, report, task file.

Mục tiêu: yêu cầu sửa ở cổng final dựng lại bản preview mới thay vì để run đứng ở `producing_assets`.

Tiêu chí nghiệm thu: `final` + `changes_requested` tạo job render lại (dùng lại audio đã có, không gọi TTS lại) với ghi chú Director trong metadata; run đi tiếp tới `waiting_final_approval` với preview version mới; không ghi approval khác.

Kiểm tra: test tích hợp consumer.

## P3-15 — Tín hiệu worker còn sống

- Trạng thái: pending
- Ưu tiên: medium
- Phụ thuộc: `P3-11`
- Skill: `implement-task`

Director duyệt 2026-11-01 (danh sách 12 mục, theo đề xuất).

File được phép: worker ghi heartbeat vào Redis, route API đọc trạng thái, chấm trạng thái trên thanh trên của web, test, report, task file.

Mục tiêu: giao diện biết worker có đang chạy và chạy queue nào.

Tiêu chí nghiệm thu: worker chạy thì chấm xanh kèm queue; tắt quá 30 giây thì chấm xám "Worker đã tắt"; không lộ URL Redis.

Kiểm tra: test API và test web.

## P3-17 — Bước giọng và hình: không giới hạn thời gian, tiến độ thật, lỗi chi tiết

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P3-11`, `P2-11`
- Skill: `implement-task`

Director yêu cầu 2026-11-01 sau khi bước 4 lỗi trong lần chạy thật, chạy lại thì lâu và không ra kết quả.

File được phép: `apps/worker/src/media-client.ts`, `cli/media-stage.ts`, `cli/paths.ts`, `assets/voice-job.ts`, `render/*`, `queue/run-worker.ts`; `packages/db/src/agent-jobs.ts`, `workflow.ts`; contracts run detail; `apps/web/src/features/run/**`, `vi.ts`; test; `.env.example`; mục timeout của 04 và mục Tiến độ của 06; report; task file.

Mục tiêu: TTS không bị cắt vì giới hạn thời gian; lỗi thật hiện mã và chi tiết trên giao diện; bước đang chạy hiện phần trăm từ số đếm thật; hủy run thì job dừng ở bước kế tiếp.

Tiêu chí nghiệm thu: không đặt `TTS_TIMEOUT_MS` thì không có giới hạn; lỗi của service TTS giữ mã và thông điệp; run detail trả `errorCode`, `errorMessage`, `progress` của agent và `failureMessage` của run; voice ghi `job.progress` sau mỗi bước cảnh, render ghi theo frame; tiến độ chỉ hiện khi agent đang chạy; hủy sau cảnh 1 thì không chạy cảnh 2. Job LLM không có phần trăm (ADR-009).

Kiểm tra: test worker (client TTS, tích hợp voice), test web.

## P3-16 — QA cảnh báo khoảng lặng dài

- Trạng thái: pending
- Ưu tiên: medium
- Phụ thuộc: `P3-06`
- Skill: `implement-task`

Director duyệt 2026-11-01 (danh sách 12 mục, theo đề xuất).

File được phép: `runQaChecks`, test, report, task file.

Mục tiêu: QA ghi warning `long_silence` khi trong một cảnh không có lời quá ngưỡng (05-VIDEO-PIPELINE).

Tiêu chí nghiệm thu: warning không chặn duyệt; ngưỡng là hằng số có ghi trong code; không đổi các check error.

Kiểm tra: unit test `runQaChecks`.

## P4-01 — Hình studio

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P2-05`
- Skill: `build-3d-scene`
- ADR: [ADR-009](decisions/ADR-009-3d-monitoring.md)

File được phép: `apps/web/src/studio/**`, report, task file.

Mục tiêu: canvas low-poly, tám vị trí, camera như [06-3D-UI-DESIGN.md](06-3D-UI-DESIGN.md). Trạng thái truyền bằng props, mặc định `idle`.

Tiêu chí nghiệm thu: không có interval tự đổi trạng thái; không import code từ `apps/video`.

Kiểm tra: typecheck và test props nếu có renderer test; không cần screenshot làm tiêu chí duy nhất.

## P4-02 — Nối trạng thái thật

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P4-01`, `P3-07`
- Skill: `build-3d-scene`

File được phép: store studio, subscriber SSE, report, task file.

Mục tiêu: avatar đọc `agent_runs`. Thanh render chỉ khi event có số frame.

Tiêu chí nghiệm thu: fixture idle một phút đồng hồ giả lập vẫn idle; event progress có frame thì đổi thanh.

Kiểm tra: unit test reducer của store.

## P4-03 — Reduced motion

- Trạng thái: done
- Ưu tiên: medium
- Phụ thuộc: `P4-02`
- Skill: `build-3d-scene`

File được phép: cờ hiệu năng và reduced motion trong studio, test, report, task file.

Mục tiêu: `dpr` 1, tắt shadow, tắt vòng lặp khi `prefers-reduced-motion`.

Tiêu chí nghiệm thu: test cờ truyền vào canvas.

Kiểm tra: unit test.

## P4-04 — Inspector

- Trạng thái: done
- Ưu tiên: medium
- Phụ thuộc: `P4-02`, `P2-07`
- Skill: `build-3d-scene`

File được phép: chọn role và mở panel 2D có sẵn, test, report, task file.

Mục tiêu: click avatar mở đúng panel. Phím và nút 2D vẫn duyệt được khi canvas ẩn.

Tiêu chí nghiệm thu: ẩn canvas không gỡ route duyệt.

Kiểm tra: test điều hướng panel.

## P4-05 — Robot vai trò theo thiết kế mới

- Trạng thái: pending
- Ưu tiên: medium
- Phụ thuộc: `P4-04`, `P2-11`
- Skill: `build-3d-scene`

Director duyệt 2026-11-01 (danh sách 12 mục, theo đề xuất).

File được phép: `apps/web/src/studio/**`, test, report, task file.

Mục tiêu: robot chibi dựng bằng code theo 06 mục Robot của từng vai trò và Biểu cảm theo trạng thái; studio là khối chính màn "Đang chạy".

Tiêu chí nghiệm thu: mỗi vai trò có phụ kiện và màu riêng; mặt đổi biểu cảm theo trạng thái đã lưu; reduced motion và hiệu năng thấp tắt animation lặp; không asset ngoài; canvas lỗi vẫn có danh sách 2D.

Kiểm tra: test studio và xem tay trên trình duyệt.

## P5-01 — Cache research

- Trạng thái: done
- Ưu tiên: medium
- Phụ thuộc: `P3-03`
- Skill: `implement-task`

File được phép: hash tài liệu đầu vào của job research, test, report, task file.

Mục tiêu: cùng brief và cùng hash reference thì tái sử dụng artifact research.

Tiêu chí nghiệm thu: provider giả không bị gọi lần hai.

Kiểm tra: unit test idempotency.

## P5-02 — Màn usage

- Trạng thái: done
- Ưu tiên: low
- Phụ thuộc: `P3-09`, `P2-05`
- Skill: `implement-task`

File được phép: trang usage, test, report, task file.

Mục tiêu: tổng token và ước tính theo project từ `usage_records`.

Tiêu chí nghiệm thu: không hard-code đơn giá trong component; đọc số đã lưu.

Kiểm tra: test render với hai record.

## P5-04 — Tổng token theo tháng

- Trạng thái: pending
- Ưu tiên: low
- Phụ thuộc: `P5-02`
- Skill: `implement-task`

Director duyệt 2026-11-01 (danh sách 12 mục, theo đề xuất).

File được phép: route tổng usage theo tháng, ô số liệu trên trang dự án, test, report, task file.

Mục tiêu: trang dự án hiện tổng token Gemini của tháng hiện tại.

Tiêu chí nghiệm thu: chỉ cộng `usage_records` đã lưu; không tính tiền (chưa có bảng giá).

Kiểm tra: test API và test web.

## P5-03 — Template thứ hai

- Trạng thái: done
- Ưu tiên: low
- Phụ thuộc: `P1-04`
- Skill: `build-video-template`

File được phép: template mới trong `apps/video`, report, task file.

Mục tiêu: chỉ bắt đầu khi Director chọn mở task. Giữ `EduVertical` chạy như cũ.

Tiêu chí nghiệm thu: fixture cũ vẫn render bằng template cũ.

Kiểm tra: render hồi quy fixture Redis.

Ghi chú: để `pending` cho đến khi có yêu cầu riêng. Không làm trong phiên của task khác.

## P5-05 — Sơ đồ của template EduVertical

- Trạng thái: pending
- Ưu tiên: medium
- Phụ thuộc: `P1-04`
- Skill: `build-video-template`

Director mở task 2026-11-02 sau khi xem preview run `4c15d3bb…`: sơ đồ 4 khối bị cắt khối cuối, đường nối và mũi tên bị khối che.

File được phép: `DiagramSlot` trong `apps/video/src/components/slots/`, hàm bố cục sơ đồ mới trong `apps/video/src/`, `EDU_VERTICAL_TEMPLATE_VERSION` (hai chỗ khai báo) và `templateVersion` của fixture `apps/video/fixtures/edu-vertical-redis-props.json`, test, report, task file.

Mục tiêu: sơ đồ của `EduVertical` vẽ đủ mọi khối và cạnh mà script cho phép (tối đa 6 khối, 8 cạnh) trong khung dọc 1080×1920.

Tiêu chí nghiệm thu: mọi khối nằm trong khung; mũi tên đi từ cạnh khối nguồn tới cạnh khối đích, đầu mũi tên không bị che; cạnh không liền kề hoặc đi ngược vẽ vòng bên cạnh, không chồng lên cạnh liền kề; nhãn cạnh không nằm dưới khối; chữ dài trong khối xuống dòng; nâng version template để cache render không trả lại video cũ; `EduLight` và các slot khác không đổi.

Kiểm tra: unit test hàm bố cục; render fixture có sơ đồ, xem frame và ffprobe.

## P6-01 — Spike: shot list qua Gemini structured output

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: không
- Skill: `implement-task`
- ADR: [ADR-014](decisions/ADR-014-motion-kit-and-shot-list.md), [ADR-007](decisions/ADR-007-llm-adapter.md)

Director duyệt Phase 6 ngày 2026-11-02.

File được phép: script spike trong `apps/worker/src/spikes/p6-01/**`, `docs/spikes/P6-01-shot-list.md`, report, task file.

Mục tiêu: biết Gemini structured output có nhận schema shot list lồng nhau (cảnh → nhân vật → hành động, câu thoại có người nói) hay cần mã hóa chuỗi như `diagramJson`.

Tiêu chí nghiệm thu: báo cáo ghi schema đã thử, model, kết quả từng biến thể (nhận, từ chối, mã lỗi), số token và chi phí. Đề xuất cách mã hóa cho P6-06. Không sửa adapter đang chạy.

Kiểm tra: lệnh chạy lại trong báo cáo. **Cổng Director:** gọi Gemini live chỉ khi Director cho phép trong chat; không có phép thì làm phần offline (schema, fake) rồi `blocked` phần live.

## P6-02 — Spike: căn chữ câu ngắn theo người nói

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: không
- Skill: `debug-pipeline` nếu lệch; không thì `implement-task`
- ADR: [ADR-015](decisions/ADR-015-multi-speaker-voice.md), [ADR-011](decisions/ADR-011-whisper-alignment-default.md)

File được phép: script spike trong `services/tts/**` phần spike hoặc `apps/worker/src/spikes/p6-02/**`, dữ liệu dưới `data/spikes/p6-02/`, `docs/spikes/P6-02-short-line-alignment.md`, report, task file.

Mục tiêu: đo Whisper căn câu dưới 1 giây và câu 1–3 giây, đọc bằng hai giọng VieNeu khác nhau, theo cổng alignment hiện hành.

Tiêu chí nghiệm thu: bảng tỷ lệ đạt cổng theo độ dài câu; đề xuất ngưỡng gộp câu ngắn cùng người nói nếu cần. Không đổi cổng ADR-011/012.

Kiểm tra: lệnh chạy lại trong báo cáo. Cần container `tts` đang chạy.

## P6-03 — Spike: chi phí render cảnh nhân vật SVG

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: không
- Skill: `build-video-template`
- ADR: [ADR-014](decisions/ADR-014-motion-kit-and-shot-list.md), [ADR-006](decisions/ADR-006-remotion-local-render.md)

File được phép: composition spike trong `apps/video/src/spikes/p6-03/**` (không đăng ký vào workflow), đầu ra dưới `data/spikes/p6-03/`, `docs/spikes/P6-03-render-cost.md`, report, task file.

Mục tiêu: đo thời gian render 30 giây gồm hai nhân vật từ [design/characters/sheet.html](design/characters/sheet.html), bối cảnh ở ba mức chi tiết, khoảng 20 cú cắt mỗi phút, trên máy dev CPU.

Tiêu chí nghiệm thu: bảng giây render mỗi giây video theo mức chi tiết; ảnh tĩnh mỗi mức; đề xuất mức chi tiết mặc định cho P6-05. ffprobe đúng 1080×1920, 30 fps.

Kiểm tra: lệnh render và ffprobe trong báo cáo.

## P6-04 — Tài liệu và skill theo ADR-013 đến 016

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P6-01`, `P6-02`, `P6-03`
- Skill: `implement-task`

File được phép: `docs/00-VISION.md`, `docs/01-PRD.md`, `docs/02` đến `docs/09`, `.cursor/skills/create-motion-asset/SKILL.md` (mới), `.claude/skills/create-motion-asset/SKILL.md` (mới), `.cursor/skills/build-video-template/SKILL.md`, `AGENTS.md` mục Tài liệu, report, task file.

Mục tiêu: tài liệu nguồn sự thật khớp bốn ADR và kết quả ba spike: phạm vi nội dung, brand kit, gói thể loại, shot list, script schema `2`, voice theo câu, storyboard trước cổng script, kho tài sản, chế độ sáng tạo cách A, quy tắc bảo mật "không thực thi code LLM lúc chạy".

Tiêu chí nghiệm thu: mỗi mục đổi trỏ tới ADR; schema trong 05 và bảng trong 03 đủ để P6-06, P6-07 làm không cần đoán; skill `create-motion-asset` có quy trình, checklist soát ảnh tĩnh, lệnh được phép, điểm dừng. Không sửa `docs/decisions/`.

Kiểm tra: rà chéo link; Director đọc duyệt.

## P6-05 — Motion kit: rig, biểu cảm, ba nhân vật

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P6-03`, `P6-04`, `P5-05`
- Skill: `build-video-template`
- ADR: [ADR-014](decisions/ADR-014-motion-kit-and-shot-list.md)

File được phép: `packages/motion-kit/**` (mới), workspace và tsconfig cho package mới, test, report, task file.

Director chốt 2026-11-02 sau P6-03: bối cảnh mặc định mức 2 (phòng phối cảnh, khoảng 20 hình); yếu tố mức 3 (tấm che tối, bụi, tiền cảnh mờ) là tùy chọn theo cảnh, đo tách chi phí từng yếu tố trong task này. Sửa tay vẫy của Tí trông như gãi đầu ([docs/spikes/P6-03-render-cost.md](spikes/P6-03-render-cost.md)).

Mục tiêu: rig 2D dùng chung; 6 biểu cảm; lớp da Tí, Bit, Đậu; tư thế và hành động cơ bản (đứng, chào, chỉ, ăn mừng, hoảng, đi, nói); 2 bối cảnh; 3 cỡ cảnh; manifest `asset.json` cho từng tài sản.

Tiêu chí nghiệm thu: mọi tài sản là hàm thuần của frame (test render hai lần cùng frame ra cùng SVG); không `Math.random`, không mạng, không import R3F; ảnh tĩnh từng nhân vật và tư thế; test vị trí tay không bị đầu che ở các tư thế giơ tay.

Kiểm tra: test và typecheck package; ảnh tĩnh trong báo cáo.

## P6-06 — Contracts: script v2, gói thể loại, shot list

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P6-01`, `P6-04`
- Skill: `implement-task`
- ADR: [ADR-013](decisions/ADR-013-brand-kit-and-formats.md), [ADR-014](decisions/ADR-014-motion-kit-and-shot-list.md), [ADR-015](decisions/ADR-015-multi-speaker-voice.md)

File được phép: `packages/contracts/**`, test, report, task file.

Mục tiêu: script schema `2` (`lines[]` có `speaker`), đọc tương thích script `1`; định nghĩa gói `explainer` và gói giải trí Director chọn; schema shot list; hàm kiểm luật nhịp (cắt mỗi phút, cảnh tĩnh tối đa, không trùng cỡ cảnh liền nhau) và kiểm nhịp "sự thật" có nguồn.

Tiêu chí nghiệm thu: Zod chặn `speaker` không nói, id tài sản lạ ở `standard`; script `1` chuyển thành chuỗi câu `narrator`; test bảng cho luật nhịp.

Director chốt 2026-11-03: gói giải trí đầu tiên là `what_if` "Nếu như…?" với nhịp và số cắt mỗi phút ở [05-VIDEO-PIPELINE.md](05-VIDEO-PIPELINE.md), mục Gói thể loại. Director chốt 2026-11-03: thời lượng `what_if` là 30–60 giây.

Kiểm tra: test contracts. **Cổng Director:** thời lượng của `what_if` (đã chốt 30–60 s).

## P6-07 — Migration: kênh, thể loại, chế độ, kho tài sản

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P6-04`
- Skill: `implement-task`
- ADR: [ADR-013](decisions/ADR-013-brand-kit-and-formats.md), [ADR-016](decisions/ADR-016-creative-mode-motion-assets.md)

File được phép: `packages/db/**` (schema, migration mới, query), seed kênh mặc định không chứa tên giọng, test, mục 03 và 07, report, task file.

Mục tiêu: `brand_profiles` (nhân vật, giọng theo nhân vật, màu, mở/kết), thể loại trên brief, `workflow_runs.creative_mode`, `motion_assets`, `motion_asset_requests`, nới ràng buộc thời lượng brief theo gói.

Tiêu chí nghiệm thu: migration chạy hai lần không lỗi; dữ liệu cũ đọc được (project cũ gắn kênh mặc định, thể loại `explainer`); test trên `studio_test`; số hàng DB `studio` không đổi ngoài migration.

Kiểm tra: migrate ×2, test db và api. **Cổng Director:** chạy migration trên DB `studio`.

## P6-08 — Voice và căn chữ theo câu, phụ đề có người nói

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P6-02`, `P6-06`, `P6-07`, `P3-17`
- Skill: `implement-task`
- ADR: [ADR-015](decisions/ADR-015-multi-speaker-voice.md)

File được phép: `apps/worker/src/assets/voice-job.ts`, `apps/worker/src/cli/media-stage.ts`, `apps/worker/src/media-client.ts`, `apps/worker/src/cli/build-render-props.ts`, contracts captions, test, report, task file.

Mục tiêu: synthesize từng câu bằng giọng của người nói, nối thành audio cảnh với khoảng nghỉ hằng số, căn chữ **một lần cho cả cảnh** rồi chia từ về câu theo thứ tự token và vị trí ghép (ADR-015, mục Bổ sung 2026-11-02); dự phòng căn từng câu và gộp câu ngắn khi cảnh trượt cổng; `captions[].speaker`.

Tiêu chí nghiệm thu: sửa một câu chỉ đọc lại câu đó (cache) và căn lại cả cảnh; từ ngoài đoạn câu quá dung sai bị kẹp và có warning QA; hợp đồng `POST /synthesize`, `POST /align` của ADR-005 không đổi (cần endpoint mới thì `blocked`); script `1` cho kết quả như trước; tiến độ và hủy của P3-17 vẫn đúng theo câu; test tích hợp với TTS giả hai giọng.

Director chốt 2026-11-03 (sau khi nghe mẫu `data/voice-samples/`): Tí giọng "Hải Đăng", Bit giọng "Trúc Ly" (id preset của service `tts`). Người dẫn chuyện của kênh giữ mặc định.

Kiểm tra: test worker. **Cổng Director:** giọng của Tí và Bit (đã chốt).

## P6-09 — Template StickStory

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P6-05`, `P6-06`, `P6-08`
- Skill: `build-video-template`
- ADR: [ADR-014](decisions/ADR-014-motion-kit-and-shot-list.md)

File được phép: `apps/video/src/stick-story/**`, đăng ký composition, dựng `render_props` từ shot list trong worker, test, report, task file.

Mục tiêu: composition đọc shot list đã gắn frame (cắt trước từ khóa 2 frame theo alignment), vẽ bằng motion kit, phụ đề màu theo người nói, nhân vật đang nói mở miệng; version motion kit vào `templateVersion` và `content_hash`.

Tiêu chí nghiệm thu: fixture hai nhân vật render đúng 1080×1920, 30 fps; đổi version kit thì cache không trả MP4 cũ; `EduVertical` không đổi.

Kiểm tra: test video, render fixture, ffprobe, ảnh tĩnh.

## P6-10 — Prompt kịch bản v2 và storyboard trước cổng script

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P6-06`, `P6-07`, `P6-09`
- Skill: `build-agent-workflow`
- ADR: [ADR-013](decisions/ADR-013-brand-kit-and-formats.md), [ADR-014](decisions/ADR-014-motion-kit-and-shot-list.md), [ADR-004](decisions/ADR-004-human-approval.md)

File được phép: prompt và job script trong `apps/worker/src/llm/**`, job storyboard mới trong `apps/worker/src/render/**`, state machine trong contracts, `packages/db/src/workflow.ts`, test, mục 04, report, task file.

Mục tiêu: một lần gọi trả hai phương án script `2` kèm shot list, dùng tính cách và giọng điệu kênh, danh sách id tài sản đã duyệt; job render ảnh tĩnh từng cảnh của hai phương án và kiểm tự động (vùng an toàn, chồng nhân vật, tràn chữ, tương phản) trước `waiting_script_approval`.

Tiêu chí nghiệm thu: vẫn một lần gọi LLM, repair tối đa một lần; không ghi approval; lỗi storyboard vào báo cáo, không chặn cổng; test với LLM giả và render giả.

Director mở rộng phạm vi 2026-11-03: thêm `apps/worker/package.json` (phụ thuộc `@studio/motion-kit`) và `apps/worker/tsconfig.json` (bật JSX) để job storyboard dùng hàm hình học của motion kit.
Director mở rộng phạm vi lần hai 2026-11-03: migration mới thêm giá trị `storyboarding` vào enum `workflow_run_status` và `packages/db/src/schema/enums.ts` (chạy trên `studio` vẫn là cổng Director); `workflowRunStatusSchema` trong `packages/contracts/src/api/workflow.ts`; nhãn trạng thái ở `apps/web/src/features/run/run-status.ts`, `run-steps.ts`, `apps/web/src/i18n/vi.ts`.

ADR-014 bổ sung 2026-11-03 (P6-16): prompt không yêu cầu `onScreenText` hay `board`; script `2` không còn hai trường này. Ý cần minh họa viết bằng hành động, biểu cảm, đồ vật trong kho.

Kiểm tra: test tích hợp worker. **Cổng Director:** lần gọi Gemini live đầu tiên.

## P6-11 — Web: kênh, thể loại, chế độ, storyboard, kho hình động

- Trạng thái: pending
- Ưu tiên: medium
- Phụ thuộc: `P6-07`, `P6-10`, `P2-11`, `P2-12`
- Skill: `implement-task`

File được phép: `apps/web/src/features/**`, `apps/web/src/i18n/vi.ts`, route API đọc/ghi kênh, thể loại, kho tài sản, contracts API, test, mục 06 và 07, report, task file.

Mục tiêu: brief chọn kênh và thể loại; bắt đầu run chọn `standard` hoặc `creative`; màn duyệt kịch bản có bảng storyboard và sửa câu theo người nói; màn sửa kênh (giọng mỗi nhân vật); màn "Kho hình động" lọc, xem ảnh, duyệt `candidate`.

Tiêu chí nghiệm thu: tiếng Việt; chọn giọng chỉ từ danh sách service TTS trả về; duyệt tài sản không ghi approval workflow; test web.

Kiểm tra: test api và web.

## P6-12 — SFX và chuẩn hóa âm lượng

- Trạng thái: pending
- Ưu tiên: medium
- Phụ thuộc: `P6-09`
- Skill: `build-video-template`
- ADR: [ADR-014](decisions/ADR-014-motion-kit-and-shot-list.md)

File được phép: kho SFX trong `packages/motion-kit/sfx/**` kèm manifest license, gắn SFX vào hành động, mix trong `apps/video`, bước chuẩn hóa export, test, report, task file.

Mục tiêu: SFX theo hành động đặt sau từ khóa, lời to hơn SFX ít nhất 3 dB, export -14 LUFS, true peak dưới -1 dBTP; âm thanh không lời của Đậu.

Tiêu chí nghiệm thu: mọi file SFX có nguồn và license trong manifest; đo LUFS trong báo cáo.

Kiểm tra: render fixture và đo loudness. **Cổng Director:** nguồn SFX và license; không lấy từ repo ngoài khi chưa kiểm license.

## P6-13 — Chế độ sáng tạo cách A

- Trạng thái: pending
- Ưu tiên: medium
- Phụ thuộc: `P6-10`, `P6-11`, `P3-14`
- Skill: `build-agent-workflow`
- ADR: [ADR-016](decisions/ADR-016-creative-mode-motion-assets.md)

File được phép: ghi `motion_asset_requests` từ shot list `creative`, lệnh CLI worker xuất và đánh dấu yêu cầu, script đồng bộ manifest vào `motion_assets`, thay tài sản tạm khi render lại, skill `create-motion-asset`, test, report, task file.

Mục tiêu: run `creative` lưu yêu cầu tài sản và render bằng tài sản thay thế có nhãn; phiên Claude Code dùng skill tạo tài sản `candidate`; Director duyệt; "Yêu cầu sửa" ở cổng final render lại bằng tài sản mới, không gọi TTS.

Tiêu chí nghiệm thu: ứng dụng không gọi Claude và không bundle code ngoài repo; yêu cầu chuyển `fulfilled` khi tài sản `approved`; test tích hợp luồng đủ vòng với tài sản giả.

Kiểm tra: test tích hợp worker và web; một lần thử thật tạo một tài sản qua skill.

## P6-14 — Spike: worker gọi Claude Code không giao diện để viết kịch bản

- Trạng thái: pending
- Ưu tiên: medium
- Phụ thuộc: không
- Skill: `implement-task`
- ADR: [ADR-007](decisions/ADR-007-llm-adapter.md)

Director yêu cầu 2026-11-02 ("thử cách 2"): khi bấm chạy, kịch bản do Claude Code viết bằng gói thuê bao của Director thay cho Gemini API.

File được phép: `apps/worker/src/spikes/p6-14/**`, đầu ra dưới `data/spikes/p6-14/`, `docs/spikes/P6-14-claude-code-headless.md`, report, task file. Không sửa adapter, workflow hay queue đang chạy.

Mục tiêu: đo được `claude -p` (đăng nhập gói thuê bao, không `--bare`) có trả kịch bản đúng schema `1` qua đúng luồng `generateWithSchemaRepair` của app không, khi bị khóa chặt: `--safe-mode`, `--tools ""`, `--strict-mcp-config`, `--permission-mode dontAsk`, `--no-session-persistence`, `--system-prompt` của app, `--json-schema`, chạy trong thư mục tạm trống.

Tiêu chí nghiệm thu: báo cáo ghi phiên bản CLI, model đã chạy, thời gian, số lượt, chi phí ước tính phía client, kết quả Zod và số lần repair; một ca brief có chèn lệnh lạ (đọc file, chạy lệnh) cho thấy không có công cụ nào chạy; ghi rõ điều khoản dùng gói thuê bao cho tự động hóa là câu hỏi Director tự kiểm. Đề xuất có làm adapter thật hay không.

Kiểm tra: lệnh chạy lại trong báo cáo. **Cổng Director:** Director tự cài Claude Code CLI và đăng nhập; agent không cài và không nhập thông tin đăng nhập.

## P6-15 — Client Claude Code cho research và script

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P6-14`, `P3-12`
- Skill: `implement-task`
- ADR: [ADR-007](decisions/ADR-007-llm-adapter.md) (bổ sung 2026-11-02)

Director yêu cầu 2026-11-02 sau spike P6-14 ("Làm adapter").

File được phép: `packages/config/src/claude-code.ts` (mới) và `exports` của `packages/config`; `apps/worker/src/llm/claude-code-client.ts` (mới), `errors.ts`, `types.ts`; `apps/worker/src/queue/consumer.ts`, `run-worker.ts`; `apps/worker/src/script/script-job.ts` và `research/research-job.ts` phần xử lý lỗi; danh sách model trong `apps/api/src/routes/workflow-runs.ts`; ô chọn model và chuỗi lỗi trên web (`apps/web/src/features/projects/start-run.tsx`, `features/run/**`, `i18n/vi.ts`); test; `.env.example`; mục liên quan trong 04 và 07; report; task file.

Mục tiêu: Director chọn `claude-code` (hoặc `claude-code:<alias>`) khi bắt đầu run; research và script của run đó được Claude Code viết qua `claude -p` khóa chặt, cùng prompt, schema, Zod và repair như Gemini.

Tiêu chí nghiệm thu:

- không đặt `CLAUDE_CODE_MODELS` thì danh sách model và hành vi như cũ;
- model `claude-code…` ngoài danh sách bị API từ chối như model Gemini lạ;
- client gọi CLI với đủ cờ khóa chặt, prompt qua stdin, thư mục tạm trống được xóa sau mỗi lần gọi;
- usage ghi `provider = claude-code`, model thật, chi phí 0;
- chưa đăng nhập → `configuration_missing`, hết hạn mức → `quota_exhausted`, cả hai không retry; giao diện hiện mô tả tiếng Việt;
- worker chạy queue `llm` khi chỉ có Claude Code, không có `GEMINI_API_KEY`;
- không viết cứng đường dẫn CLI, model ID hay thư mục cấu hình.

Kiểm tra: test client với process giả (Node script giả CLI), test consumer chọn client theo model của run, test API danh sách model, test web; một lần chạy thật từ giao diện do Director làm.

## P3-18 — Sửa từ độ dài 0 khi căn chữ

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P3-17`
- Skill: `debug-pipeline`
- ADR: [ADR-012](decisions/ADR-012-alignment-trailing-silence-gate.md) (bổ sung 2026-11-02), [ADR-011](decisions/ADR-011-whisper-alignment-default.md)

Director mở task 2026-11-02 sau run `ba4dc84c`: cảnh s3 trượt cổng `alignment_gate_failed` vì Whisper gán độ dài 0 cho "code" và "về".

File được phép: `services/tts/app/alignment/**` (sửa, validate, gate, revalidate), `services/tts/app/main.py` phần revalidate, test trong `services/tts/tests/`, `GATE_POLICY_VERSION` trong `apps/worker/src/cli/media-stage.ts`, mục Alignment của 05, report, task file. Triển khai vào container `tts` đang chạy bằng cách chép file và khởi động lại; không build lại image trong task này.

Mục tiêu: vài từ độ dài 0 không làm cả cảnh trượt cổng, mà vẫn giữ ngưỡng 90% tính trên số từ đo được thật.

Tiêu chí nghiệm thu:

- từ độ dài 0 được cho khoảng ngắn, giữ thứ tự, không vượt độ dài file, có warning và `repairedWordCount`;
- `alignedWordRatio` tính trên số từ trước khi sửa;
- revalidate sửa và tính lại validation từ kết quả đã lưu;
- kết quả đã lưu của cảnh s3 run `ba4dc84c` qua cổng sau revalidate;
- test hiện có của service vẫn đạt.

Kiểm tra: pytest của service trong container tạm cùng image; revalidate trên WAV thật của s3; Director bấm Tiếp tục run `ba4dc84c`.

## P6-16 — Bỏ chữ phủ và khung bảng khỏi script v2

- Trạng thái: done
- Ưu tiên: high
- Phụ thuộc: `P6-06`, `P6-09`
- Skill: `implement-task`
- ADR: [ADR-014](decisions/ADR-014-motion-kit-and-shot-list.md) (bổ sung 2026-11-03)

Director mở task 2026-11-03 sau khi xem fixture `StickStory` và duyệt mục Bổ sung 2026-11-03 của ADR-014: video `StickStory` chỉ có hoạt hình và phụ đề lời thoại.

File được phép: `packages/contracts/src/script/v2.ts` và test; mục Script JSON v2, Template `StickStory`, Storyboard ảnh tĩnh của 05; điểm 8 checklist của skill `create-motion-asset` (`.cursor` và `.claude`); ghi chú vào khối P6-10; report; task file.

Mục tiêu: script `2` không còn `onScreenText` của shot và `board` của cảnh; tài liệu và skill khớp.

Tiêu chí nghiệm thu: Zod từ chối script `2` có hai trường này; script `1`, `EduVertical`, route sửa script P2-12 không đổi; test contracts, worker, video đạt.

Kiểm tra: test contracts, worker, video; typecheck các package dùng contracts.

## P6-17 — Chạy trọn run `what_if` trên web

- Trạng thái: pending
- Ghi chú 2026-11-03: sau run thật đầu tiên, Director duyệt bổ sung ADR-013 (Đậu có lời thoại giọng "Quỳnh Anh"; ba nhân vật trong khung `wide`, `high`) và yêu cầu sửa khung hình cắt đầu nhân vật. Làm trong P6-17, motion kit lên 0.2.0; xem report mục 4b, 4c, 4d.
- Ưu tiên: high
- Phụ thuộc: `P6-08`, `P6-09`, `P6-10`
- Skill: `implement-task`, `build-agent-workflow`
- ADR: [ADR-013](decisions/ADR-013-brand-kit-and-formats.md), [ADR-014](decisions/ADR-014-motion-kit-and-shot-list.md), [ADR-015](decisions/ADR-015-multi-speaker-voice.md)

Director mở task 2026-11-03 ("Làm đủ để chạy trọn"): Director muốn tự test trên web một run `what_if`, chọn model Claude Code, từ brief tới video.

File được phép:
- brief: `packages/contracts/src/api/project.ts`, `apps/api/src/routes/projects.ts`, `packages/db/src/projects.ts`, form brief trong `apps/web/src/features/projects/**`;
- duyệt kịch bản `2` có ảnh storyboard: `apps/web/src/features/script-review/**`, route API phục vụ ảnh storyboard;
- sau duyệt: `apps/worker/src/assets/**`;
- render, QA, export cho `StickStory`: `apps/worker/src/render/**`, export `./stick-story/render` của `apps/video`;
- phát preview `StickStory` trên web: `apps/video/src/player.ts`, `apps/web/src/features/preview/preview-panel.tsx` (agent thêm khi làm, ghi trong report);
- chuỗi `apps/web/src/i18n/vi.ts`; test; report; task file.

Phần còn lại của P6-11 (sửa kênh, kho hình động, chọn chế độ `creative` trên web) vẫn thuộc P6-11.

Mục tiêu: tạo brief `what_if` trên web; run viết script `2` và storyboard; màn duyệt hiện câu theo người nói và ảnh storyboard; duyệt xong thì voice đọc theo câu bằng giọng của nhân vật, render bằng `StickStory`, QA, export.

Tiêu chí nghiệm thu: script `1` và `EduVertical` không đổi; không ghi `approved` ngoài route approval; test api, web, worker đạt; một run thật do Director chạy trên web.

Kiểm tra: test api, web, worker, typecheck. **Cổng Director:** chạy migration `0004` trên DB `studio`; Director chạy run thật.

## P6-18 — Một đường hoạt hình: bỏ script `1`, bỏ chọn thể loại

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P6-17`
- Skill: `implement-task`, `build-agent-workflow`, `build-video-template`
- ADR: [ADR-013](decisions/ADR-013-brand-kit-and-formats.md) (bổ sung 2026-11-03 (2)), [ADR-014](decisions/ADR-014-motion-kit-and-shot-list.md)

Director mở task 2026-11-03 ("bỏ v1 đi, tui muốn dùng v2 thôi… ko cần chọn loại") và duyệt bổ sung (2) của ADR-013: xóa hẳn code script `1`, một gói chung `story` v1 "Hoạt hình", thời lượng 30–90 giây.

File được phép: mọi file của script `1`, `EduVertical`, `EduLight`, `caption_override` và route sửa script `1` trong `apps/**`, `packages/**`, `scripts/dev/**`; gói thể loại và brief trong contracts; migration đổi mặc định `briefs.format_id`; docs 00, 01, 02, 03, 04, 05, 07, 09, 10; report; task file. Không sửa report cũ.

Mục tiêu: mọi run mới đi script `2` và `StickStory`; brief không có ô thể loại, luôn ghi `story`; không còn code chỉ phục vụ script `1`.

Tiêu chí nghiệm thu: không còn `EduVertical`, schema script `1`, nhánh `v1` của job, route và màn sửa script `1`; brief mới ghi `format_id = story`; brief, run `what_if` cũ vẫn đọc được; test và typecheck mọi package đạt; build web đạt.

Kiểm tra: test, typecheck mọi package; build web. **Cổng Director:** chạy migration mới trên DB `studio`.

## P6-19 — Đồ vật trong motion kit

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P6-18`
- Skill: `build-video-template`, `create-motion-asset`
- ADR: [ADR-014](decisions/ADR-014-motion-kit-and-shot-list.md), [ADR-016](decisions/ADR-016-creative-mode-motion-assets.md)

Director mở task 2026-11-04 ("bổ sung thêm các vật thể mới để biểu diễn rõ hơn mà ko nhất thiết chỉ có nói"). Script `2` đã có `shots[].props` (tối đa 3 id kind `prop`) nhưng kit chưa có tài sản `prop` nào và `StickStory` chưa vẽ trường này. Nằm trong ADR-014, không đổi ADR.

File được phép: `packages/motion-kit/**` (kind `prop`, lớp đồ vật trong `StageShot`, khung, ảnh tĩnh), `apps/video/src/stick-story/**`, `apps/worker/src/render/storyboard-*` (kiểm và ảnh tĩnh storyboard), `apps/worker/src/cli/build-stick-story-props*`, `apps/worker/src/llm/script-v2-prompt*`, docs 05 mục shot và `StickStory`, report, task file.

Mục tiêu:
- Kind `prop` trong kit, hai cách đặt: `floor` (đứng trên sàn, chiếm một vị trí `left`, `center`, `right` còn trống như một người) và `air` (bay trong khung, không chiếm vị trí, tối đa một mỗi shot).
- Luật đặt chung cho render và kiểm storyboard: người cộng đồ vật `floor` không vượt `MAX_ACTORS_BY_SHOT_SIZE`; cỡ `close` không vẽ đồ vật; đồ vật thừa bị bỏ, builder ghi cảnh báo. Khung camera tính cả đồ vật để không bị mép cắt.
- Bộ đầu, dùng được cho nhiều chủ đề, không có chữ: máy chủ, máy chủ quá tải, laptop, router nhiễm mã độc, khiên bảo vệ, đồng hồ tải, hàng người xếp hàng, dòng gói tin bay.
- Prompt script `2` hướng dẫn dùng đồ vật.

Tiêu chí nghiệm thu: đồ vật là hàm thuần của frame; mỗi đồ vật có `asset.json` `approved` và vào danh mục prompt; shot có đồ vật render đúng vị trí, không chồng người, không bị mép khung cắt ở `wide`, `high`, `medium`; ảnh tĩnh từng đồ vật và một shot mẫu; test và typecheck motion-kit, video, worker đạt.

Kiểm tra: test, typecheck `packages/motion-kit`, `apps/video`, `apps/worker`; ảnh tĩnh trong report.

## P6-20 — Cổng căn chữ: kéo dài từ cuối theo năng lượng PCM

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P6-18`, ADR-012 bổ sung 2026-11-04 (Director duyệt 2026-11-04)
- Skill: `review-architecture` (trước), rồi `implement-task`, `debug-pipeline`
- ADR: [ADR-012](decisions/ADR-012-alignment-trailing-silence-gate.md), [ADR-011](decisions/ADR-011-whisper-alignment-default.md)

Director mở task 2026-11-04 ("Mở task sửa cổng") sau khi run DDoS lỗi `alignment_gate_failed` ở cảnh c3, câu l10 "Chật quá!".

- Máy căn chữ ghi từ cuối "quá" kết thúc ở 340 ms. Đo PCM: tiếng nói kéo tới khoảng 640 ms (peak -6 đến -24 dBFS), sau đó mới im dưới -40 dBFS.
- Vì vậy `durationDeltaMs` là 460 ms ở WAV câu và 470 ms ở WAV cả cảnh. Mức này vượt 400 ms nên ADR-012 không cho kiểm im lặng đuôi; 28/28 từ đều căn được.
- Câu cảm thán ngắn, từ cuối kéo dài, sẽ còn gặp. Sửa câu thoại chỉ né được từng lần.

Đổi chính sách cổng của ADR-012 (mục 5 "không sửa timestamp Whisper"). Director duyệt bổ sung 2026-11-04 ("Duyệt và làm"); review ở `reports/P6-20.md`.

File được phép: `services/tts/app/alignment/**`, `services/tts/tests/**`, `packages/contracts/src/media/tts*`, `apps/worker/src/cli/media-stage.ts` và test liên quan (`GATE_POLICY_VERSION`, fixture có version), docs 05 mục cổng, report, task file.

Mục tiêu:
- Trong service, khi `durationDeltaMs > 250`: quét PCM từ `endMs` của từ cuối, tìm điểm tiếng nói dừng thật (cửa sổ 50 ms, peak < -40 dBFS tới hết file).
- Nếu năng lượng liền mạch từ `endMs` tới điểm đó và đoạn kéo dài không quá một hằng số (đề xuất 500 ms), dời `endMs` của từ cuối tới điểm đó, rồi validate và chấm cổng như cũ (A hoặc B của ADR-012).
- Ghi rõ đã sửa: `validation.lastWordExtendedMs` và một warning. Tỷ lệ từ không đổi.
- Revalidate áp dụng cùng phép sửa, nên run đã lỗi bấm Tiếp tục là qua, không phải chạy lại Whisper.
- `GATE_POLICY_VERSION` lên `2.2.0-extend-last-word` ở service và worker.

Tiêu chí nghiệm thu:
- Test PCM tổng hợp:
  - từ cuối bị cắt sớm: được kéo dài và qua cổng;
  - tiếng nói vượt mức kéo dài tối đa: không sửa, trượt cổng;
  - có khoảng lặng giữa `endMs` và tiếng nói (có thể là từ bị sót): không sửa;
  - WAV thiếu hoặc hỏng: fail closed.
- Test ADR-012 cũ vẫn đạt.
- Revalidate artifact thật của cảnh c3 (WAV cả cảnh và WAV câu l10) qua cổng, số đo ghi trong report.
- Run DDoS bấm Tiếp tục đi qua bước Giọng và hình.

Kiểm tra: pytest `services/tts`, test và typecheck `packages/contracts`, `apps/worker`; revalidate trên artifact thật.

## P6-21 — Phụ đề dễ đọc, nhịp cắt chậm hơn, video dài hơn

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P6-19`, ADR-013 bổ sung 2026-11-09 (Director duyệt 2026-11-09)
- Skill: `build-video-template`, `implement-task`
- ADR: [ADR-013](decisions/ADR-013-brand-kit-and-formats.md), [ADR-014](decisions/ADR-014-motion-kit-and-shot-list.md)

Director yêu cầu ngày 2026-11-09 sau khi xem video DDoS:
- phụ đề khó đọc: Segoe UI cỡ 42 px, chữ nhạt trên nền mờ;
- chuyển cảnh nhanh: 20–27 cú cắt mỗi phút;
- muốn video không bị bó ở 90 giây.

Director chọn font Be Vietnam Pro, nhịp 12–18 cú cắt mỗi phút với shot tối đa 5 giây, thời lượng 30–180 giây.

File được phép: `packages/contracts/src/formats/**`, `packages/contracts/src/api/project*`, `packages/contracts/src/script/v2.test.ts`, `apps/video/src/stick-story/**`, `apps/video/src/fonts/**` (mới), `apps/video/font-licenses.json`, `apps/worker/src/render/storyboard-checks*` (số đo hộp phụ đề), test có `formatVersion` hoặc khoảng thời lượng ở `apps/**`, `apps/web/src/i18n/vi.ts`, `apps/web/src/features/projects/brief-form*`, docs 05, report, task file.

Mục tiêu:
- Gói `story` v2 (30–180 giây, 12–18 cắt mỗi phút, tối đa 5 giây) làm `DEFAULT_FORMAT`; v1 giữ để đọc dữ liệu cũ.
- Phụ đề `StickStory`:
  - Be Vietnam Pro nạp từ file trong repo;
  - chữ khoảng 58 px, đậm 700;
  - nền đậm hơn;
  - từ đang đọc được gạch chân.
- Template lên version mới.

Tiêu chí nghiệm thu:
- Brief 180 giây được nhận; 181 giây bị từ chối.
- Builder chia shot dài hơn 5 giây.
- Prompt nêu nhịp mới.
- Ảnh tĩnh phụ đề trước và sau khi đổi.
- Test và typecheck contracts, video, worker, web, api đạt.

Kiểm tra: test và typecheck các package trên; ảnh tĩnh trong report.

## Phase 7 — Tái dùng tài sản, tự tạo tài sản, giao diện mới

Kế hoạch: [14-ASSET-REUSE-AND-UI-PLAN.md](14-ASSET-REUSE-AND-UI-PLAN.md). Director duyệt kế hoạch và D1–D4 ngày 2026-11-10, và yêu cầu agent tự làm hết các phase rồi báo một lần. Mỗi task vẫn có report riêng và chờ nghiệm thu.

## P7-01 — Lọc danh mục tài sản theo brief

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P6-19`
- Skill: `build-agent-workflow`
- ADR: [ADR-017](decisions/ADR-017-auto-asset-generation.md)

File được phép:
- `apps/worker/src/llm/script-v2-prompt*`;
- `apps/worker/src/llm/asset-catalog*` (mới);
- `apps/worker/src/script/script-job*`;
- `asset.json` của `packages/motion-kit` (chỉ `tags`, `description`);
- test, report, task file.

Mục tiêu:
- Hàm chọn tài sản liên quan theo từ khóa brief, research và nhịp. Mỗi loại có trần; tài sản bắt buộc luôn có.
- Prompt `creative` nói rõ chỉ xin tài sản mới khi danh mục không có cái dùng được, tối đa 3.

Tiêu chí nghiệm thu:
- Test chọn tài sản.
- Đo số ký tự prompt trước và sau trên brief DDoS và brief giấc ngủ.

## P7-02 — Tự tạo tài sản trong bước storyboard

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P7-01`
- Skill: `build-agent-workflow`, `create-motion-asset`
- ADR: [ADR-017](decisions/ADR-017-auto-asset-generation.md), [ADR-016](decisions/ADR-016-creative-mode-motion-assets.md)

File được phép:
- `apps/worker/src/assets/generate/**` (mới);
- `apps/worker/src/render/storyboard-*`;
- `apps/worker/src/render/render-backend.ts` (bundle lại);
- `apps/worker/src/llm/claude-code-client*`;
- `packages/motion-kit/src/assets/generated.ts` (mới), `packages/motion-kit/src/assets/index.ts`;
- `packages/db/src/motion-assets*` (mới, chỉ truy vấn, không migration);
- skill `create-motion-asset` (`.claude`, `.cursor`);
- docs 04, 05, 08;
- test, report, task file.

Mục tiêu:
- Ghi `motion_asset_requests`.
- Dùng lại tài sản khớp.
- Gọi Claude Code headless.
- Kiểm AST, typecheck, render thuần.
- Lưu `candidate`, ảnh xem trước, đồng bộ `motion_assets`.
- Bundle lại. Lỗi thì dùng tài sản thay thế.

Tiêu chí nghiệm thu:
- Test với Claude giả: một đạt, một bị kiểm AST chặn.
- Một lần tạo thật một đồ vật.

## P7-03 — Duyệt tài sản ở Cổng 1

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P7-02`
- Skill: `build-agent-workflow`
- ADR: [ADR-017](decisions/ADR-017-auto-asset-generation.md)

File được phép:
- route approval script ở `apps/api`;
- `packages/db` (cập nhật trạng thái tài sản trong giao dịch approval);
- module ghi `asset.json` dùng chung;
- contracts API (phần đọc tài sản của run);
- test, report, task file.

Mục tiêu:
- Duyệt phương án N thì tài sản `candidate` của N thành `approved` (DB và `asset.json`).
- Có API đọc tài sản mới của run cho Cổng 1.

Tiêu chí nghiệm thu: test API; từ chối và yêu cầu sửa không đổi trạng thái tài sản.

## P7-04 — Giao diện nền: theme, shell, điều hướng, component

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: không
- Skill: `build-3d-scene` (phần token), `implement-task`

File được phép:
- `apps/web/**` (giữ logic gọi API sẵn có);
- `apps/web/public/assets/**` (SVG từ `docs/design/ui-kit`);
- docs 06;
- report, task file.

Mục tiêu:
- Token sáng và tối theo `ui-kit/07`; font Be Vietnam Pro.
- Topbar, sidebar, panel giám sát; ba chế độ Làm việc / Tập trung / Giám sát.
- Hash route.
- Component nền: StatusBadge, Stepper, EmptyState, ErrorPanel, ConfirmDialog, Toast, CharacterAvatar.

Tiêu chí nghiệm thu: test component; ảnh chụp sáng và tối ở 1440 và 1280.

## P7-05 — Đăng nhập, Dashboard, dự án, Brief

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P7-04`
- Skill: `implement-task`

File được phép: `apps/web/src/features/{session,home,projects,shell}/**`, `apps/web/src/i18n/vi.ts`, test, report, task file.

Mục tiêu: các màn theo prompt mục 2, dữ liệu thật.

Tiêu chí nghiệm thu: test; ảnh chụp.

## P7-06 — Màn Đang chạy

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P7-04`
- Skill: `implement-task`

File được phép: `apps/web/src/features/{run,final-review,shell}/**`, i18n, test, report, task file.

Mục tiêu:
- Stepper 7 bước, ETA khoảng, tiến độ thật.
- Ba loại lỗi: task, mất kết nối, worker tắt.
- Chạy lại; hủy có xác nhận, focus "Giữ lượt chạy".

Tiêu chí nghiệm thu: test các trạng thái; ảnh chụp bình thường và lỗi.

## P7-07 — Cổng 1 mới, có tài sản mới

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P7-04`, `P7-03`
- Skill: `implement-task`

File được phép: `apps/web/src/features/script-review/**`, i18n, test, report, task file.

Mục tiêu:
- Hai phương án, storyboard phóng to.
- Thoại theo nhân vật (tên, màu, icon); nghiên cứu có nhãn.
- Tài sản mới của từng phương án.
- Ghi chú bắt buộc, lịch sử quyết định.

Tiêu chí nghiệm thu: test; ảnh chụp.

## P7-08 — Preview, version, Cổng 2

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P7-04`
- Skill: `implement-task`

File được phép: `apps/web/src/features/{preview,final-review}/**`, i18n, test, report, task file.

Mục tiêu:
- Dòng thời gian version; bản cũ chỉ đọc; video 9:16.
- Danh sách QA; khóa duyệt có lý do; tải MP4.

Tiêu chí nghiệm thu: test; ảnh chụp.

## P7-09 — Sử dụng LLM, studio, Kho hình động, Bộ nhận diện

- Trạng thái: pending
- Ưu tiên: medium
- Phụ thuộc: `P7-04`, `P7-02`
- Skill: `build-3d-scene`, `implement-task`

File được phép:
- `apps/web/src/{features/usage,studio}/**`;
- `apps/web/src/features/library/**`, `apps/web/src/features/brand/**` (mới);
- route API đọc kho tài sản và bộ nhận diện (chỉ đọc);
- contracts, i18n, test, report, task file.

Mục tiêu:
- Usage có lọc.
- Danh sách vai trò 2D bằng robot `ui-kit`.
- Studio 3D theo token; lazy-load, dừng khi ẩn.
- Kho hình động chỉ đọc.
- Bộ nhận diện chỉ đọc; phần chưa có API mang nhãn "Sắp có".

Tiêu chí nghiệm thu: test; ảnh chụp.

## P7-10 — Playwright E2E và soát cuối

- Trạng thái: pending
- Ưu tiên: medium
- Phụ thuộc: `P7-05` đến `P7-09`
- Skill: `verify-phase`

File được phép: cấu hình và test Playwright trong `apps/web`, script chạy, docs 06, 09, report, task file. Director cho phép tải trình duyệt Playwright ngày 2026-11-10.

Mục tiêu:
- E2E luồng chính với API giả.
- Ảnh chụp sáng và tối ở 1440, 1280, tablet.
- Soát bàn phím, tương phản, giảm chuyển động.

Tiêu chí nghiệm thu: E2E đạt; checklist kế hoạch 14 mục 5.

## P7-11 — Tiến trình đếm thật và form Brief dễ viết

- Trạng thái: pending
- Ưu tiên: medium
- Phụ thuộc: `P7-06`, `P7-05`
- Skill: `implement-feature`

Director yêu cầu 2026-11-11: mỗi bước có phần trăm; "Giọng và hình" đếm động (đang hiện "cảnh 15/8" sai); ô Brief nhiều dòng, bố cục dùng hết chiều rộng.

File được phép: `apps/web/src/features/run/*`, `apps/web/src/features/projects/*`, `apps/web/src/i18n/vi.ts`, `apps/worker/src/render/storyboard-job.ts`, `packages/contracts/src/api/workflow.ts`, `packages/db/src/workflow.ts`, test và E2E liên quan.

Tiêu chí nghiệm thu: cảnh và câu lấy từ worker; storyboard đếm ảnh thật; ô Brief là textarea có bộ đếm; ảnh chụp E2E màn Brief.

## P7-12 — Minh họa khi giải thích: bong bóng nghĩ và bảng trắng

- Trạng thái: pending
- Ưu tiên: medium
- Phụ thuộc: `P6-19`
- Skill: `implement-feature`

Theo ADR-014 bổ sung 2026-11-11. File được phép: `packages/motion-kit/src/stage/*`, `packages/contracts/src/script/v2.ts`, `apps/video/src/stick-story/*`, `apps/worker/src/llm/script-v2-prompt.ts`, `apps/worker/src/render/storyboard-*`, `apps/worker/src/cli/build-stick-story-props.ts`, `apps/worker/src/assets/generate/substitute.ts`, test, docs 05.

Tiêu chí nghiệm thu: schema chặn minh họa sai (cỡ close, owner ngoài shot, không phải prop, có chữ); ảnh render thử có bong bóng và bảng không che mặt, không đè phụ đề; storyboard chụp shot có minh họa.

## P7-13 — Bộ đăng bài và hướng dẫn đăng

- Trạng thái: pending
- Ưu tiên: medium
- Phụ thuộc: `P3-06`
- Skill: `implement-feature`

Theo ADR-018. File được phép: migration `0006`, `packages/db/src/*`, `packages/contracts/src/api/publish.ts`, `apps/worker/src/publish/*`, `apps/worker/src/render/export-job.ts`, `apps/worker/src/queue/consumer.ts`, `apps/api/src/routes/publish.ts`, `apps/web/src/features/publish/*`, `apps/web/src/features/brand/*`, `apps/web/src/features/final-review/final-review-panel.tsx`, shell và route, test, E2E.

Tiêu chí nghiệm thu: export xong tạo job `publish`; artifact `publish_kit` có ô riêng cho ba mạng; phần chân có AI, nguồn, liên hệ bản quyền; nút Tạo lại; trang hướng dẫn chung; ô liên hệ ở Bộ nhận diện kênh.

## P7-14 — Thư viện âm thanh tự tạo, nhạc nền và SFX

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P6-09`
- Skill: `implement-feature`

Theo ADR-019. File được phép: `packages/audio-kit/*`, `.gitignore` (ngoại lệ WAV của audio-kit), `packages/contracts/src/script/v2.ts` (trường `music`), `apps/video/src/stick-story/*`, `apps/worker/src/cli/build-stick-story-props.ts`, `apps/worker/src/render/render-backend.ts`, `apps/worker/src/llm/script-v2-prompt.ts`, test.

Tiêu chí nghiệm thu: bốn nhạc nền và bảy SFX tạo bằng code, tất định, có sha256; nhạc lặp liền, hạ khi có lời; SFX đặt bằng luật; `StickStory` 1.5.0; render thật có nhạc và SFX.

## P7-15 — Diễn xuất tự động, máy quay, minh họa xin đồ vật, phụ đề theo cụm

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P7-12`
- Skill: `implement-feature`

Theo ADR-014 bổ sung 2026-11-12. File được phép: `packages/motion-kit/src/rig/actor.tsx`, `packages/motion-kit/src/assets/camera/*`, `packages/motion-kit/src/assets/index.ts`, `packages/motion-kit/src/index.ts`, `version.ts`, `packages/contracts/src/script/v2.ts`, `apps/worker/src/assets/generate/substitute.ts`, `storyboard-assets.ts`, `approved-script.ts`, `apps/video/src/captions/*`, prompt, test.

Tiêu chí nghiệm thu: người nghe gật đầu, người nói nghiêng đầu mà luật tay vẫn đạt; ba camera mới và luật đạo diễn máy quay; `illustration.items` nêu được `rN` ở chế độ creative, yêu cầu chưa xong thì bỏ; phụ đề ngắt theo cụm nghĩa.

## P7-16 — Sửa câu tại Cổng 1 và tự kiểm kịch bản

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P6-17`
- Skill: `implement-feature`

Theo ADR-020 mục 1, 2. File được phép: `packages/contracts/src/api/script-edit.ts`, `packages/contracts/src/script/review.ts`, `packages/db/src/script-edits.ts`, `packages/db/src/workflow.ts` (helper xóa của test), `apps/api/src/routes/script-edits.ts`, `apps/api/src/app.ts`, `apps/web/src/features/script-review/*`, prompt, i18n, test.

Tiêu chí nghiệm thu: sửa câu tạo script version mới, chép yêu cầu tài sản, không đổi trạng thái run, không ghi approval; 409 khi không chờ duyệt hoặc đã có bản mới hơn; gợi ý tự kiểm ở từng phương án.

## P7-17 — QA hình, báo việc chờ duyệt, chỉnh giao diện

- Trạng thái: pending
- Ưu tiên: medium
- Phụ thuộc: `P7-16`
- Skill: `implement-feature`

Theo ADR-020 mục 3–6. File được phép: `apps/worker/src/render/qa-job.ts`, `packages/contracts/src/workflow/asset-artifacts.ts` (mã QA), `apps/worker/src/publish/*`, `apps/worker/src/llm/research-prompt.ts`, `apps/web/src/features/{final-review,run,shell,home,usage}/*`, `apps/web/src/studio/*`, i18n, test, E2E.

Tiêu chí nghiệm thu: QA báo `visual_unsafe_area`, `visual_overlap` dạng cảnh báo; tiêu đề tab có số việc chờ và có thông báo; Cổng 2 video không bị che; panel Giám sát thu gọn được và có vai Đăng bài; chi phí dễ đọc; tên nhân vật trong bộ đăng bài đúng dấu.

## P7-18 — Thẻ tiêu đề đầu và thẻ kênh cuối video

- Trạng thái: pending
- Ưu tiên: medium
- Phụ thuộc: `P7-15`
- Skill: `implement-feature`

Theo ADR-021 mục 1.

File được phép:

- `apps/video/src/stick-story/*`;
- `apps/worker/src/cli/build-stick-story-props.ts`, `apps/worker/src/render/render-job.ts`;
- `packages/contracts/src/api/publish.ts` (tên kênh seed);
- test.

Tiêu chí nghiệm thu:

- `StickStory` 1.6.0 có `cards` tùy chọn.
- Thẻ tiêu đề ở 2,4 giây đầu. Thẻ kênh và lời mời ở 3 giây cuối; kênh chưa có tên thì thẻ chỉ có lời mời.
- Thẻ không che phụ đề.
- Có render thật để Director xem.

## P7-19 — Làm lại một phần ở Cổng 2

- Trạng thái: pending
- Ưu tiên: medium
- Phụ thuộc: `P7-18`
- Skill: `implement-feature`

Theo ADR-021 mục 2.

File được phép:

- `packages/contracts/src/api/redo.ts`, `packages/contracts/src/workflow/state-machine.ts`;
- `packages/db/src/{workflow-control,agent-jobs}.ts`;
- `apps/api/src/routes/redo.ts`;
- `apps/worker/src/{render/redo.ts,render/render-job.ts,assets/*,cli/media-stage.ts,jobs/job-support.ts,queue/*}`;
- `apps/web/src/features/final-review/*`;
- i18n, test.

Tiêu chí nghiệm thu:

- Đọc lại một cảnh, đổi nền một cảnh, tạo lại một hình, dựng lại đều đi qua job và QA, rồi về Cổng 2.
- Không ghi approval.
- Lần sau không làm mất lần trước.
- Có test luồng BullMQ.

## P7-20 — Tên kênh trước lần xuất, ảnh bìa, kho "dùng trong"

- Trạng thái: pending
- Ưu tiên: medium
- Phụ thuộc: `P7-18`
- Skill: `implement-feature`

Theo ADR-021 mục 3–5.

File được phép:

- `apps/api/src/routes/{publish,workflow-runs,artifacts,motion-assets}.ts`;
- `packages/db/src/{brand-profiles,motion-assets}.ts`;
- `packages/contracts/src/api/{publish,motion-assets}.ts`;
- `apps/worker/src/render/{export-job,render-backend}.ts`, `apps/worker/src/cli/ffprobe.ts`;
- `apps/web/src/features/{brand,library,final-review}/*`;
- i18n, test.

Tiêu chí nghiệm thu:

- Sửa được tên kênh.
- Duyệt bản cuối bị chặn khi kênh chưa có tên, ở cả web lẫn API.
- Bản xuất có ảnh bìa tải được.
- Kho lọc được theo video và "Chưa dùng".

## P7-21 — Chuẩn hóa -14 LUFS

- Trạng thái: pending
- Ưu tiên: medium
- Phụ thuộc: không
- Skill: `implement-feature`

Theo ADR-021 mục 6.

File được phép:

- `apps/worker/src/cli/loudness.ts`, `apps/worker/src/render/render-backend.ts`;
- `apps/video/src/stick-story/cached-render.ts`;
- test.

Tiêu chí nghiệm thu: preview và export ở -14 ± 1 LUFS, true peak dưới -1 dBTP, hình không mã hóa lại.

## Phase 8 — Đăng YouTube bằng một nút

Theo [ADR-031](decisions/ADR-031-youtube-upload.md). Mỗi task có report riêng; Director nghiệm thu rồi mới đổi `done`.

## P8-01 — Bộ đăng bài theo giới hạn YouTube

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: không
- Skill: `implement-feature`

Theo ADR-031 mục 5.

File được phép: `apps/worker/src/publish/publish-text.ts`, `packages/contracts/src/api/youtube.ts`, test.

Tiêu chí nghiệm thu:

- Mô tả YouTube không quá 5.000 byte UTF-8 với văn bản tiếng Việt dài; phần chân và mục "Nguồn hình ảnh" còn nguyên.
- Tiêu đề và mô tả không chứa `<` hoặc `>`.
- Thẻ không quá 500 ký tự theo cách tính của YouTube.

## P8-02 — Bảng kết nối, artifact và queue upload

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: không
- Skill: `implement-feature`

Theo ADR-031 mục 2, 4.

File được phép: `packages/db/drizzle/0008_*`, `packages/db/src/{schema/*,youtube.ts,index.ts}`, `packages/contracts/src/{api/youtube.ts,queue/*,index.ts}`, test.

Tiêu chí nghiệm thu: migration chạy được trên DB có dữ liệu; contracts kiểm hộp xác nhận và artifact `youtube_upload`.

## P8-03 — Mã hóa token và đăng nhập Google

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P8-02`
- Skill: `implement-feature`

Theo ADR-031 mục 1, 2, 6.

File được phép: `apps/api/src/routes/youtube.ts`, `apps/api/src/app.ts`, `apps/api/src/config*`, `packages/db/src/youtube.ts`, `packages/contracts/src/crypto/*`, `.env.example`, test.

Tiêu chí nghiệm thu: sai, hết hạn hoặc dùng lại `state` bị từ chối; token lưu mã hóa; log không chứa token; ngắt kết nối xóa token.

## P8-04 — Client YouTube trong worker

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P8-02`
- Skill: `implement-feature`

Theo ADR-031 mục 4.

File được phép: `apps/worker/src/youtube/*`, test.

Tiêu chí nghiệm thu: upload đứt giữa chừng thì resume; lỗi sau khúc cuối không đăng trùng; 403 hạn mức và 403 ảnh bìa ra đúng mã; chỉ gọi host trong allowlist.

## P8-05 — Job đăng và route

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P8-03`, `P8-04`
- Skill: `implement-feature`

Theo ADR-031 mục 3, 4, 6.

File được phép: `apps/worker/src/{youtube/*,main.ts,queues*}`, `apps/api/src/routes/{youtube,workflow-runs}.ts`, `packages/db/src/youtube.ts`, test.

Tiêu chí nghiệm thu: route trả 409 đúng các trường hợp của ADR; job ghi artifact `youtube_upload` có `privacyStatus` đọc lại; lỗi không đổi trạng thái run.

## P8-06 — Giao diện đăng YouTube

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P8-05`
- Skill: `implement-feature`

Theo ADR-031 mục 1, 3.

File được phép: `apps/web/src/features/{brand,final-review,youtube}/*`, `apps/web/src/i18n/vi.ts`, `apps/web/src/lib/*`, test.

Tiêu chí nghiệm thu: kết nối và ngắt kết nối ở Bộ nhận diện kênh; hộp xác nhận đếm ký tự, byte, thẻ, bắt chọn "Dành cho trẻ em"; link "Xem trên YouTube"; trang hướng dẫn cài đặt.

## P8-07 — Thử thật với kênh của Director

- Trạng thái: pending
- Ưu tiên: medium
- Phụ thuộc: `P8-06`; Director tạo dự án Google Cloud và kết nối kênh
- Skill: `implement-feature`

Tiêu chí nghiệm thu: một video riêng tư đăng thành công với đúng tiêu đề, mô tả, ảnh bìa; report có link.

## P8-08 — Màn Video: các video đã duyệt và xuất của mọi dự án

- Trạng thái: pending
- Ưu tiên: medium
- Phụ thuộc: `P8-06`; Director yêu cầu 2026-11-17
- Skill: `implement-feature`

File được phép:
- `packages/contracts/src/api/videos.ts` (mới), `packages/contracts/src/index.ts`;
- `packages/db/src/videos.ts` (mới), `packages/db/src/index.ts`;
- `apps/api/src/routes/videos.ts` (mới), `apps/api/src/app.ts`;
- `apps/web/src/features/videos/**` (mới), `apps/web/src/features/shell/app-shell.tsx`, `apps/web/src/lib/hash-route.ts`;
- i18n, test, `docs/07-API-CONTRACTS.md`, `docs/06-3D-UI-DESIGN.md`, report, task file.

Mục tiêu:
- Một màn `#/videos` liệt kê bản xuất mới nhất của mỗi lượt chạy đã xuất, ở mọi dự án, mới nhất trước.
- Mỗi thẻ: ảnh bìa, chủ đề, tên dự án, ngày xuất, khung dọc hay ngang, thời lượng, trạng thái YouTube và link (Short hoặc video thường).
- Nút tải video, tải ảnh bìa, mở dự án ở tab Duyệt cuối.
- Lọc: tất cả, chưa đăng, đã đăng; dọc, ngang. Tìm theo chủ đề hoặc tên dự án.

Ràng buộc:
- Chỉ đọc. Không duyệt, không xóa, không đăng từ màn này; đăng vẫn qua hộp xác nhận ở dự án.
- Không đổi schema DB. Khung và thời lượng đọc từ `render_props` cha của bản xuất (export → preview → render_props).
- Tải file dùng route có sẵn (`/media`, `/thumbnail`); không nhận đường dẫn từ client.

Kiểm tra:
- `pnpm --dir apps/api exec vitest run src/routes/videos.integration.test.ts`, `pnpm --dir apps/web exec vitest run src/features/videos`, typecheck các package đã sửa.

Tiêu chí nghiệm thu: màn Video hiện đúng các video đã xuất của mọi dự án, lọc và tìm hoạt động, link Short đúng, nút tải và mở dự án hoạt động.
