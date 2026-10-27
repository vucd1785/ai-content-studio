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

- Trạng thái: pending
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

- Trạng thái: pending
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

- Trạng thái: pending
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

- Trạng thái: pending
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

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P0-02`, `P0-03`, `P0-04` với decision `go`
- Skill: `implement-task`

File được phép: `packages/contracts/**` hoặc module thuần trong `apps/worker` nếu `P0-01` chưa có chỗ cho hàm thuần; ưu tiên `packages/contracts` nếu hàm không cần I/O. Cộng report và task file.

Mục tiêu: hàm thuần cộng duration đã đo với đệm 200 ms mỗi đầu, đổi ra frame 30 fps.

Tiêu chí nghiệm thu: test với duration ffprobe giả lập; tổng frame không dùng số từ.

Kiểm tra: unit test của package chứa hàm.

## P1-02 — Hợp đồng media

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P0-03`, `P0-04` với decision `go`
- Skill: `implement-task`

File được phép: `services/tts/**`, client TypeScript nhỏ trong `packages/contracts` hoặc `apps/worker/src/media-client.ts`, tests, report, task file.

Mục tiêu: `POST /synthesize` và `POST /align` ổn định, trả JSON alignment theo báo cáo spike, không lộ path gốc của model.

Tiêu chí nghiệm thu: align lại đúng WAV mẫu; lỗi model trả 5xx có mã, không trả timestamp bịa.

Kiểm tra: test client với service Compose, hoặc test hợp đồng nếu service đã chạy trong `P0-04`.

## P1-03 — Captions

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P1-02`
- Skill: `implement-task`

File được phép: module map alignment sang caption, test, report, task file.

Mục tiêu: mảng tương thích `@remotion/captions`, khoảng trắng trước từ đúng quy ước Remotion.

Tiêu chí nghiệm thu: test từ thiếu bị lỗi; timestamp không đơn điệu bị lỗi; từ đầu không có space thừa làm gộp trang.

Kiểm tra: unit test.

## P1-04 — Template EduVertical

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P0-05`, `P0-02`, `P0-04` với decision `go`
- Skill: `build-video-template`

File được phép: `apps/video/**`, manifest license font, report, task file.

Mục tiêu: composition đọc `render_props` tối thiểu và vẽ năm loại slot trong [05-VIDEO-PIPELINE.md](05-VIDEO-PIPELINE.md).

Tiêu chí nghiệm thu: props mẫu về Redis render ra MP4 dọc; không gọi mạng lúc render; không import R3F.

Kiểm tra: render fixture và ffprobe.

## P1-05 — Preview và export

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P1-04`
- Skill: `build-video-template`

File được phép: `apps/video/**`, module hash props, report, task file.

Mục tiêu: hai mức CRF trong config; cùng hash và `templateVersion` thì không gọi `renderMedia()` lần hai.

Tiêu chí nghiệm thu: test dùng renderer giả đếm số lần gọi; lần hai cùng hash trả path cũ.

Kiểm tra: unit test cộng một render thật ngắn.

## P1-06 — CLI fixture

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P1-01`, `P1-03`, `P1-05`
- Skill: `implement-task`

File được phép: `apps/worker/src/cli/**`, report, task file. Được đọc package media và video, sửa chúng chỉ khi thiếu một hàm nối đã nêu trong task phụ thuộc.

Mục tiêu: một lệnh đọc `fixtures/script.edu.json`, gọi TTS, align, dựng props, render preview.

Tiêu chí nghiệm thu: không có lời gọi Gemini; QA tối thiểu ghi pass hoặc error cụ thể; MP4 1080×1920.

Kiểm tra: chạy CLI và ffprobe.

Ghi chú: đây là mốc MVP kỹ thuật nếu `P1-07` chưa chạy.

## P1-07 — Adapter Gemini

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P0-02`, `P1-06`
- Skill: `implement-task`
- ADR: [ADR-007](decisions/ADR-007-llm-adapter.md)

File được phép: `packages/config` biến model, `apps/worker/src/llm/**`, test, `.env.example` tên biến model, report, task file.

Mục tiêu: một interface structured output. Implementation Gemini. Task `script` trả đúng hai phương án. Ghi usage từ metadata response.

Tiêu chí nghiệm thu: test schema sai đi vào một lần repair rồi fail; test không repair quá một lần; lệnh `external` tùy chọn tạo một script từ brief Redis. Thiếu API key thì phần external `blocked` riêng, unit test fake vẫn phải `done` nếu pass. Trạng thái task là `done` khi fake pass và báo cáo nói rõ external đã chạy hay bị chặn vì thiếu key.

Kiểm tra: unit test adapter; external chỉ khi `GEMINI_API_KEY` có trong environment của phiên đó.

Ghi chú: không thêm OpenAI ở task này.

## P1-08 — Override phụ đề

- Trạng thái: pending
- Ưu tiên: medium
- Phụ thuộc: `P1-03`, `P1-06`
- Skill: `implement-task`

File được phép: schema override, hàm áp override, test CLI, report, task file.

Mục tiêu: file sửa `startMs` và `endMs` của một từ, render dùng bản sửa, không gọi TTS.

Tiêu chí nghiệm thu: test đếm lời gọi synthesize vẫn là số WAV cảnh, không tăng sau override.

Kiểm tra: unit test và một lần chạy CLI với override.

## P2-01 — Schema Drizzle

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P0-01`, `P1-06`
- Skill: `implement-task`
- ADR: [ADR-003](decisions/ADR-003-postgres-and-redis.md)

File được phép: `packages/db/**`, migration, report, task file.

Mục tiêu: bảng và khóa ở [03-DATABASE-DESIGN.md](03-DATABASE-DESIGN.md).

Tiêu chí nghiệm thu: migration lên được trên Postgres của Compose; unique `jobs.idempotency_key`; check hoặc enum khớp tập trạng thái đã viết.

Kiểm tra: migration trên database trống rồi chạy lại lần hai không lỗi.

## P2-02 — Session

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P2-01`
- Skill: `implement-task`

File được phép: `apps/api/src/**` session, test, report, task file.

Mục tiêu: login, logout, cookie HMAC, `401` khi chưa đăng nhập.

Tiêu chí nghiệm thu: test sai mật khẩu không nhận cookie; response và log không echo mật khẩu.

Kiểm tra: Vitest với Fastify inject.

## P2-03 — API project

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P2-02`
- Skill: `implement-task`

File được phép: route project, brief, references, test, report, task file.

Mục tiêu: các route tương ứng trong [07-API-CONTRACTS.md](07-API-CONTRACTS.md). Upload lưu `storage_key` an toàn.

Tiêu chí nghiệm thu: từ chối pdf quá giả lập vượt 10 MB; từ chối key `../`.

Kiểm tra: test API với Postgres.

## P2-04 — API approval

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P2-03`
- Skill: `implement-task`
- ADR: [ADR-004](decisions/ADR-004-human-approval.md)

File được phép: route approval và transition tối thiểu để ghi decision, test, report, task file. Chưa cần đủ mọi job agent.

Mục tiêu: ghi approval và đổi status trong một transaction theo [04-AGENT-ORCHESTRATION.md](04-AGENT-ORCHESTRATION.md).

Tiêu chí nghiệm thu: thiếu `decision` là 400; `approved` không tự sinh từ GET; decision sai cổng là `invalid_transition`.

Kiểm tra: test transaction rollback khi insert event lỗi.

## P2-05 — Vỏ web

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P2-02`
- Skill: `implement-task`

File được phép: `apps/web/**` trừ thư mục `src/studio/` nếu đã tạo. Login, layout, từ điển `vi`, TanStack Query. Report và task file.

Mục tiêu: Vite, Tailwind v4, shadcn, trang login tiếng Việt, shell ba vùng chưa có canvas 3D.

Tiêu chí nghiệm thu: login sai hiện lỗi tiếng Việt; không có chuỗi điều khiển tiếng Anh trên các nút của shell.

Kiểm tra: unit test component login nếu có, và `pnpm --filter <web> typecheck`.

Ghi chú: Playwright đầy đủ có thể gắn ở `P2-07` khi luồng duyệt tồn tại.

## P2-06 — Form brief

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P2-03`, `P2-05`
- Skill: `implement-task`

File được phép: trang project và form brief, test, report, task file.

Mục tiêu: tạo project, nhập brief, đính kèm file hợp lệ.

Tiêu chí nghiệm thu: duration ngoài 30–90 không gửi; form hiển thị lỗi từ `validation_error`.

Kiểm tra: test component hoặc Playwright của form.

## P2-07 — So sánh kịch bản

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P2-04`, `P2-06`
- Skill: `implement-task`

File được phép: UI hai phương án, nút duyệt, từ chối, yêu cầu sửa, test, report, task file.

Mục tiêu: Director gửi đúng body approval. Không có nút “chấp nhận tất cả” tự duyệt im lặng.

Tiêu chí nghiệm thu: yêu cầu sửa bắt buộc note; sau reload vẫn thấy decision đã lưu.

Kiểm tra: Playwright hoặc test API kèm component. Ghi rõ loại đã chạy.

## P2-08 — Preview và version

- Trạng thái: pending
- Ưu tiên: medium
- Phụ thuộc: `P2-07`, `P1-05`
- Skill: `implement-task`

File được phép: panel player, danh sách artifact, report, task file.

Mục tiêu: `@remotion/player` nhận props của artifact; danh sách version không ghi đè artifact cũ.

Tiêu chí nghiệm thu: player không gọi export; artifact cũ còn mở được.

Kiểm tra: test danh sách version với hai artifact.

## P3-01 — Hàng đợi

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P2-01`
- Skill: `build-agent-workflow`
- ADR: [ADR-003](decisions/ADR-003-postgres-and-redis.md)

File được phép: `apps/worker` phần queue, repository job, test, report, task file.

Mục tiêu: ba queue, payload `{ jobId }`, đối chiếu job DB với Redis lúc start.

Tiêu chí nghiệm thu: xóa job Redis của một hàng `queued` rồi khởi động worker sẽ enqueue lại đúng một lần.

Kiểm tra: test với Redis Compose.

## P3-02 — State machine

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P3-01`
- Skill: `build-agent-workflow`

File được phép: module transition thuần, test, report, task file.

Mục tiêu: đúng các cạnh trong [04-AGENT-ORCHESTRATION.md](04-AGENT-ORCHESTRATION.md), gồm cancel và resume.

Tiêu chí nghiệm thu: bảng test cho cạnh hợp lệ và cạnh bị từ chối; hàm không đọc network.

Kiểm tra: unit test.

## P3-03 — Job research

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P3-02`, `P1-07`
- Skill: `build-agent-workflow`

File được phép: job research, fetch có chặn SSRF, schema research, test, report, task file.

Mục tiêu: schema research trong tài liệu orchestration. Fact `verified` sai nguồn bị loại.

Tiêu chí nghiệm thu: test URL metadata bị từ chối; test citation lạ không thành `verified`; không dùng Search grounding.

Kiểm tra: unit test fetch và một job với LLM giả.

## P3-04 — Job script và cổng

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P3-03`, `P2-04`
- Skill: `build-agent-workflow`

File được phép: job script, nối approval, test, report, task file.

Mục tiêu: sau research, sinh hai phương án rồi dừng `waiting_script_approval`. `changes_requested` chạy lại script, không chạy lại research.

Tiêu chí nghiệm thu: test đếm job research vẫn là một sau lượt sửa script.

Kiểm tra: test worker với LLM giả và Postgres.

## P3-05 — Visual và voice

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P3-04`, `P1-02`, `P1-04`
- Skill: `build-agent-workflow`

File được phép: hai job và rào phụ thuộc, test, report, task file.

Mục tiêu: sau approval script, visual và voice chạy song song. Preview chưa chạy khi thiếu một trong hai.

Tiêu chí nghiệm thu: test thiếu audio không enqueue render.

Kiểm tra: test hàng đợi.

## P3-06 — Preview, QA, export

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P3-05`, `P1-05`, `P1-08`
- Skill: `build-agent-workflow`

File được phép: job preview, QA, export, test, report, task file.

Mục tiêu: QA tạo report; cổng final; export chỉ với approval đúng preview.

Tiêu chí nghiệm thu: approval của preview A không export được preview B.

Kiểm tra: test tích hợp worker.

## P3-07 — SSE

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P3-02`, `P2-02`
- Skill: `build-agent-workflow`

File được phép: route SSE, publisher event, test, report, task file.

Mục tiêu: `afterId` phát lại hàng đã commit, rồi event mới.

Tiêu chí nghiệm thu: test ngắt kết nối không mất hàng đã insert.

Kiểm tra: test stream Fastify.

## P3-08 — Hủy và resume

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P3-06`, `P3-07`
- Skill: `build-agent-workflow`

File được phép: cancel, resume, test, report, task file.

Mục tiêu: kill giả lập sau audio rồi resume không tạo audio mới; cancel không ghi approval.

Tiêu chí nghiệm thu: đúng hai điều trên trong test.

Kiểm tra: test tích hợp.

## P3-09 — Usage

- Trạng thái: pending
- Ưu tiên: medium
- Phụ thuộc: `P1-07`, `P3-02`
- Skill: `implement-task`

File được phép: ghi `usage_records`, API GET usage, test, report, task file.

Mục tiêu: mỗi lần gọi LLM một row token. Trần `cost_ceiling` dừng run.

Tiêu chí nghiệm thu: repair tính thêm một row; lần thứ ba không gọi provider khi trần đặt là 2 trong test.

Kiểm tra: unit test trần.

## P4-01 — Hình studio

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P2-05`
- Skill: `build-3d-scene`
- ADR: [ADR-009](decisions/ADR-009-3d-monitoring.md)

File được phép: `apps/web/src/studio/**`, report, task file.

Mục tiêu: canvas low-poly, tám vị trí, camera như [06-3D-UI-DESIGN.md](06-3D-UI-DESIGN.md). Trạng thái truyền bằng props, mặc định `idle`.

Tiêu chí nghiệm thu: không có interval tự đổi trạng thái; không import code từ `apps/video`.

Kiểm tra: typecheck và test props nếu có renderer test; không cần screenshot làm tiêu chí duy nhất.

## P4-02 — Nối trạng thái thật

- Trạng thái: pending
- Ưu tiên: high
- Phụ thuộc: `P4-01`, `P3-07`
- Skill: `build-3d-scene`

File được phép: store studio, subscriber SSE, report, task file.

Mục tiêu: avatar đọc `agent_runs`. Thanh render chỉ khi event có số frame.

Tiêu chí nghiệm thu: fixture idle một phút đồng hồ giả lập vẫn idle; event progress có frame thì đổi thanh.

Kiểm tra: unit test reducer của store.

## P4-03 — Reduced motion

- Trạng thái: pending
- Ưu tiên: medium
- Phụ thuộc: `P4-02`
- Skill: `build-3d-scene`

File được phép: cờ hiệu năng và reduced motion trong studio, test, report, task file.

Mục tiêu: `dpr` 1, tắt shadow, tắt vòng lặp khi `prefers-reduced-motion`.

Tiêu chí nghiệm thu: test cờ truyền vào canvas.

Kiểm tra: unit test.

## P4-04 — Inspector

- Trạng thái: pending
- Ưu tiên: medium
- Phụ thuộc: `P4-02`, `P2-07`
- Skill: `build-3d-scene`

File được phép: chọn role và mở panel 2D có sẵn, test, report, task file.

Mục tiêu: click avatar mở đúng panel. Phím và nút 2D vẫn duyệt được khi canvas ẩn.

Tiêu chí nghiệm thu: ẩn canvas không gỡ route duyệt.

Kiểm tra: test điều hướng panel.

## P5-01 — Cache research

- Trạng thái: pending
- Ưu tiên: medium
- Phụ thuộc: `P3-03`
- Skill: `implement-task`

File được phép: hash tài liệu đầu vào của job research, test, report, task file.

Mục tiêu: cùng brief và cùng hash reference thì tái sử dụng artifact research.

Tiêu chí nghiệm thu: provider giả không bị gọi lần hai.

Kiểm tra: unit test idempotency.

## P5-02 — Màn usage

- Trạng thái: pending
- Ưu tiên: low
- Phụ thuộc: `P3-09`, `P2-05`
- Skill: `implement-task`

File được phép: trang usage, test, report, task file.

Mục tiêu: tổng token và ước tính theo project từ `usage_records`.

Tiêu chí nghiệm thu: không hard-code đơn giá trong component; đọc số đã lưu.

Kiểm tra: test render với hai record.

## P5-03 — Template thứ hai

- Trạng thái: pending
- Ưu tiên: low
- Phụ thuộc: `P1-04`
- Skill: `build-video-template`

File được phép: template mới trong `apps/video`, report, task file.

Mục tiêu: chỉ bắt đầu khi Director chọn mở task. Giữ `EduVertical` chạy như cũ.

Tiêu chí nghiệm thu: fixture cũ vẫn render bằng template cũ.

Kiểm tra: render hồi quy fixture Redis.

Ghi chú: để `pending` cho đến khi có yêu cầu riêng. Không làm trong phiên của task khác.
