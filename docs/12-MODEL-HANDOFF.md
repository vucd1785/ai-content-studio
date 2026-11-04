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

### P5-03 — Template thứ hai (done 2026-10-31, Director PASS)

Director mở task và chọn kiểu: nền sáng, bố cục khác, cùng 5 slot và cùng props. Composition `EduLight` nằm trong `apps/video/src/edu-light/`. Schema tách thành `slotRenderPropsSchema(templateId)`; EduVertical không đổi. Render hồi quy fixture Redis bằng EduVertical cho PSNR `inf` so với MP4 của P1-04. Chưa nối vào workflow. Chi tiết: [reports/P5-03.md](../reports/P5-03.md).

### P2-09 — Route media (done 2026-10-31, Director PASS)

Director mở việc (quyết định 7). `GET /api/artifacts/:artifactId/media`:
- `preview`/`export` stream MP4; `render_props` stream WAV ở `audio.storageKey`.
- Key không an toàn bị chặn trước khi đọc đĩa, realpath phải nằm trong `DATA_DIR`.
- Hỗ trợ Range (206/416).

Panel preview phát `<video>` cho preview/export và gắn tiếng cho player render props khi có WAV. Phát hiện `.gitignore` (`preview/`) đã bỏ qua mã nguồn panel preview của P2-08 nên chưa từng được commit; đã thêm ngoại lệ. Api 110, web 58. Chi tiết: [reports/P2-09.md](../reports/P2-09.md).

### P2-10 — UI cổng final, hủy và resume (done 2026-10-31, Director PASS)

`apps/web/src/features/final-review/`, gắn trong trang project:
- **Panel cổng final:** phát preview mới nhất qua route media, đọc QA của đúng bản đó, ba nút decision. Nút duyệt khóa khi QA chưa đạt; server vẫn chặn bằng 409.
- **Điều khiển lượt chạy:** trạng thái run, hủy bấm hai lần, resume khi `failed` có `resume_from`.

Web 66/66. Chi tiết: [reports/P2-10.md](../reports/P2-10.md).

### P3-10 — Consumer queue llm và bắt đầu run (done 2026-10-31, Director PASS)

Quyết định 5 đã mở:
- `startWorkflowRun` và route `POST /api/projects/:projectId/workflow-runs` (route này trước đó chưa có);
- `createLlmConsumer`: BullMQ Worker queue `llm`, concurrency 1, research/script/visual, `failStuckJob` khi hết retry;
- process `worker:llm`: đọc `.env`, đối chiếu mỗi 5 s;
- nút "Bắt đầu lượt chạy" trên web.

Test dùng client giả (worker 109 + 1 skip, api 111, web 69). Lần chạy Gemini thật đầu tiên (Director nhờ, 2026-10-31): run `6ecffe78…` tới `waiting_script_approval`, 2 lời gọi `gemini-3.6-flash`, không repair, 0 approval. Chi tiết: [reports/P3-10.md](../reports/P3-10.md).

### P3-11 — Consumer queue media và render (done 2026-10-31, Director PASS)

`apps/worker/src/queue/consumer.ts` thay `llm-consumer.ts`:
- `processJob` dispatch mọi role: voice/qa ở `media`, render/export ở `render`;
- `createConsumer({ queues })` mỗi queue một Worker, concurrency 1;
- `failStuckJob` có `resume_from` đúng bước cho mọi role.

`run-worker.ts --queues=…` với các script `worker`, `worker:llm`, `worker:media`, `worker:render`. Test BullMQ thật với TTS và backend giả đi từ duyệt kịch bản tới `exported`. Worker 111 + 1 skip. **Chưa chạy TTS hay render thật qua worker** (ghi `data/`, chờ Director). Chi tiết: [reports/P3-11.md](../reports/P3-11.md).

### P2-11 — Giao diện theo 06 mới (pending, chờ Director verify, 2026-11-01)

Bố cục ba cột lần đầu đã thay bằng thiết kế 06 mới: token màu tối, font Be Vietnam Pro, thanh trên có nhãn worker, trang dự án (số liệu, "Cần bạn xử lý", mọi dự án), năm màn theo bước với `defaultTab`, studio là khối chính màn "Đang chạy", lưới so cảnh PA1/PA2, khung điện thoại ở bản cuối. Giữ ước tính `MACHINE_SPEED` và thanh tiến trình bảy bước. Chi tiết: [reports/P2-11.md](../reports/P2-11.md).

