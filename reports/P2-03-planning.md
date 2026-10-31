# P2-03 — Kế hoạch API project (chưa code)

Ngày: 2026-10-30. Vai trò: rà kiến trúc trước khi Composer triển khai.

Nguồn: `docs/11-TASKS.md` (P2-03), `docs/07-API-CONTRACTS.md` mục Project và brief và mục Lỗi, `docs/03-DATABASE-DESIGN.md`, `docs/08-SECURITY.md` mục Upload và path, `docs/09-TEST-STRATEGY.md`, `docs/02-SYSTEM-ARCHITECTURE.md`, ADR-008, ADR-010, ADR-003, `packages/db/src/schema/index.ts`, `apps/api/src/hooks.ts`, `reports/P2-01.md`, `reports/P2-02.md`.

**Không triển khai trong phiên này.** P2-03 vẫn `pending`. Không sửa schema, migration, session, volume Postgres, `data/`, TTS, Whisper, Gemini, Remotion.

Composer chỉ bắt đầu sau khi Director chấp nhận báo cáo này, gồm danh sách file mở rộng ở mục F và các mặc định mục J.

## A. Source requirements and dependencies

### Task

| Mục | Giá trị |
|---|---|
| Trạng thái | `pending` |
| Phụ thuộc | `P2-02` (`done`, Director PASS 2026-10-30) |
| Skill | `implement-task` |
| File task ghi | route project, brief, references, test, report, task file |
| Mục tiêu | Route tương ứng trong hợp đồng API. Upload lưu `storage_key` an toàn |
| Nghiệm thu | Từ chối pdf giả lập vượt 10 MB; từ chối key `../` |
| Kiểm tra | Test API với Postgres |

P2-01 đã có bảng `projects`, `briefs`, `references`, `workflow_runs`. Check SQL `briefs.duration_sec` 30–90. `language` là `text`, không check `vi` ở DB. `references.uri` không cấm `..` ở SQL (cùng cột dùng cho URL). Check `..` và không bắt đầu bằng `/` nằm trên `artifacts.storage_key`, không trên `references.uri`.

P2-02: mọi `/api/*` trừ login, logout, `GET /api/session` đã đòi cookie hợp lệ. POST/PUT/PATCH/DELETE có `Origin` thì chỉ loopback. Thiếu `Origin` vẫn cho phép (inject/curl). **Không sửa hành vi đó.**

### Phạm vi route

Chỉ bảng **Project và brief** trong `docs/07-API-CONTRACTS.md`:

- `GET/POST /api/projects`
- `GET/PATCH /api/projects/:projectId`
- `PUT /api/projects/:projectId/brief`
- `POST /api/projects/:projectId/references`
- `DELETE /api/projects/:projectId/references/:referenceId`

Không làm workflow, approval, artifact stream, SSE (`P2-04` và phase sau). Không endpoint xóa project (`docs/03-DATABASE-DESIGN.md`: xóa project là thao tác sau).

### Điều tài liệu không ghi — chốt trong báo cáo này

- JSON camelCase hay snake_case.
- Trường của “danh sách rút gọn”.
- Phân trang, lọc, sắp xếp.
- `GET` chi tiết có trả danh sách reference hay không.
- Giới hạn độ dài `title` và các field brief dạng text.
- Prefix `storage_key` cho upload.
- DELETE có xóa file đĩa hay không.
- Sniff nội dung tối thiểu cho md/txt/pdf.

## B. API endpoint contracts

Mọi route dưới đây đi qua hook P2-02: thiếu session → `401` `unauthorized`. State-changing có `Origin` lạ → `401` “Origin không được phép.” Sai body → `400` `validation_error`, `details` không echo nội dung file hay URL dài nguyên văn. UUID sai → `400`. Id không tồn tại hoặc reference không thuộc project → `404` `not_found`.

