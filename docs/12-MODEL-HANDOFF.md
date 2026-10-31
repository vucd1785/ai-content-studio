# Bàn giao giữa các model

Trạng thái công việc là Git, [11-TASKS.md](11-TASKS.md), và `reports/<task-id>.md`. Không dựa vào lịch sử chat để biết task đang tới đâu.

## Vai trò

Grok 4.7 soạn và sửa kế hoạch, ADR, Rules, Skills, và được gọi lại khi một task đụng ranh giới dưới đây.

Composer 2.5 nhận một task `pending`, triển khai, chạy kiểm tra, viết report. Composer không đổi file trong `docs/decisions/`.

## Khi đưa việc về Grok

Dừng task và viết report `blocked` khi:

- Test chỉ qua được nếu đổi state machine, schema công khai, hoặc ADR.
- Alignment hoặc render cần đổi công nghệ khỏi [05-VIDEO-PIPELINE.md](05-VIDEO-PIPELINE.md).
- Việc cần file ngoài **File được phép**.
- Chi phí một video mẫu vượt trần trong [04-AGENT-ORCHESTRATION.md](04-AGENT-ORCHESTRATION.md).
- Thay đổi chạm upload, fetch, session, hoặc đường ghi approval.

## Mẫu report

Viết `reports/<task-id>.md`:

```markdown
# <task-id>

- Objective: ...
- Status: done | blocked
- Files changed: ...
- Design decisions: chỉ những lựa chọn bên trong task
- Tests executed: lệnh và kết quả
- Verification results: đối chiếu tiêu chí nghiệm thu
- Known limitations: ...
- Remaining issues: ...
- Recommended next task: một ID
```

Đổi `Trạng thái` của task thành `done` chỉ khi mọi tiêu chí đã có bằng chứng trong report. `blocked` giữ nguyên code dở trong cây làm việc và không đánh dấu phụ thuộc là xong.

Commit chỉ khi Director yêu cầu.

## Node.js 24 (Windows, repo này)

