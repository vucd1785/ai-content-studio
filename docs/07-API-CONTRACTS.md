# Hợp đồng API

API là Fastify, prefix `/api`, JSON UTF-8. Schema request và response dùng Zod từ `packages/contracts` qua `@fastify/type-provider-zod`. Chi tiết cột nằm ở [03-DATABASE-DESIGN.md](03-DATABASE-DESIGN.md).

## Session

Một Director. Cookie `studio_session` là `HttpOnly`, `SameSite=Lax`, ký HMAC bằng `STUDIO_SESSION_SECRET`. Không dùng thư viện auth riêng ở MVP.

| Method | Path | Việc |
|---|---|---|
| `POST` | `/api/session/login` | Body `{ password }`. Băm SHA-256 mật khẩu gửi lên và SHA-256 của `STUDIO_PASSWORD`, rồi so bằng `timingSafeEqual`. |
| `POST` | `/api/session/logout` | Xóa cookie. |
| `GET` | `/api/session` | `{ authenticated: boolean }`. |

Mọi route còn lại trả `401` với code `unauthorized` khi thiếu session.

## Project và brief

| Method | Path | Việc |
|---|---|---|
| `GET` | `/api/projects` | Danh sách rút gọn, mỗi dòng có `latestRun { id, status, updatedAt }` hoặc null (P2-11). |
| `POST` | `/api/projects` | Body `{ title }`. |
| `GET` | `/api/projects/:projectId` | Project, brief mới nhất, run mới nhất. |
| `PATCH` | `/api/projects/:projectId` | Đổi `title`. |
| `PUT` | `/api/projects/:projectId/brief` | Tạo brief mới, không sửa lịch sử brief cũ. |
| `POST` | `/api/projects/:projectId/references` | Multipart một file, hoặc JSON `{ url, title }` cho URL Director cung cấp. |
| `DELETE` | `/api/projects/:projectId/references/:referenceId` | Gỡ tham chiếu khỏi project. File đã dùng trong artifact cũ vẫn nằm trên đĩa. |

Brief: `topic`, `audience`, `goal`, `durationSec`, `language`, `tone`, `visualStyle`, `notes`. `language` chỉ nhận `vi` ở MVP. `durationSec` là số nguyên 30–90.

Phase 6 (P6-07, P6-11; [ADR-013](decisions/ADR-013-brand-kit-and-formats.md)):

- Brief trả `formatId`, `formatVersion`. Client không gửi thể loại (ADR-013 bổ sung (2) 2026-11-03): server luôn ghi `story` v1, trường `formatId` client gửi bị bỏ qua. `durationSec` kiểm theo gói `story` (30–90); ngoài khoảng là `validation_error`. Brief cũ trả gói đã lưu (`explainer`, `what_if`).
- `POST /api/projects` nhận thêm `brandProfileId` tùy chọn; không có thì dùng kênh mặc định. Project trả `brandProfileId`.

File nhận `md`, `txt`, `pdf`, tối đa 10 MB.

## Workflow và approval

| Method | Path | Việc |
|---|---|---|
| `POST` | `/api/projects/:projectId/workflow-runs` | Tạo run từ brief mới nhất, status `idea_submitted`, enqueue research khi orchestration đã có. |
| `GET` | `/api/workflow-runs/:runId` | Run, agent, approval, artifact id. |
| `POST` | `/api/workflow-runs/:runId/cancel` | Hủy nếu chưa `exported`. |
| `POST` | `/api/workflow-runs/:runId/resume` | Chỉ khi `failed` và `resume_from` có giá trị. |
| `POST` | `/api/workflow-runs/:runId/approvals` | Body bên dưới. |
| `GET` | `/api/workflow-runs/:runId/artifacts` | Metadata, không nhét nhị phân. |
| `GET` | `/api/artifacts/:artifactId` | JSON artifact hoặc metadata media. |
| `GET` | `/api/artifacts/:artifactId/media` | Stream file sau khi resolve `storage_key` trong volume. |
| `GET` | `/api/workflow-runs/:runId/usage` | Các `usage_records`. |
| `GET` | `/api/usage/summary?from=&to=` | Tổng token và số lượt gọi trong khoảng thời gian ISO (P5-04). |
| `GET` | `/api/worker-status` | `{ alive, queues, lastSeenAt }` từ nhịp tim worker trong Redis (P3-15). |
| `GET` | `/api/llm-models` | Model Director chọn được khi bắt đầu run (P3-12). |