| Method | Path | Hành vi |
|---|---|---|
| `GET` | `/api/projects` | Mọi project của studio (một Director, không lọc owner). Rút gọn: `id`, `title`, `createdAt`, `updatedAt`. Thứ tự `createdAt` giảm dần. Không query `limit`/`offset`/`q`. |
| `POST` | `/api/projects` | Body `{ title }`. Insert. `201` và object project đầy đủ (`id`, `title`, `createdAt`, `updatedAt`). |
| `GET` | `/api/projects/:projectId` | Project + `brief` mới nhất theo `created_at` hoặc `null` + `workflowRun` mới nhất theo `created_at` hoặc `null` + `references` của project (mới nhất trước). Run chỉ metadata: `id`, `status`, `createdAt`, `updatedAt`. Không tạo run. |
| `PATCH` | `/api/projects/:projectId` | Body `{ title }`. Đổi title, `updated_at = now()`. `200` object project. |
| `PUT` | `/api/projects/:projectId/brief` | Insert brief mới. Không `UPDATE` brief cũ. `201` brief vừa tạo. |
| `POST` | `/api/projects/:projectId/references` | `multipart/form-data` một file, **hoặc** JSON `{ url, title? }` (`kind = user_url`). Không fetch URL. `201` reference. |
| `DELETE` | `/api/projects/:projectId/references/:referenceId` | Xóa hàng. `204` body rỗng. File trên đĩa giữ nguyên. |

`workflowRun` đọc bảng có sẵn. Bảng trống thì `null`. Không enqueue Redis.

## C. Request/response schemas

Zod trong `packages/contracts` (`zod/v4`), camelCase JSON, thời điểm ISO-8601.

```text
projectSchema: { id: uuid, title: string, createdAt: datetime, updatedAt: datetime }
projectListSchema: { projects: projectSchema[] }
projectCreateSchema / projectPatchSchema: { title: string min 1 max 200 }
briefWriteSchema: {
  topic, audience, goal, tone, visualStyle: string min 1 max 2000
  durationSec: int 30–90
  language: literal "vi"
  notes: string max 8000 optional
}
briefSchema: briefWrite + { id, projectId, createdAt }
referenceJsonSchema: { url: http(s) URL max 2048, title?: string max 200 }
referenceSchema: {
  id, projectId, kind: "user_file" | "user_url",
  title: string | null, mediaType: string | null, byteSize: number | null, createdAt
}
```

Response reference **không** trả `uri`/`storage_key` tuyệt đối và không trả path đĩa. Client không cần key để xóa (dùng `id`).

`GET` detail:

```text
{ project, brief: briefSchema | null, workflowRun: { id, status, createdAt, updatedAt } | null, references: referenceSchema[] }
```

`kind = fetched_url` không ghi ở task này (worker research sau).

Lỗi dùng `apiErrorBodySchema` đã có: `validation_error` 400, `unauthorized` 401, `not_found` 404, `payload_too_large` 413.

## D. Database operations and transaction requirements

Query Drizzle trong `packages/db`, tham số bind. Route không nối chuỗi SQL.

| Việc | SQL |
|---|---|
| List / get project | `select` |
| Create | `insert projects` |
| Patch title | `update` title + `updated_at` |
| Brief mới nhất / run mới nhất | `order by created_at desc limit 1` |
| Put brief | `insert briefs` (lịch sử giữ nguyên) |
| List references | `select` theo `project_id` |
| Add URL | `insert` `kind=user_url`, `uri` = URL đã parse |
| Add file | `insert` `kind=user_file`, `uri` = `storage_key` tương đối |
| Delete reference | `delete` đúng `id` và `project_id` |

Một statement một việc. Không transaction nhiều bảng, trừ khi insert reference và ghi `content_hash` cùng một hàng (một insert).

File: ghi vào `DATA_DIR` **trước** insert. Insert lỗi thì xóa file vừa tạo. Delete reference **không** `unlink` (hợp đồng: file đã dùng cho artifact cũ vẫn ở đĩa; P2-03 không phân biệt được “đã dùng” vì artifact upload chưa có hàng `artifacts`).