- Store fnm: **`E:\NodeVersions`**. `.node-version`: `24`. Không dùng `fnm default 24`, không sửa `D:\nodejs`.
- Terminal tích hợp: profile **AI Studio Node 24** (`.vscode/settings.json`) chạy `scripts/dev/enter-node24.ps1`.
- **Shell Cursor Agent** thường không nạp profile terminal. Mọi lệnh `node`/`pnpm` TypeScript phải qua:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/with-node24.ps1 pnpm run typecheck
```

Hoặc `fnm --fnm-dir "E:\NodeVersions" exec --using=24 -- cmd /c "corepack pnpm ..."`. Gọi `pnpm` trực tiếp trong `fnm exec` (không qua `cmd /c corepack`) thường lỗi *program not found* trên Windows — đó là giới hạn shim PATH, không chứng minh Node 24 hỏng.

Chi tiết: `.cursor/rules/node-environment.mdc`, `README.md` mục Cài đặt.

## Tin nhắn bàn giao cho Composer

Người điều phối dán khối này khi đổi model:

```text
Làm đúng task P1-01 trong docs/11-TASKS.md.
Đọc AGENTS.md, task đó, và các ADR mà task nêu.
Skill: implement-task.
Shell Agent: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/with-node24.ps1 pnpm run typecheck
Chỉ sửa File được phép.
Không sửa docs/decisions/ (trừ khi task hoặc Director yêu cầu ADR).
Chạy mục Kiểm tra.
Viết reports/P1-01.md theo docs/12-MODEL-HANDOFF.md.
Dừng sau task này.
```

Trạng thái mới nhất: xem mục **Checkpoint agent** cuối file. `P2-04`, `P3-01`, `P2-05` đã triển khai, chờ Director verify.

### P2-03 — API project (done 2026-10-31)

`@studio/api`: `GET/POST /api/projects`, `GET/PATCH /api/projects/:projectId`, `PUT .../brief` (insert, giữ lịch sử), `POST .../references` (multipart một file `md|txt|pdf` ≤ 10 MiB, hoặc JSON `{ url, title? }` http/https không fetch), `DELETE .../references/:referenceId` (xóa hàng đúng project, giữ file). `storage_key` `uploads/<uuid>.<ext>` do server tạo, không dùng tên file client; resolve chặn `..`/NUL/`/`/`\` và realpath (cả `uploads` lẫn file) ra ngoài `DATA_DIR`; sniff `%PDF`/NUL; cleanup file khi insert lỗi. Zod camelCase trong `@studio/contracts` (`api/project.ts`), query Drizzle trong `@studio/db` (`projects.ts`), `DATA_DIR` qua `@studio/config/data-dir` (tương đối theo gốc repo). Lỗi 4xx Fastify → 400/413. Hook session/Origin P2-02 không đổi.

Composer 2.5 bị ngắt giữa chừng; Claude Opus 5.5 khôi phục, giữ code Composer, sửa 8 lỗi (xem report mục 1). Director verify PASS — test api 69/69, typecheck api/db/contracts exit 0. Không migration mới; Postgres volume và `data/` media không đổi.

**Giới hạn mang sang:** (1) HTTP 500 trả `error.code = "validation_error"` vì enum chưa có mã lỗi nội bộ — đưa vào lần rà hợp đồng API, không sửa trong task triển khai. (2) Test tích hợp chạy trên DB `studio` dùng chung với dữ liệu thật, dọn theo id; test bị kill có thể để lại hàng; `deleteProjectCascadeForTests` chưa xóa `workflow_runs` — P2-04 cần lưu ý, nên tách DB test. Chi tiết: [reports/P2-03.md](../reports/P2-03.md) mục 8–9.

### P2-02 — Session (done 2026-10-30)

`@studio/api`: Fastify 5, cookie `studio_session` HMAC-SHA256 (TTL 604800 s), `POST/GET /api/session/*`, hook 401 cho mọi `/api` khác, listen `127.0.0.1:3001`. Mật khẩu: SHA-256 + `timingSafeEqual`. `@studio/contracts` (login/session/error Zod), `@studio/config/session-env` (boot). Director verify PASS — test 35/35 api, typecheck api/contracts/config. **Giới hạn còn lại:** logout chỉ xóa cookie trình duyệt — bản copy vẫn hợp lệ đến `exp`; không CSRF token (SameSite=Lax); Origin loopback khi header có trên state-changing; thiếu Origin cho phép non-browser. **P2-03+** phải giữ hook; **P2-05** proxy cùng origin (`127.0.0.1` vs `localhost`). Chi tiết: [reports/P2-02.md](../reports/P2-02.md). Postgres volume và `data/` không reset.

### P2-01 — schema Drizzle (done 2026-10-30)

`@studio/db`: 12 bảng + 13 enum Postgres theo [03-DATABASE-DESIGN.md](03-DATABASE-DESIGN.md); migration `packages/db/drizzle/0000_concerned_northstar.sql`; `pnpm --filter @studio/db db:migrate` (idempotent). Ràng buộc đã verify: unique `jobs.idempotency_key`, enum workflow/agent/job, `approvals.decision` NOT NULL không default, `briefs.duration_sec` 30–90, index `events(workflow_run_id, id)`. Director: migrate ×2 + test 7/7 PASS. Chi tiết: [reports/P2-01.md](../reports/P2-01.md). Postgres volume và `data/` media không reset.

### P1-08 — đã xong (2026-10-30)

Override timing phụ đề word-level (`sceneId` + `wordIndex`, `startMs`/`endMs` only): schema + `applyCaptionOverride` trong `@studio/contracts`, tích hợp CLI `--caption-override` / `--props-only`. Render `contentHash` đổi khi captions đổi; cache TTS/alignment giữ (`synthesizeContentKey` theo text+voice).

Director verify: props-only với `data/caption-overrides/p1-08-verify.json` — override chấp nhận, `contentHash` khác baseline, `synthesizeReused = alignReused = 5`, không synthesize/align mới. Chi tiết và payload mẫu đã verify: [../reports/P1-08.md](../reports/P1-08.md).

### P1-07 — tham chiếu

P1-07 đã `done` kèm live smoke gemini-3.8-flash — xem [ADR-007](decisions/ADR-007-llm-adapter.md) và [../reports/P1-07.md](../reports/P1-07.md).

### P2-04 — API approval (done 2026-10-31, Director PASS)

`POST /api/workflow-runs/:runId/approvals` + `GET /api/workflow-runs/:runId` (chỉ đọc). `recordApproval` (`@studio/db`): một transaction, `FOR UPDATE` run, kiểm cổng ↔ status, artifact thuộc run và đúng loại (`script`/`preview`), insert approval, đổi status, insert `approval.recorded` (+ `workflow.transition`). Sai cổng 409 `invalid_transition`; thiếu `decision` 400. Rollback khi insert event lỗi đã test. Không đổi `agent_runs`, chưa enqueue. Test api 82/82. Chi tiết: [reports/P2-04.md](../reports/P2-04.md).

### P3-01 — Hàng đợi (done 2026-10-31, Director PASS)

BullMQ `llm`/`media`/`render`, payload `{ jobId }` (`@studio/contracts`), BullMQ job id = `jobs.id` (idempotent). `reconcileQueues` (`apps/worker/src/queue/queues.ts`) enqueue lại hàng `queued`/`running` thiếu trong Redis; entry `pnpm --filter @studio/worker queue:reconcile`. Test Redis prefix riêng. Worker 52/52. Chi tiết: [reports/P3-01.md](../reports/P3-01.md).

### P2-05 — Vỏ web (done 2026-10-31, Director PASS)

`@studio/web`: React 19, Vite 7 (`127.0.0.1:5173`, proxy `/api` → `127.0.0.1:3001`), Tailwind v4, shadcn (`button`/`input`/`label`/`card`), TanStack Query. Login tiếng Việt (lỗi theo `error.code`, không hiện message server), shell ba vùng (Dự án / Studio placeholder / Chi tiết), từ điển `src/i18n/vi.ts`. Test web 7/7, typecheck và build exit 0. Chưa kiểm tay trên trình duyệt với API thật. Chi tiết: [reports/P2-05.md](../reports/P2-05.md).

### P3-02 — State machine (done 2026-10-31, Director PASS)

`applyWorkflowCommand` thuần trong `@studio/contracts` (`workflow/state-machine.ts`): `advance`/`approval`/`fail`/`cancel`/`resume`; cạnh ra khỏi cổng duyệt chỉ qua `approval`. Test bảng đủ cặp so với sơ đồ, test nhất quán với `nextStatusAfterApproval` của P2-04. Chi tiết: [reports/P3-02.md](../reports/P3-02.md).

### P2-06 — Form brief (done 2026-10-31, Director PASS)

Web: tạo/chọn project, form brief validate bằng `briefWriteBodySchema` (sai không gửi), lỗi `validation_error` tiếng Việt, đính kèm md/txt/pdf ≤ 10 MiB (kiểm client trước khi gửi). Test web 14/14 tại thời điểm xong. Chi tiết: [reports/P2-06.md](../reports/P2-06.md).

### P4-01 — Hình studio (done 2026-10-31, Director PASS)

`apps/web/src/studio`: `StudioScene({ statuses })` fiber 9 + drei 10, camera orthographic giới hạn, 8 trạm low-poly, mặc định `idle`, không timer. **Chưa gắn vào shell** (ngoài File được phép). Chi tiết: [reports/P4-01.md](../reports/P4-01.md).

### P3-07 — SSE (done 2026-10-31, Director PASS)

`GET /api/workflow-runs/:runId/events/stream?afterId=` (`apps/api/src/routes/event-stream.ts`): phát lại `events` `id > afterId` rồi poll 1 s + notifier trong process; `Last-Event-ID` thắng query; heartbeat 15 s. **Mọi người ghi event phải qua `publishEvents(tx, rows)` / `appendEvents(db, rows)` (`@studio/db`)**: khóa run `FOR NO KEY UPDATE` để thứ tự commit = thứ tự id. Test api 94/94. Chi tiết: [reports/P3-07.md](../reports/P3-07.md).

### P3-03 — Job research (done 2026-10-31, Director PASS)

`runResearchJob(db, jobId, deps)` (`apps/worker/src/research/research-job.ts`): đọc file upload md/txt + fetch URL Director qua `safeFetch` (SSRF: allowlist host, chặn IP private/metadata mỗi hop, ghim địa chỉ, 3 redirect/15 s/1 MB), gọi `ResearchLlm` (Gemini structured, không grounding/tool), `filterResearchFacts` loại fact `verified` sai nguồn, ghi `fetch_log` + `research` vào `artifacts/<runId>/`, run → `research_ready`. Vòng đời job ở `@studio/db` `agent-jobs.ts` (`claimJob`/`completeJob`/`failJob`). **Chưa gắn BullMQ consumer** (tránh gọi Gemini có phí ngoài ý muốn). Worker 74/74. Chi tiết: [reports/P3-03.md](../reports/P3-03.md).

### P3-09 — Usage (done 2026-10-31, Director PASS)

`createMeteredClient` (`apps/worker/src/llm/metered-client.ts`) bọc client LLM: kiểm trần `6 + 2 × changes_requested` trước khi gọi, ghi một row `usage_records` mỗi response (repair cũng tính). Hết trần → `CostCeilingError` → run `failed` với `cost_ceiling`. `GET /api/workflow-runs/:runId/usage`. `estimated_cost_usd = 0` vì chưa có bảng giá. **Job LLM mới (P3-04) phải dùng client này.** Chi tiết: [reports/P3-09.md](../reports/P3-09.md).

### P4-02 — Nối trạng thái thật (done 2026-10-31, Director PASS)

`apps/web/src/studio`: `studioReducer` thuần (snapshot `agent_runs` + event SSE, bỏ event lặp theo id, thanh render chỉ khi `job.progress` có `renderedFrames` + `progress`), `useStudioRun(runId)` đọc snapshot rồi mới mở `EventSource`, `StudioLive({ runId })`. **Chưa gắn vào shell.** Web 31/31 lúc xong. Chi tiết: [reports/P4-02.md](../reports/P4-02.md).

### P5-02 — Màn usage (done 2026-10-31, Director PASS)

`apps/web/src/features/usage`: `UsagePanel({ runId })` tổng token và chi phí đã lưu (cộng micro-USD bằng bigint, không đơn giá ở client). **Chưa gắn vào trang project.** Chi tiết: [reports/P5-02.md](../reports/P5-02.md).

### P5-01 — Cache research (done 2026-10-31, Director PASS)

`researchInputHash` (nội dung brief + sha256 văn bản từng nguồn) ghi vào `agent_runs.input_hash` và `metadata.inputHash`; job research trúng cache cùng project thì không gọi provider, vẫn lọc lại fact theo fetch log mới. Worker 84/84. Chi tiết: [reports/P5-01.md](../reports/P5-01.md).

### P4-03 — Reduced motion (done 2026-10-31, Director PASS)

`apps/web/src/studio/canvas-flags.ts`: `studioCanvasFlags` (reduced motion → `dpr` 1, tắt shadow, `frameloop="demand"`; `lowPower` → `dpr` 1, tắt shadow) và `usePrefersReducedMotion` (media query, đổi theo hệ điều hành). `StudioScene` nhận thêm `reducedMotion`, `lowPower`. Web 41/41. Chi tiết: [reports/P4-03.md](../reports/P4-03.md).

### P3-04 — Job script và cổng (done 2026-10-31, Director PASS)

Director chốt quyết định 1 (2026-10-31): artifact `script` = `{ variants: [Script, Script] }` (`scriptArtifactSchema` trong contracts), route `GET /api/artifacts/:artifactId`, route approval tạo job script mới khi `changes_requested`. Research xong tạo job script `queued` cùng transaction (`completeJob.nextJob`). `runScriptJob` ghi artifact script, run `waiting_script_approval`, agent `waiting_approval`; job lượt sửa đọc note qua approval id trong key. Test: job research vẫn là một sau lượt sửa. Worker 90/90, api 100/100. Chi tiết: [reports/P3-04.md](../reports/P3-04.md).

### P2-07 — So sánh kịch bản (done 2026-10-31, Director PASS)

`apps/web/src/features/script-review`: `ScriptReviewPanel({ runId })`. Panel hiện hai phương án và ba nút decision (chỉ khi `waiting_script_approval`). Note bắt buộc khi từ chối hoặc yêu cầu sửa. Decision đã lưu đọc lại từ server. **Chưa gắn vào trang project.** Web 47/47. Chi tiết: [reports/P2-07.md](../reports/P2-07.md).

### P4-04 — Inspector (done 2026-10-31, Director PASS)

`apps/web/src/studio`: click bàn (`group name` + `onSelect`) hoặc nút 2D trong "Chọn vai trò" đều mở `RoleInspector`. `script` và `director` mở `ScriptReviewPanel`; vai trò khác chỉ hiện trạng thái. `StudioWorkspace` có nút ẩn/hiện canvas; ẩn canvas vẫn duyệt được bằng phím. **Chưa gắn vào shell.** Web 51/51. Chi tiết: [reports/P4-04.md](../reports/P4-04.md).

### Quyết định 2 — Gắn UI và dữ liệu demo (2026-10-31, Director đồng ý)

Đã gắn các màn vào giao diện:
- Vùng giữa shell hiện `StudioWorkspace` của run mới nhất (`ShellStudio`).
- Trang project có thêm `ScriptReviewPanel` và `UsagePanel`.

Nhãn studio chuyển vào `vi.studio`, để nhãn nút nằm trong từ điển như test shell của P2-05 yêu cầu. Nút vai trò chỉ ghi tên; trạng thái nằm cạnh nút.

Canvas lỗi (không WebGL, thiếu ResizeObserver) được `CanvasBoundary` thay bằng thông báo; danh sách vai trò và bảng duyệt vẫn dùng được.

Dữ liệu demo không gọi Gemini:
- `pnpm --filter @studio/worker demo:seed` tạo project `[Demo] Redis cache (seed)`, run `waiting_script_approval`, kịch bản lấy từ fixture và 2 row usage giả.
- `demo:delete` chỉ xóa project có đúng tên đó, cùng `data/artifacts/<runId>`.

Đã seed một bản vào DB `studio` và kiểm trên trình duyệt: canvas có vẽ, trạng thái lấy từ DB, bảng duyệt hiện hai phương án, usage hiện 2 lần gọi, SSE trả 200, không có lỗi console. Web 52/52, worker 91/91.

### P2-08 — Preview và version (done 2026-10-31, Director PASS)

`apps/web/src/features/preview`: `PreviewPanel({ runId })` liệt kê mọi version artifact (chỉ đọc). `render_props` phát bằng `@remotion/player` qua entry mới `@studio/video/player` (không đụng renderer). Panel lazy-load trong trang project; `StudioWorkspace` cũng lazy-load, bundle chính còn 426 kB. Worker thêm `@types/node@^24`, vì lần `pnpm install --offline` làm `safe-fetch.ts` lỗi kiểu `AbortSignal`. Seed demo có thêm render props v1/v2. Web 57/57. Player chưa có tiếng (chưa có route media). Chi tiết: [reports/P2-08.md](../reports/P2-08.md).

### Quyết định 6 — `variantIndex` khi duyệt kịch bản (2026-10-31, Director chốt)

Đã thay đổi:
- **DB:** cột `approvals.variant_index` (integer, nullable) và CHECK `approvals_variant_index_valid`. Cột chỉ nhận `1` hoặc `2`, và chỉ khi `script` + `approved`. Migration `packages/db/drizzle/0001_warm_wong.sql` chỉ thêm cột và constraint, đã áp vào DB `studio`.
- **Kiểm tra ở hai lớp:**
  - `approvalBodySchema` bắt buộc `variantIndex` khi duyệt script và cấm ở trường hợp khác;
  - `recordApproval` kiểm lại, vi phạm thì ném `invalid_variant` (route trả 400).
- **Lưu và trả về:** event `approval.recorded` và `GET` run đều mang `variantIndex`.
- **UI:** nút "Duyệt kịch bản" thay bằng "Duyệt phương án 1" / "Duyệt phương án 2"; quyết định đã lưu ghi "Đã duyệt phương án N".
- **Tài liệu:** đã cập nhật 03-DATABASE-DESIGN và 07-API-CONTRACTS.

Kết quả: contracts 84, db 7, api 101, worker 90 + 1 skip, web 57; typecheck 7 package; build web, tất cả exit 0.

### P3-05 — Visual và voice (done 2026-10-31, Director PASS)

Duyệt script tạo job `visual` (queue llm) và `voice` (queue media) cùng transaction. Hai job đọc đúng phương án qua `variantIndex` của approval. Visual ghi `storyboard` bằng code, không LLM. Voice ghi `audio` (manifest WAV) và `alignment`. `completeJob.barrier` chỉ tạo job `video` (queue render) khi cả hai xong. Test: thiếu audio thì queue render rỗng. Worker 96 + 1 skip, api 102. Chi tiết: [reports/P3-05.md](../reports/P3-05.md).

### P3-06 — Preview, QA, export (done 2026-10-31, Director PASS)

`apps/worker/src/render`:
- **Render:** job render dựng `render_props` từ storyboard + audio + alignment, render preview, rồi tạo job QA.
- **QA:** `runQaChecks` ghi `qa_report`; run sang `waiting_final_approval`.
- **Cổng final:** duyệt final cần QA của đúng preview đó đạt (`qa_not_passed` → 409), duyệt xong thì tạo job export.
- **Export:** `assertExportAllowed` chỉ cho preview mà decision final mới nhất đã duyệt; export render lại đúng props của preview.

Ffmpeg/Remotion nằm sau `RenderBackend`, test dùng backend giả. Worker 102 + 1 skip, api 103. Chi tiết: [reports/P3-06.md](../reports/P3-06.md).

### P3-08 — Hủy và resume (done 2026-10-31, Director PASS)

`packages/db/src/workflow-control.ts` + route `POST /api/workflow-runs/:runId/cancel` và `/resume`:
- **Hủy:** run, job `queued`/`running`, agent chưa xong → `cancelled`. Không ghi approval. Kết quả job đến muộn bị `completeJob` từ chối.
- **Resume:** chỉ từ `failed` có `resume_from`. Đưa job `failed` của đúng bước về `queued` (cùng key). Job đã xong không chạy lại, nên audio cũ được dùng lại.

Test: render chết sau khi có audio, resume, render chạy lại; audio vẫn hai hàng cũ, TTS gọi một lần. Worker 106 + 1 skip, api 105. Chi tiết: [reports/P3-08.md](../reports/P3-08.md).

## Checkpoint agent

Cập nhật bởi phiên tự hành ([13-AUTONOMOUS-AGENT-WORKFLOW.md](13-AUTONOMOUS-AGENT-WORKFLOW.md)). Mục này luôn là trạng thái mới nhất.

- Thời điểm: 2026-10-31, phiên tự hành thứ năm.
- Đã closeout (Director PASS): `P4-02`, `P5-02`, `P5-01`, `P4-03`, `P3-04`, `P2-07`, `P4-04`, `P2-08`, `P3-05`, `P3-06`, `P3-08` (cùng các task trước).
- Task chờ Director verify: không.
- Task đang làm: không. Không còn lỗi mở.
- Lệnh cuối đã chạy (exit 0, P3-08): worker 106 + 1 skip (seed, vì DB đang có demo), api 105/105, contracts 84/84, db 7/7; typecheck 7 package. DB `studio` còn 0 hàng test. Migration và `data/` không đổi.
- Đủ điều kiện kế tiếp: chỉ còn `P5-03` (template thứ hai), làm khi Director mở.
- Quyết định chờ Director:
  1. ~~Định dạng artifact script và route đọc artifact~~: đã chốt 2026-10-31.
  2. ~~Gắn UI~~: đã làm 2026-10-31 (mục Quyết định 2 ở trên).
  3. Bảng giá cho `estimated_cost_usd`.
  4. Parse PDF cho research (dependency mới) hay giữ `pdf_not_extracted`.
  5. Gắn BullMQ consumer cho queue `llm` (processor research + script). Đây là bước đầu tiên có thể gọi Gemini thật, nên cần cổng chi phí.
  6. ~~Cách ghi phương án được chọn~~: đã chốt `variantIndex` 2026-10-31 (mục ở trên).
  7. **Mới:** route `GET /api/artifacts/:artifactId/media` để player và màn hình phát được audio/preview. Route có trong 07-API-CONTRACTS nhưng chưa task nào sở hữu.
  8. ~~Visual có gọi LLM không~~: Director chốt 2026-10-31 giữ storyboard dựng bằng code ở MVP, không gọi LLM.
- Hành động kế tiếp chính xác: Director chọn hướng: `P5-03`, UI cổng final + nút hủy/resume (chưa có task), hoặc consumer (quyết định 5). Còn thiếu: UI cổng final, job cho `revise_assets`, và chạy thật backend render (cần consumer, quyết định 5). Quyết định 5 (consumer BullMQ, có chi phí Gemini) và 7 (route media) vẫn mở.
- Cần Director: có.