`GET /api/artifacts/:artifactId/media` (P2-09) chỉ đọc. `preview` và `export` stream MP4 ở `storage_key`; `render_props` stream WAV ở `audio.storageKey` trong props. Artifact khác (kể cả `audio`, vốn là manifest JSON nhiều WAV) là `not_found`. Chỉ phục vụ `.mp4` (`video/mp4`) và `.wav` (`audio/wav`). Header `Range` một khoảng trả `206`; khoảng ngoài file trả `416`. Key thoát volume hay file thiếu đều là `not_found`.

`POST /api/projects/:projectId/workflow-runs` (P3-10) tạo run `idea_submitted` từ brief mới nhất cùng job research (queue `llm`, key `research:<runId>`) trong một transaction, trả `201 { workflowRun }`. Body tùy chọn `{ llmModel }` (P3-12): model phải nằm trong `GET /api/llm-models`, sai là `validation_error`; không có body là model mặc định.

`GET /api/llm-models` (P3-12) trả `{ defaultModel, models }` đọc từ `GEMINI_MODEL_SCRIPT` và `GEMINI_MODELS` (phân cách bằng dấu phẩy) của server, không lộ key. P6-15: có `CLAUDE_CODE_MODELS` thì nối thêm các model `claude-code…` (ADR-007, bổ sung 2026-11-02); không có `GEMINI_API_KEY` thì chỉ liệt kê Claude Code, mặc định là model đầu và được ghi lên run. `workflowRun` có thêm `llmModel` (null là mặc định); `agentRuns[]` trong `GET /api/workflow-runs/:runId` có thêm `startedAt`, `finishedAt`. Project chưa có brief, hoặc run mới nhất chưa ở `exported`/`cancelled`/`failed`, trả `409 conflict`.

Phase 6: body `POST /api/projects/:projectId/workflow-runs` nhận thêm `creativeMode` (`standard` mặc định, hoặc `creative`); `workflowRun` trả `creativeMode`. Kênh có nhân vật nói chưa có giọng thì vẫn tạo run được; voice job sẽ trượt với `configuration_missing` (05-VIDEO-PIPELINE, mục TTS).

Route `PUT /api/workflow-runs/:runId/script` của script `1` (P2-12) đã xóa (ADR-013 bổ sung (2) 2026-11-03); gọi route này trả 404. Mô tả cũ để tham chiếu: route nhận `{ baseArtifactId, variantIndex, scenes: [{ id, onScreenText, narration }] }`. `onScreenText` tối đa 120 ký tự, `narration` tối đa 600. Server thay đúng cảnh theo `id` trong phương án đó, kiểm lại bằng `scriptArtifactSchema`, tạo artifact `script` version mới (metadata `editedBy: "director"`, dependency về bản gốc), trả `201 { artifact: { id, version } }`. Bản cũ giữ nguyên, không ghi approval. Run không ở `waiting_script_approval` là `invalid_transition`; `baseArtifactId` không phải script mới nhất là `conflict`; cảnh không có trong phương án là `validation_error`.

Phase 6, script `2` (P6-11, chưa làm): route sửa nhận `{ baseArtifactId, variantIndex, lines: [{ id, speaker, text }] }`. Server thay đúng câu theo `id`, không thêm hay xóa câu, không sửa shot list. `speaker` phải là nhân vật nói của kênh hoặc `narrator` khi gói cho phép. Kiểm lại bằng `scriptV2Schema` dựng từ kênh và kho; các lỗi còn lại như mô tả route cũ ở trên (`invalid_transition`, `conflict`, `validation_error`). Sửa câu làm bẩn storyboard của phương án đó; storyboard dựng lại khi Director duyệt (04-AGENT-ORCHESTRATION, bảng làm bẩn).

Body approval:

```json
{
  "gate": "script",
  "decision": "approved",
  "artifactId": "uuid",
  "variantIndex": 1,
  "note": "Rút ngắn cảnh 2"
}
```

`gate` là `script` hoặc `final`. `decision` là `approved`, `rejected`, hoặc `changes_requested`. Thiếu field là `validation_error`.

`changes_requested` và `rejected` bắt buộc `note` dài 1–2000 ký tự. `approved` được để `note` rỗng.