`storage_key` do server tạo: `uploads/<uuid>.<ext>` với `ext` ∈ `md|txt|pdf`. Không dùng tên file client. Không `..`, không bắt đầu `/`, không NUL, không ký tự `\` .

`language=vi` kiểm ở Zod. `durationSec` kiểm Zod và check DB (lệch DB → 400, không 500 lộ SQL).

Không migration mới. Không cột owner.

## E. Security and validation requirements

- **Auth:** hook hiện có. Không route project trong tập miễn session. Test 401 khi không cookie.
- **Một Director:** không `owner_id`, không tenant. Mọi project hiện trên DB đều của session đã đăng nhập. Không bịa multi-user.
- **CSRF / Origin:** giữ nguyên P2-02. Không CORS mới, không CSRF token. P2-05 vẫn phải same-origin.
- **SQL injection:** Drizzle placeholder. Title chỉ là giá trị bind.
- **Upload:** chỉ `md`, `txt`, `pdf`. Dừng ở **10 × 1024 × 1024** byte lúc nhận (`413` `payload_too_large`) — kể cả pdf giả lập chỉ cần đủ lớn, không cần PDF hợp lệ nếu đã vượt trần trước khi sniff.
- **Sniff khi ≤ 10 MB:** `pdf` bắt đầu `%PDF`; `txt`/`md` từ chối NUL. Đuôi khai báo phải khớp sniff. Sai loại → `400` `validation_error`.
- **Path:** module resolve từ chối key chứa `..`, NUL, path tuyệt đối, hoặc `realpath` ra ngoài `DATA_DIR` (ADR-008, symlink). Gọi resolve **trước** mọi đọc đĩa. Upload chỉ ghi key vừa tạo, không nhận key từ client.
- **URL:** chỉ `http:`/`https:`. Không gọi mạng. Chặn SSRF thuộc task fetch sau, không thuộc POST reference.
- **Log:** không cookie, không body file, không nguyên `DATABASE_URL`.
- **DATA_DIR:** đọc từ env ở entry API (tên đã có trong `packages/config`). Thiếu thì không listen khi bật route project.

## F. Implementation scope and non-goals

### Làm

- Schema Zod mục C, route mục B, repository Drizzle, helper `storage_key` + ghi file dưới `uploads/`.
- `@fastify/multipart` (giới hạn một file, `fileSize` 10 MB). Không `@fastify/cors`.
- Test inject + Postgres Compose `studio`. Dọn hàng test (brief, reference, project) trong `afterAll`. Không `TRUNCATE` cả DB, không `docker volume rm`, không đụng `data/tts`, `data/alignment`, `data/pipeline`.
- `reports/P2-03.md`. Trạng thái task `done` chỉ khi Composer có bằng chứng và Director chưa cấm; phiên này không đổi trạng thái.

### File được sửa (mở rộng so với câu chữ task)

Rule backend: query nằm trong `packages/db`. ADR-010: Zod ở `packages/contracts`.

- `apps/api/src/**` (route, storage, nối db; không đổi thuật toán session)
- `apps/api/package.json` (multipart, phụ thuộc `@studio/db`)
- `packages/contracts/src/api/project.ts` (hoặc tương đương) + export `index.ts` + test schema
- `packages/db/src/projects.ts` (query) + export
- `packages/config` chỉ nếu cần đọc `DATA_DIR` một lần (hàm mới, không đổi session-env)
- `pnpm-lock.yaml` qua install
- `reports/P2-03.md`, `docs/11-TASKS.md` (phiên triển khai), `docs/12-MODEL-HANDOFF.md` (phiên triển khai)

### Không làm

- Sửa migration, `docs/decisions/`, `docs/03-DATABASE-DESIGN.md`.
- Đổi cookie, TTL, so mật khẩu, danh sách route miễn auth.
- Workflow, approval, SSE, fetch URL, Gemini, TTS, worker, Remotion.
- Phân trang, tìm kiếm, sắp xếp tùy chọn, xóa project, S3, user/role.
- Xóa file đĩa khi DELETE reference.
- Ghi `kind=fetched_url`.

## G. Test plan

Postgres Compose phải healthy. `DATABASE_URL` trỏ DB `studio`. Node 24 qua `scripts/with-node24.ps1`. Không skip.

| ID | Việc | Kỳ vọng |
|---|---|---|
| U1 | Resolve `uploads/../secret` và key bắt đầu `/` | từ chối, không đọc đĩa |
| U2 | Key NUL | từ chối |
| U3 | Sniff pdf không có `%PDF` | từ chối |
| U4 | Buffer pdf giả > 10 MB | từ chối trước khi ghi `data/` |
| I1 | `GET /api/projects` không cookie | 401 |
| I2 | POST project + GET list | 201, list có title |
| I3 | GET id lạ | 404 |
| I4 | PATCH title | 200, title mới |
| I5 | PUT brief `durationSec` 10 hoặc `language` `en` | 400, không hàng mới |
| I6 | PUT brief hợp lệ hai lần | hai hàng; GET trả brief sau |
| I7 | POST file `../` trong filename | 201 nhưng `uri` DB không chứa `..` (server tự đặt key) |
| I8 | POST pdf > 10 MB | 413, không file mới dưới `uploads/` |
| I9 | POST txt hợp lệ | hàng `user_file`, file nằm trong `DATA_DIR/uploads` |
| I10 | POST JSON url `https://example.com/a` | `user_url`, không HTTP outbound (không mock server nhận request — test không gọi `fetch`) |
| I11 | DELETE reference | 204; file upload của I9 vẫn còn |
| I12 | DELETE reference project khác | 404 |
| I13 | POST project `Origin: https://evil.example` | 401, không insert |

## H. Director verification with PASS/FAIL criteria

```powershell
Set-Location E:\Docker\ai-content-studio
docker compose up -d postgres
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\with-node24.ps1 pnpm --filter @studio/api test
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\with-node24.ps1 pnpm --filter @studio/api typecheck
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\with-node24.ps1 pnpm --filter @studio/db typecheck
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\with-node24.ps1 pnpm --filter @studio/contracts typecheck
```

| # | PASS | FAIL |
|---|---|---|
| 1 | Test API thoát 0; I8 từ chối pdf > 10 MB | File vượt trần được lưu |
| 2 | U1 từ chối key `..` trước khi đọc | Key `..` resolve được |
| 3 | I1 401 khi chưa đăng nhập | List project không cookie trả 200 |
| 4 | I6 hai brief; GET là bản mới; bản cũ còn trong DB | PUT ghi đè brief cũ |
| 5 | I11 xóa hàng, file còn | DELETE xóa WAV/MP4 cache hoặc file upload |
| 6 | Không migration mới; `docker volume rm` không chạy | Schema đổi hoặc volume mất |
| 7 | `data/tts`, `data/alignment` còn | Cache media mất |
| 8 | Report có lệnh và output | Thiếu bằng chứng |

Không in `DATABASE_URL` có mật khẩu khác mặc định local vào report. Mật khẩu Compose `studio` đã nằm trong `docker-compose.yml`.

## I. Ready-to-use Composer 2.5 implementation prompt

Chỉ dán sau khi Director duyệt `reports/P2-03-planning.md`.

```text
Làm đúng task P2-03 trong docs/11-TASKS.md.
Đọc AGENTS.md, khối P2-03, docs/07-API-CONTRACTS.md mục Project và brief và mục Lỗi, docs/03-DATABASE-DESIGN.md, docs/08-SECURITY.md mục Upload, ADR-008, ADR-010, reports/P2-02.md (hook session), reports/P2-03-planning.md.
Skill: implement-task.
Shell: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/with-node24.ps1 <pnpm...>

Chỉ các route project, brief, references trong planning mục B. Zod camelCase mục C. Query Drizzle trong packages/db. storage_key uploads/<uuid>.<ext> do server tạo. Pdf/txt/md, trần 10 MiB, sniff %PDF và từ chối NUL. DELETE reference không unlink. Không fetch URL. Không sửa hook session, cookie, schema Postgres, migration.

File: apps/api (route + multipart + storage), packages/contracts schema project, packages/db query project, reports/P2-03.md, docs/11-TASKS.md, docs/12-MODEL-HANDOFF.md, pnpm-lock.yaml qua install.
Không sửa docs/decisions/, packages/db/drizzle, worker, TTS, data/tts, data/alignment.
Không docker volume rm. Test dọn đúng hàng mình tạo.
Không bắt đầu P2-04 hay P2-05.

Kiểm tra: bảng U1–U4 và I1–I13 trong reports/P2-03-planning.md, Postgres Compose. Không skip.
Viết reports/P2-03.md theo docs/12-MODEL-HANDOFF.md.
Đổi P2-03 thành done chỉ khi tiêu chí có bằng chứng. Dừng.
```

## J. Open questions or blockers

Không blocker schema. P2-02 đã chặn route mới khi thiếu cookie.

Các mặc định sau là quyết định của bản kế hoạch. Director đổi trước khi dán prompt nếu không đồng ý:

1. **GET detail kèm `references`.** Hợp đồng chỉ nói project, brief mới nhất, run mới nhất. Thêm mảng reference để UI có `id` cho DELETE. Không thêm route list riêng.
2. **Danh sách không phân trang**, sort `createdAt` desc, field rút gọn mục B.
3. **Title tối đa 200 ký tự**; text brief tối đa 2000; `notes` 8000.
4. **Upload dưới `DATA_DIR/uploads/`.** Không ghi vào cây TTS/alignment.
5. **DELETE không xóa file.**
6. **POST tạo project trả 201** (hợp đồng không ghi mã thành công).

Nếu Director bỏ (1), Composer không nhét reference vào GET và cần route list khác — khi đó dừng và hỏi, không tự thêm route ngoài mục B.

Không có câu hỏi multi-user: kiến trúc là một Director, không cột owner.
