# Phase 2 — Planning review (chưa code)

Ngày: 2026-10-30. Nguồn: `docs/11-TASKS.md`, `docs/10-IMPLEMENTATION-PLAN.md`, `docs/03-DATABASE-DESIGN.md`, `docs/04-AGENT-ORCHESTRATION.md`, `docs/12-MODEL-HANDOFF.md`, ADR-003, `reports/P1-08.md`.

**Không triển khai trong phiên review này.** Chờ Director duyệt trước khi Composer làm `P2-01`.

## Phase 1 — formally complete

Mọi task `P0-*` và `P1-*` trong `docs/11-TASKS.md` là `done`.

Định nghĩa xong Phase 1 (`docs/10-IMPLEMENTATION-PLAN.md`):

| Tiêu chí | Bằng chứng |
|---|---|
| Fixture không gọi LLM vẫn ra MP4 | `P1-06` |
| Schema sai bị từ chối | `P0-02` / contracts tests |
| Sửa timestamp không gọi TTS | `P1-08` Director verify: `synthesizeReused = alignReused = 5` |
| Hash props không đổi thì không render lại | `P1-05` |
| Script thật từ Gemini | `P1-07` live `gemini-3.8-flash` PASS |

`verify-phase` (nếu Director muốn) chỉ chạy sau khi đã coi phase `done`; không bắt buộc trước `P2-01`.

## Pending còn lại (theo phụ thuộc)

Chỉ task có **mọi** phụ thuộc `done` mới được mở. Hiện **chỉ `P2-01`**.

| Task | Phụ thuộc | Mở được? |
|---|---|---|
| **P2-01** Schema Drizzle | P0-01, P1-06 done | **Có — task kế tiếp** |
| P2-02 Session | P2-01 | Không |
| P2-03 API project | P2-02 | Không |
| P2-04 API approval | P2-03 | Không |
| P2-05 Vỏ web | P2-02 | Không (song song với P2-03 **sau** P2-02) |
| P2-06 Form brief | P2-03, P2-05 | Không |
| P2-07 So sánh kịch bản | P2-04, P2-06 | Không |
| P2-08 Preview và version | P2-07, P1-05 | Không |
| P3-01 Hàng đợi | P2-01 | Không (ngay sau schema, **trước** khi cần API web) |
| P3-02 … P5-03 | chuỗi phía trên | Không |

Thứ tự gợi ý sau P2-01 (không làm trong phiên P2-01):

1. `P2-02` (session) — chặn cả API và web.
2. Song song được: `P2-03` và `P2-05` (cùng phụ thuộc P2-02). `P3-01` cũng chỉ cần P2-01; có thể xếp sau P2-02 nếu muốn giữ một luồng web trước queue. **Khuyến nghị:** `P2-02` ngay sau schema, vì Phase 2 định nghĩa là “web và duyệt”, còn queue là Phase 3.
3. Không mở `P5-03`, `P4-*`, OpenAI, S3, voice clone.

## Recommended next task

**`P2-01` — Schema Drizzle.**

Lý do: mọi task Phase 2/3 còn lại phụ thuộc bảng Postgres. `packages/db` hiện chỉ là placeholder (`typecheck` qua `tsconfig.base.json`, chưa có schema/migration). ADR-003 đã chốt Drizzle + Postgres 17; không đổi ORM.

## P2-01 — scope

**Làm**