### P2-12, P3-13 → P3-16, P4-05, P5-04 (pending, chờ Director verify, 2026-11-01)

- `P2-12`: `PUT /api/workflow-runs/:runId/script` tạo version script mới do Director sửa; trình sửa trên màn duyệt.
- `P3-13`: test api, worker, db chạy trên DB `studio_test` (`db:test:prepare`), không đụng DB `studio`.
- `P3-14`: bản cuối `changes_requested` quay về `scripting` và tạo job script mới.
- `P3-15`: nhịp tim worker trong Redis, `GET /api/worker-status`.
- `P3-16`: QA cảnh báo `long_silence` đầu và cuối trên 1,2 s.
- `P4-05`: robot chibi dựng bằng code, mặt theo trạng thái, quay về camera.
- `P5-04`: `GET /api/usage/summary`, token tháng trên trang dự án.

Report từng task trong `reports/`.

### P3-12 — Chọn model theo lượt chạy (pending, chờ Director verify, 2026-11-01)

Migration 0002 (`workflow_runs.llm_model`, đã áp). `GEMINI_MODELS` trong `.env` (Director điền). `GET /api/llm-models`; bắt đầu run nhận `{ llmModel }`; worker gọi research và script bằng model của run. Suite api/worker đầy đủ chưa chạy lại vì worker của Director đang bật. Chi tiết: [reports/P3-12.md](../reports/P3-12.md).

## Checkpoint agent

Cập nhật bởi phiên tự hành ([13-AUTONOMOUS-AGENT-WORKFLOW.md](13-AUTONOMOUS-AGENT-WORKFLOW.md)). Mục này luôn là trạng thái mới nhất.