Phase 6: `gate = final`, `decision = changes_requested` nhận thêm `rebuildWithAssets: true` chỉ ở run `creative` khi mọi `motion_asset_requests` của run đã `fulfilled` hoặc `dismissed`; run chuyển `preview_rendering` thay vì `scripting` ([ADR-016](decisions/ADR-016-creative-mode-motion-assets.md)). Sai điều kiện là `invalid_transition`. `note` vẫn bắt buộc.

`variantIndex` (`1` hoặc `2`) là phương án được dựng. Bắt buộc khi `gate = script` và `decision = approved`; có ở trường hợp khác là `validation_error`. Response và `GET /api/workflow-runs/:runId` trả `variantIndex` (null khi không có).

## Kênh, thể loại, kho hình động (Phase 6)

Task P6-07 (đọc), P6-11 (giao diện, ghi). Nguồn: [ADR-013](decisions/ADR-013-brand-kit-and-formats.md), [ADR-015](decisions/ADR-015-multi-speaker-voice.md), [ADR-016](decisions/ADR-016-creative-mode-motion-assets.md).

| Method | Path | Việc |
|---|---|---|
| `GET` | `/api/brand-profiles` | Danh sách kênh `{ id, slug, displayName, isDefault }`. |
| `GET` | `/api/brand-profiles/:brandProfileId` | Kênh đầy đủ kèm `characters[]` (theo `sort_order`). |
| `PATCH` | `/api/brand-profiles/:brandProfileId` | Sửa `displayName`, `palette`, `fonts`, `toneRules`, `narratorVoiceId`. |
| `PATCH` | `/api/brand-profiles/:brandProfileId/characters/:characterKey` | Sửa `displayName`, `personality`, `catchphrases`, `voiceId`. Không đổi `characterKey`, `speaks`, `skinAssetId` qua API. |
| `GET` | `/api/tts-voices` | Danh sách giọng service TTS trả về `{ id, displayName }`; nguồn duy nhất cho mọi ô chọn giọng. |
| `GET` | `/api/formats` | Gói thể loại hiện hành `{ id, version, displayName, durationSec, research, allowNarrator }`. |
| `GET` | `/api/motion-assets?kind=&brandProfileId=&status=` | Hàng `motion_assets`, có `previewUrl` nếu có ảnh. |
| `POST` | `/api/motion-assets/:assetId/approve` | Đổi `candidate` → `approved` (cách ghi về manifest chốt ở P6-11). |
| `GET` | `/api/workflow-runs/:runId/asset-requests` | Các `motion_asset_requests` của run. |
| `POST` | `/api/asset-requests/:requestId/dismiss` | Đổi `open` → `dismissed`, body `{ note }`. |

- `voiceId` phải có trong `GET /api/tts-voices` lúc ghi, sai là `validation_error`; `voiceId` của nhân vật `speaks = false` là `validation_error`. Seed không có giọng; chỉ Director gán.
- Duyệt tài sản và bỏ yêu cầu không ghi `approvals`, không đổi `workflow_runs.status`.
- Ảnh storyboard và ảnh xem trước tài sản đi qua `GET /api/artifacts/:artifactId/media` mở rộng: artifact `storyboard` nhận query `still=<stillKey>` và chỉ phục vụ `.png` (`image/png`) nằm trong danh sách `stillKey` của artifact đó; ảnh tài sản qua `GET /api/motion-assets/:assetId/preview`. Cùng luật chặn thoát volume như hiện tại.

## SSE

`GET /api/workflow-runs/:runId/events/stream?afterId=123`

Response `text/event-stream`. Mỗi event:

```text
id: 124
event: agent.status
data: {"workflowRunId":"...","role":"voice","status":"running"}
```

Server gửi các hàng `events` có `id` lớn hơn `afterId`, rồi giữ kết nối và đẩy event mới. Comment heartbeat mỗi 15 giây. Đóng kết nối khi client ngắt.

`job.progress` của render chuyển nguyên payload đã lưu từ callback Remotion.

## Lỗi

```json
{
  "error": {
    "code": "approval_required",
    "message": "Export cần approval final cho đúng preview.",
    "details": {}
  }
}
```

Code: `validation_error` 400, `unauthorized` 401, `not_found` 404, `conflict` 409, `invalid_transition` 409, `approval_required` 409, `payload_too_large` 413, `cost_ceiling` 409.

Không có route đăng bài mạng xã hội.