- Drizzle schema + migration SQL khớp [docs/03-DATABASE-DESIGN.md](../docs/03-DATABASE-DESIGN.md): `projects`, `briefs`, `references`, `workflow_runs`, `agent_runs`, `jobs`, `artifacts`, `artifact_dependencies`, `approvals`, `events`, `usage_records`, `voice_profiles`.
- PK `uuid` trừ `events.id` `bigint` identity (SSE `after_id`). Thời điểm `timestamptz`.
- Unique `jobs.idempotency_key`.
- Check hoặc enum khớp tập đã viết trong tài liệu (không thêm trạng thái mới):
  - `workflow_runs.status`: `idea_submitted`, `researching`, `research_ready`, `scripting`, `waiting_script_approval`, `producing_assets`, `preview_rendering`, `qa`, `waiting_final_approval`, `exporting`, `exported`, `failed`, `cancelled` (`docs/04-AGENT-ORCHESTRATION.md`).
  - `agent_runs.role`: `producer`, `research`, `script`, `visual`, `voice`, `video`, `qa`.
  - `agent_runs.status`: `idle`, `queued`, `running`, `waiting_approval`, `completed`, `failed`, `cancelled`.
  - `jobs.queue`: `llm`, `media`, `render`.
  - `jobs.status`: tài liệu không liệt kê enum đóng. Dùng đúng các giá trị đã xuất hiện (`queued`, `running`, `completed`, `failed`, `cancelled` — `docs/02-SYSTEM-ARCHITECTURE.md`, `docs/04-AGENT-ORCHESTRATION.md`). Ghi rõ trong report. Không bịa `retrying` / `paused`.
  - `artifacts.type`, `approvals.gate`, `approvals.decision`, `events.type`, `references.kind`, `voice_profiles.kind` đúng mục database.