- Thời điểm: 2026-11-02, phiên tự hành thứ sáu.
- 2026-11-02: `P3-17` chạy lại đủ bằng chứng. Docker Desktop đã tắt hẳn; bật lại chỉ `postgres` + `redis`, Postgres recovery sạch. Sửa test hủy (id cảnh ghi cứng `s1`), thêm assertion lỗi run detail, thêm `apps/worker/src/render/render-progress.test.ts`. Lệnh (exit 0): contracts 84/84, db 7/7, api 116/116, worker 127/127, web 92/92, typecheck 5 package; số hàng DB `studio` không đổi. Chi tiết: [reports/P3-17.md](../reports/P3-17.md) mục 4.1 và 7.
- 2026-11-02: Director mở `P5-05` (sơ đồ `EduVertical` cắt khối thứ 4, mũi tên bị che). Đã làm: hàm `layoutDiagram` xếp dọc + làn vòng, `DiagramSlot` viết lại, version template `1.1.0`. Video 33/33, worker 127/127, typecheck exit 0, ffprobe đúng chuẩn. Chờ Director xem preview thật (khởi động lại worker). Chi tiết: [reports/P5-05.md](../reports/P5-05.md).
- 2026-11-02: Director yêu cầu soạn ADR Phase 6 (thương hiệu, dàn ba nhân vật Tí/Bit/Đậu, thể loại ngoài giáo dục, nhiều giọng, chế độ sáng tạo). Đã soạn ADR-013 đến ADR-016 trạng thái **Proposed** và mục Phase 6 (đề xuất) trong `10-IMPLEMENTATION-PLAN.md`. Director duyệt cả bốn ADR (Accepted 2026-11-02). Đã tạo task `P6-01`…`P6-13` (pending) và lưu bản phác nhân vật ở `docs/design/characters/sheet.html`. Đủ điều kiện ngay: ba spike `P6-01` (live Gemini cần Director cho phép), `P6-02` (cần container tts), `P6-03`. Quyết định còn chờ: tên nhân vật, giọng Tí/Bit, gói giải trí đầu tiên, nguồn SFX, thời lượng theo thể loại.
- 2026-11-02: `P6-03` xong phần đo, chờ Director verify ([reports/P6-03.md](../reports/P6-03.md)). Giây render/giây video: EduVertical 4,26; mức 1 4,56; mức 2 5,60; mức 3 8,58 (bỏ blur 8,17). Director chốt mức 2 mặc định (ghi vào P6-05); phần verify lệnh của P6-03 vẫn chờ. Code spike ở `apps/video/src/spikes/p6-03/`, đầu ra `data/spikes/p6-03/`. Typecheck, test video 33/33 exit 0.
- 2026-11-02: `P6-02` xong phần đo, chờ Director ([reports/P6-02.md](../reports/P6-02.md)). Căn từng câu: câu ngắn 16/20, câu vừa 20/20; đệm im lặng 2/20; căn cả cảnh hai giọng 4/4, từ đúng câu 88/89, nhanh hơn ~5×. Đề xuất đọc theo câu, căn theo cảnh: lệch chữ ADR-015, Director đã duyệt; mục Bổ sung 2026-11-02 đã thêm vào ADR-015 và khối P6-08 đã cập nhật. Container `tts` đã bật lại.
- 2026-11-02: `P6-01` xong, chờ Director ([reports/P6-01.md](../reports/P6-01.md)). Gemini 3.6-flash từ chối (400) schema lồng ≥3 tầng; cách `flat` (2 tầng) đạt; chuỗi JSON lớn làm model chạy mất kiểm soát (~$0,25). Tổng spike ~$0,27.
- 2026-11-02: Director muốn Claude Code viết kịch bản thay Gemini API (gói Pro) và yêu cầu thử worker gọi `claude -p`. Đã thêm task `P6-14` (spike), viết `apps/worker/src/spikes/p6-14/`. Agent đã cài Claude Code CLI 2.1.302 qua WinGet theo yêu cầu của Director (chữ ký Anthropic hợp lệ). Director đã đăng nhập (Pro). `P6-14` xong phần đo ([reports/P6-14.md](../reports/P6-14.md)): hai ca đạt Zod lần đầu, 33–60 s, không công cụ nào chạy ở ca chèn lệnh (Opus 5.5 bị bộ lọc an toàn chặn, tự chuyển Opus 4.8). Director duyệt "Làm adapter": ADR-007 có Bổ sung 2026-11-02 (client Claude Code).
- 2026-11-02: `P6-15` xong code, chờ Director verify ([reports/P6-15.md](../reports/P6-15.md)). Model `claude-code[:alias]` chọn theo run qua `CLAUDE_CODE_MODELS` (Director điền); lỗi `configuration_missing`/`quota_exhausted` không retry. Test: config 9, contracts 84, db 7, api 119, worker 138, web 94, typecheck 6 package, exit 0. Chưa chạy thật từ giao diện.
- 2026-11-02: Run `ba4dc84c` lỗi `alignment_gate_failed` ở cảnh s3 (Whisper gán độ dài 0 cho "code", "về"), không phải thiếu RAM. Director mở `P3-18`; xong code, chờ verify ([reports/P3-18.md](../reports/P3-18.md)). Từ độ dài 0 được cho khoảng ước lượng, tỷ lệ cổng trừ từ được sửa, policy `2.1.0-repair-zero-length`. Pytest không-integration 51 đạt, worker 138/138. Đã `docker cp` vào container `tts` (không build image); revalidate s3 thật đạt (24/26). Container `tts` từng bị OOM do agent chạy pytest nạp model song song, đã bật lại.
- 2026-11-02: Director nghiệm thu `P6-01`, `P6-02`, `P6-03` (đã `done`) và yêu cầu `P6-04`. P6-04 xong phần viết, chờ Director đọc duyệt ([reports/P6-04.md](../reports/P6-04.md)): 00–09 cập nhật theo ADR-013..016, skill mới `create-motion-asset` (`.cursor` và `.claude`), `build-video-template` sửa. 96 link tương đối, 0 hỏng. Có 4 câu hỏi mở (duyệt tài sản ghi vào repo, cạnh final → preview_rendering, số nhịp đề xuất, quyết định treo).
- 2026-11-03: Director trả lời bốn câu hỏi của P6-04 "theo đề xuất": gói giải trí đầu tiên `what_if`; giữ nhịp, 12–20/20–27 cắt/phút, DB 10–600 s; xác nhận cạnh `waiting_final_approval → preview_rendering` khi `rebuildWithAssets`; cách duyệt tài sản chốt ở P6-11. Đã ghi vào 01, 03, 04, 05, khối P6-06. Còn chờ: thời lượng `what_if`, tên chính thức ba nhân vật, giọng Tí/Bit, nguồn SFX. Director nghiệm thu P6-04 cùng ngày (`done`).
- 2026-11-03: `P6-07` xong code, chờ Director verify; migration đã chạy trên `studio` theo lời Director (4 migration, dữ liệu cũ giữ nguyên) ([reports/P6-07.md](../reports/P6-07.md)). Migration `0003_phase6_brand_formats`: bốn bảng kênh/kho, cột kênh, thể loại, chế độ có DEFAULT; seed kênh `kenh-mac-dinh` với Tí, Bit, Đậu, không giọng. Test db 14/14, api 119/119, worker 138/138. DB tạm `studio_p607_upgrade_test` còn lại.
- 2026-11-03: Director nghiệm thu `P6-07` (`done`). Bắt đầu `P6-05` theo lời Director dù phụ thuộc `P5-05` còn chờ verify (P6-05 không sửa file của P5-05).
- 2026-11-03: `P6-05` xong code, chờ Director verify ([reports/P6-05.md](../reports/P6-05.md)). Package `@studio/motion-kit` 0.1.0: rig, 6 biểu cảm, Tí/Bit/Đậu, 3 tư thế, 6 hành động, 2 bối cảnh, 2 camera, 22 manifest `candidate`. Test 19/19, typecheck pass. Ảnh tĩnh và MP4 đo chi phí ở `data/motion-kit/p6-05/`. Chờ Director duyệt đổi manifest sang `approved`.
- 2026-11-03: Director nghiệm thu `P6-05` (`done`); 22 manifest motion kit đổi sang `approved` theo lời Director. Task kế: `P6-06` chờ thời lượng `what_if`; `P6-08` chờ giọng Tí và Bit.
- 2026-11-03: Director chốt thời lượng `what_if` 30–60 s. `P6-06` xong code, chờ Director verify ([reports/P6-06.md](../reports/P6-06.md)): gói `explainer`/`what_if`, `scriptV2Schema`, `checkPacing`; `explainer` trần shot 5 s (lý do trong report). Contracts 129/129. Chờ Director cho sửa bảng gói trong 05.
- 2026-11-03: Director nghiệm thu `P6-06` (`done`), cho sửa bảng gói trong 05 (`what_if` 30–60 s, `explainer` shot dài nhất 5 s). Task kế: `P6-08` chờ giọng Tí và Bit (cổng Director); `P6-09` cần P6-08.
- 2026-11-03: Director chốt giọng: Tí "Hải Đăng", Bit "Trúc Ly" (mẫu nghe thử ở `data/voice-samples/`). Đã ghi vào `brand_characters.voice_id` của kênh `kenh-mac-dinh` trên DB `studio` theo lời Director (UPDATE 2 hàng; `dau` vẫn null).
- 2026-11-03: chạy lại test P3-17 theo lời Director: tích hợp worker 8/8, client 6/6, api 119/119, worker 138/138, web 94/94, contracts 129/129, db 14/14 ([reports/P3-17.md](../reports/P3-17.md) mục 4.2). P3-17 vẫn chờ Director verify.
- 2026-11-03: Director nghiệm thu `P3-17` (`done`). Bắt đầu `P6-08`.
- 2026-11-03: `P6-08` xong code, chờ Director verify ([reports/P6-08.md](../reports/P6-08.md)): đọc theo câu, worker ghép WAV cảnh vào `data/tts` (không đổi ADR-005), căn một lần mỗi cảnh, chia từ về câu, dự phòng theo nhóm câu, `captions[].speaker`. Worker 152/152, contracts 135/135. Thử thật 1 cảnh 3 câu hai giọng: qua cổng, 26/26 từ đúng người nói; căn mất 519 s (spike 7 s), cần theo dõi. Job voice chưa nhận script `2` (nối ở P6-10).
- 2026-11-03: Director nghiệm thu `P6-08` (`done`). Bắt đầu `P6-09`.
- 2026-11-03: `P6-09` xong code, chờ Director verify ([reports/P6-09.md](../reports/P6-09.md)): composition `StickStory` (`1.0.0+kit.0.1.0`), cache theo version kit, builder `buildStickStoryRenderProps` trong worker. Render `data/stick-story/p6-09/fixture.mp4` và `live.mp4` (audio thật P6-08): h264 1080×1920 30 fps. Video 42/42, worker 160/160. Chưa nối vào job render (P6-10).
- 2026-11-03: Director xem fixture, yêu cầu bỏ chữ phủ màn hình và khung bảng code/sơ đồ, chỉ dùng hoạt hình. Đã bỏ khỏi template và render props (`1.1.0+kit.0.1.0`), render lại. Script `2`, 05, ADR-014 vẫn có `onScreenText`/`board`: cần mục Bổ sung ADR-014 nếu bỏ hẳn khỏi script.
- 2026-11-03: Director "Bỏ, soạn bổ sung ADR". Đã soạn mục Bổ sung 2026-11-03 trong ADR-014 (trạng thái **đề xuất**, chờ Director duyệt): script `2` bỏ `onScreenText`, `board`; ý truyền bằng hoạt hình, đồ vật, chế độ creative. Chưa sửa contracts, 05, skill hay code.
- 2026-11-03: Director duyệt bổ sung ADR-014 (Accepted). Mở và làm `P6-16` ([reports/P6-16.md](../reports/P6-16.md)): contracts v2 bỏ `onScreenText`, `board`; sửa 05, skill `create-motion-asset`, ghi chú P6-10. Contracts 136/136, worker 160/160, video 43/43. Chờ Director verify.
- 2026-11-03: Director nghiệm thu `P6-09` và `P6-16` (`done`). Task kế: `P6-10` (cổng Director: lần gọi Gemini live đầu tiên; phụ thuộc P6-06, P6-07, P6-09 đã done).
- 2026-11-03: `P6-10` xong code (LLM giả, render giả), chờ Director verify ([reports/P6-10.md](../reports/P6-10.md)). Director mở rộng phạm vi 2 lần (worker cấu hình + migration `0004` enum `storyboarding`, API schema, nhãn web). Worker 180/180. Chưa gọi Gemini live (cổng), chưa chạy migration `0004` trên `studio`. Duyệt script `2` mới tới cổng: voice/render chưa nối (cần task).
- 2026-11-03: P6-10 chạy thật trên `studio_test`: Gemini 503 hai lần (không tốn token); Claude Code (`claude-opus-5-5`) một lần gọi, không repair, 82 s, 2 phương án 16–17 shot, ~23 cắt/phút, storyboard 12 ảnh, 6 cảnh báo mép khung cỡ trung hai người. Trần `maxOutputTokens` đã thêm rồi gỡ theo lời Director.
- 2026-11-03: Director "Làm đủ để chạy trọn": mở `P6-17` ([reports/P6-17.md](../reports/P6-17.md)). Brief chọn thể loại; màn duyệt kịch bản `2` có storyboard; voice theo câu bằng giọng kênh; render/QA/export `StickStory`; player web phát `StickStory`. Worker 182, api 121, web 97 test. Chờ Director cho chạy migration `0004` trên `studio` rồi tự test trên web.
- 2026-11-03: Migration `0004` đã chạy trên `studio` theo lời Director (5 migration, enum có `storyboarding`, dữ liệu không đổi). Chờ Director khởi động lại API/worker/web và tự test `what_if` trên web.
- Đã closeout (Director PASS): `P4-02`, `P5-02`, `P5-01`, `P4-03`, `P3-04`, `P2-07`, `P4-04`, `P2-08`, `P3-05`, `P3-06`, `P3-08`, `P5-03`, `P2-09`, `P2-10`, `P3-10`, `P3-11` (cùng các task trước).
- Task chờ Director verify (đã triển khai, `11-TASKS` vẫn `pending`): `P2-11`, `P2-12`, `P3-12`, `P3-13`, `P3-14`, `P3-15`, `P3-16`, `P4-05`, `P5-04`, `P5-05`, `P6-14`, `P6-15`, `P3-18`, `P6-10`, `P6-17`. Tất cả chưa commit (commit cuối `f6c5960`).
- Task đang làm: không. Không còn lỗi mở.
- Lệnh cuối đã chạy (2026-11-01, exit 0): contracts 84/84, db 7/7, api 116/116 (DB `studio_test`), worker 120/120, web 87/87, video 25/25, typecheck mọi package, build web. `biome check` sạch cho file mới; repo còn lỗi lint cũ ở file không thuộc các task này. Robot xem trên trang preview tạm qua Vite 5173 (đã xóa), console không lỗi.
- Lưu ý diff: `biome check --write apps/web/src` lỡ định dạng lại khoảng 20 file web ngoài phạm vi (chỉ xuống dòng, không đổi logic): `app.tsx`, `components/ui/*`, `usage-panel*`, `studio-store*`, `use-studio-run.ts`… Agent không được phép ghi đè để trả về HEAD; Director chọn giữ hoặc trả lại trước khi commit.
- Đủ điều kiện kế tiếp: `P2-13` sau khi `P2-11` được verify. Director chọn 2026-11-02 dùng Chrome của Remotion (`chrome-headless-shell` 157, `executablePath`), không tải trình duyệt Playwright. `P2-14` chờ Director mở.
- Quyết định chờ Director:
  1. ~~Định dạng artifact script và route đọc artifact~~: đã chốt 2026-10-31.
  2. ~~Gắn UI~~: đã làm 2026-10-31 (mục Quyết định 2 ở trên).
  3. Bảng giá cho `estimated_cost_usd`.
  4. Parse PDF cho research (dependency mới) hay giữ `pdf_not_extracted`.
  5. ~~Consumer queue `llm`~~: Director mở 2026-10-31, triển khai ở `P3-10`. Lần gọi thật đầu tiên vẫn chờ Director.
  6. ~~Cách ghi phương án được chọn~~: đã chốt `variantIndex` 2026-10-31 (mục ở trên).
  7. ~~Route media~~: Director mở 2026-10-31, triển khai ở `P2-09`.
  8. ~~Visual có gọi LLM không~~: Director chốt 2026-10-31 giữ storyboard dựng bằng code ở MVP, không gọi LLM.
  9. ~~Dàn agent 8 vai trò (Director, Planner, Script, Critic, Voice, Video, QA, Publisher)~~: Director chốt 2026-11-01:
     - Director vẫn là con người, không có "Director agent" (ADR-004: chỉ người duyệt).
     - Không thêm Planner LLM; `producer` vẫn là state machine bằng code (ADR-002).
     - Publisher (tự đăng YouTube, Facebook, TikTok) để tương lai. Khi mở cần sửa PRD, ADR mới, bảng tài khoản OAuth mã hóa, review bảo mật, và một cổng duyệt "Đăng" riêng. Đừng đề xuất lại trước khi Director mở.
     - Không thêm Reviewer/Critic: Director tự review hai phương án (chốt 2026-11-01).