- `approvals.decision` không có default.
- Ràng buộc đã viết: `briefs.duration_sec` 30–90; `briefs.language` MVP `vi` có thể check `vi` hoặc để ứng dụng kiểm sau — nếu chỉ check 30–90 thì ghi trong report. `storage_key` / `references.uri` file: không chứa `..`, không bắt đầu bằng `/` nếu cột là storage key (check SQL hoặc ghi “app-layer P2-03” nếu check DB quá cứng cho URL `fetched_url` — **uri của file** là storage key; URL fetch là `uri` cùng cột. Không cấm `/` trên mọi `uri`. Chỉ cấm `..` và path tuyệt đối cho kind file, hoặc để P2-03. **P2-01:** không over-constrain URL. Check `idempotency_key` unique là bắt buộc.
- Index `(events.workflow_run_id, events.id)`.
- Migration lên Postgres Compose (`postgres:17`, DB `studio`) trên database **chưa có bảng app**, rồi chạy lại lần hai không lỗi (idempotent migrate).
- `reports/P2-01.md`, trạng thái task `done` chỉ khi kiểm tra có bằng chứng.
- Seed preset voice **không** bắt buộc trừ khi schema có hàng mẫu nhỏ và không gọi TTS. MVP “seed preset” có thể là migration data `Mai Anh` / provider VieNeu `enabled=true` nếu không cần network. Không clone.

**Không làm**

- Route HTTP, session, cookie, UI (`P2-02` trở đi).
- BullMQ, worker reconcile (`P3-01`).
- Ghi artifact pipeline vào Postgres, import WAV/alignment/script Gemini.
- Sửa `docs/decisions/`, `scriptSchema`, Gemini, TTS, Remotion, P1-08 override.
- `docker volume rm`, xóa `data/`, reset Redis.
- API xóa project.

## Blockers và rủi ro

| Rủi ro | Cách xử lý trong P2-01 |
|---|---|
| Volume Postgres đã có dữ liệu khác | Không xóa volume. Nếu DB `studio` trống bảng → migrate. Nếu đã có schema lệch → `blocked`, không DROP. |
| `jobs.status` không có enum đóng trong `03` | Tập năm giá trị ở trên; ghi trong report. Không sửa ADR. |
| `references.uri` vừa storage key vừa URL | Không check “không bắt đầu bằng `/`” cho mọi hàng. |
| Placeholder `packages/db` typecheck trỏ `tsconfig.base.json` | Đổi script typecheck của package cho đúng file schema; vẫn Node 24 qua `with-node24.ps1`. |
| Nhầm scope sang persist pipeline | CLI `data/` vẫn nguồn cho media đến khi Phase 3 nối job. |

## Tái sử dụng artifact (không xử lý lại)

P2-01 **không đọc** các thứ sau. Giữ nguyên trên đĩa:

- `data/tts/**`, `data/alignment/**`, `data/tts/content-index/**`
- `data/caption-overrides/p1-08-verify.json`
- `data/pipeline/P1-08-baseline.json`, `P1-08-props-only.json`, MP4/cache render nếu có
- Brief/script Gemini đã sinh (Redis key / file report P1-07) — không gọi lại `llm:external`

Không `docker compose down -v`.

## Milestones (một phiên Composer)

1. Đọc ADR-003, `03-DATABASE-DESIGN.md`, tập trạng thái mục trên. Liệt kê file sẽ sửa (chỉ `packages/db/**`, migration, report, `docs/11-TASKS.md`).
2. Thêm Drizzle + driver `postgres` (hoặc `pg`) và `drizzle-kit`; schema TypeScript.
3. Sinh migration; áp lên Compose Postgres lần 1 và lần 2.
4. Test hoặc script kiểm tra: unique `idempotency_key` từ chối trùng; insert `approvals.decision` null thất bại; một giá trị status lạ thất bại.
5. `reports/P2-01.md`; task `done`. Dừng. Không mở P2-02.

## Acceptance (PASS/FAIL)

| # | PASS | FAIL |
|---|---|---|
| 1 | `docker compose` Postgres healthy; migrate lần 1 tạo đủ bảng trong tài liệu | Lỗi kết nối, hoặc thiếu bảng |
| 2 | Migrate lần 2 thoát 0, không đổi schema đã áp | Lỗi “already exists” không xử lý, hoặc DROP dữ liệu |
| 3 | Hai insert cùng `jobs.idempotency_key` → lỗi unique | Insert trùng thành công |
| 4 | Status/decision ngoài tập đã ghi bị DB từ chối | Chấp nhận chuỗi tự do |
| 5 | `approvals.decision` không có default; insert thiếu decision lỗi | Cột tự thành `approved` |
| 6 | `events.id` bigint tăng; index `(workflow_run_id, id)` tồn tại | uuid hoặc không index |
| 7 | Report có lệnh và output; `docs/11-TASKS.md` P2-01 `done` | Thiếu bằng chứng |
| 8 | `data/tts`, `data/alignment`, volume Postgres không bị xóa | Volume/data media mất |

## Director verification

```powershell
Set-Location E:\Docker\ai-content-studio
docker compose up -d postgres
docker compose ps postgres
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\with-node24.ps1 pnpm --filter @studio/db exec drizzle-kit migrate
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\with-node24.ps1 pnpm --filter @studio/db exec drizzle-kit migrate
```

Tên script migrate có thể khác nếu Composer ghi trong report — **dùng đúng lệnh trong `reports/P2-01.md`**, không đoán.

Quan sát:

- Lần 1 và lần 2: exit code 0.
- `\dt` trong `psql` (user `studio`, db `studio`) thấy các bảng mục database design.
- Không có container TTS/render bắt buộc cho task này.
- `data/alignment` và `data/tts` vẫn còn file cache P1.

## Handoff cho Composer 2.5

```text
Làm đúng task P2-01 trong docs/11-TASKS.md.
Đọc AGENTS.md, task đó, ADR-003, docs/03-DATABASE-DESIGN.md, docs/04-AGENT-ORCHESTRATION.md (trạng thái workflow), docs/10-IMPLEMENTATION-PLAN.md mục Phase 2, reports/P2-phase-planning.md.
Skill: implement-task.
Shell: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/with-node24.ps1 <pnpm...>
Chỉ sửa packages/db/**, migration, reports/P2-01.md, docs/11-TASKS.md.
Không sửa docs/decisions/.
Không xóa Docker volume, data/tts, data/alignment, data/pipeline.
Không gọi TTS, Whisper, Gemini, không render MP4.
Không bắt đầu P2-02.
Migration: lần đầu trên Postgres Compose rồi chạy lại lần hai không lỗi.
Unique jobs.idempotency_key. Enum/check khớp tập đã viết trong planning (jobs.status: queued|running|completed|failed|cancelled).
Viết reports/P2-01.md theo docs/12-MODEL-HANDOFF.md.
Đổi P2-01 thành done chỉ khi tiêu chí có bằng chứng. Dừng.
```