- Sau lần chạy thật (2026-10-31): sửa resume qua BullMQ (đối chiếu đẩy lại bản Redis đã kết thúc) và timeout TTS 30 phút (`TTS_TIMEOUT_MS`); chi tiết mục 6 của [reports/P3-11.md](../reports/P3-11.md). Máy không có GPU NVIDIA, TTS chạy CPU (RTF khoảng 9). Chưa commit.
- Thiết kế lại giao diện (2026-11-01): Director duyệt hướng mockup 5 màn (canvas "AI Content Studio — giao diện mới") và yêu cầu viết lại quy tắc 3D. `06-3D-UI-DESIGN.md` đã viết lại: token màu, khung ứng dụng, năm màn, studio là khối chính màn "Đang chạy", ánh xạ trạng thái có màu, tooltip, khung chi tiết, chuyển động được phép. ADR-009 không đổi (thiết kế mới vẫn đúng ADR). Bố cục P2-11 (đang `pending`) sẽ làm lại theo tài liệu này.
- Nhân vật 3D anime có rig (yêu cầu 2026-11-01): **Director hoãn, tự phát triển sau.** Lý do: không có model; máy dưới cấu hình tối thiểu của VRoid Studio. Màn concept đã gỡ khỏi canvas. Thay vào đó, 06 quy định robot dựng bằng code đẹp nhất có thể: chibi, mặt màn hình có biểu cảm, toon shading, viền, phụ kiện riêng từng vai trò. ADR-009 giữ nguyên. Đừng đề xuất lại nhân vật rig trước khi Director mở.
- Director duyệt 2026-11-01 "theo tất cả đề xuất" cho 12 mục, trừ phần C bảo mật (bind cổng Docker 127.0.0.1, key Gemini trả phí): duyệt sau khi kiểm sản phẩm. Task mới: `P2-12` (sửa lời thoại), `P2-13` (Playwright), `P2-14` (timing phụ đề trên web, để Director mở), `P3-13` (DB test riêng), `P3-14` (yêu cầu sửa bản cuối), `P3-15` (heartbeat worker), `P3-16` (QA long_silence), `P4-05` (robot), `P5-04` (token tháng); khối nghiên cứu nằm trong `P2-11`. Hai thư mục mồ côi trong `data/artifacts/` đã xóa.
- Hành động kế tiếp chính xác: Director verify các task pending trên; commit khi Director yêu cầu; rồi `P2-13`. Phần C bảo mật chờ Director sau khi kiểm sản phẩm.
- Cần Director: có.
