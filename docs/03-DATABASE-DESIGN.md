# Thiết kế database

PostgreSQL giữ mọi trạng thái cần khôi phục. Tên cột dưới đây là hợp đồng cho Drizzle ở task `P2-01`. Orchestration dùng các trạng thái này theo [04-AGENT-ORCHESTRATION.md](04-AGENT-ORCHESTRATION.md).

Khóa chính là `uuid`, trừ `events.id` là `bigint` tăng dần để SSE dùng `after_id`. Thời điểm là `timestamptz`.

## Bảng

### `projects`

`id`, `title`, `created_at`, `updated_at`.

Phase 6 (P6-07): thêm `brand_profile_id` uuid NOT NULL, FK `brand_profiles.id` `on delete restrict`, DEFAULT `studio_default_brand_profile_id()` (hàm SQL trả id kênh `is_default`). Migration gắn mọi project cũ vào kênh mặc định; insert không nêu kênh cũng nhận kênh mặc định ([ADR-013](decisions/ADR-013-brand-kit-and-formats.md)).

### `briefs`

`id`, `project_id`, `topic`, `audience`, `goal`, `duration_sec`, `language`, `tone`, `visual_style`, `notes`, `created_at`.

`language` của MVP là `vi`. Một project có nhiều brief theo thời gian; workflow trỏ tới brief nó đã đọc.

Phase 6 (P6-07):

- Thêm `format_id` text NOT NULL và `format_version` integer NOT NULL DEFAULT `1`: gói thể loại trong `packages/contracts` mà brief dùng. Mặc định của `format_id` là `'explainer'` (migration 0003), đổi thành `'story'` ở migration `0005_phase6_story_default` (ADR-013 bổ sung (2) 2026-11-03); API luôn ghi `story` v1. Brief cũ giữ gói đã lưu (`explainer` hoặc `what_if`). DB không kiểm `format_id` có tồn tại; API kiểm.
- `duration_sec`: khoảng hợp lệ là của gói, do Zod kiểm theo `format_id` + `format_version` ở API. CHECK `briefs_duration_sec_range` trong DB nới thành giới hạn an toàn `10..600` (Director chốt 2026-11-03), không còn là khoảng của sản phẩm. Gói `explainer` giữ 30–90 giây; khoảng của gói `what_if` là quyết định Director.
- Trước Phase 6: `duration_sec` từ 30 đến 90.

### `references`

`id`, `project_id`, `kind` (`user_file`, `user_url`, `fetched_url`), `uri`, `title`, `media_type`, `byte_size`, `content_hash`, `created_at`.

`uri` của file là `storage_key`, không phải path tuyệt đối do client gửi.

### `workflow_runs`

`id`, `project_id`, `brief_id`, `status`, `resume_from`, `failure_code`, `failure_message`, `llm_model`, `created_at`, `updated_at`.

`llm_model` (P3-12, migration 0002) là model LLM Director chọn khi bắt đầu run, nằm trong danh sách server cho phép; null là model mặc định của worker. Research và script của run gọi model này.

`creative_mode` (Phase 6, P6-07): text NOT NULL DEFAULT `'standard'`, CHECK thuộc `standard`, `creative` ([ADR-016](decisions/ADR-016-creative-mode-motion-assets.md)). Chọn khi bắt đầu run, không đổi sau đó.

`status` thuộc tập trong tài liệu orchestration. `resume_from` là stage sẽ chạy lại sau lỗi. `exported` và `cancelled` không có resume.

### `agent_runs`

`id`, `workflow_run_id`, `role`, `status`, `attempt`, `input_hash`, `started_at`, `finished_at`, `error_code`, `error_message`.

`role`: `producer`, `research`, `script`, `visual`, `voice`, `video`, `qa`.

`status`: `idle`, `queued`, `running`, `waiting_approval`, `completed`, `failed`, `cancelled`.

### `jobs`

`id`, `agent_run_id`, `queue` (`llm`, `media`, `render`), `idempotency_key`, `bullmq_job_id`, `status`, `attempt`, `max_attempts`, `created_at`, `updated_at`.

`idempotency_key` là unique. Đó là SHA-256 của loại việc, danh sách artifact cha đã sắp xếp, và chuỗi phiên bản config (model, template, voice).

### `artifacts`

`id`, `project_id`, `workflow_run_id`, `type`, `version`, `schema_version`, `content_hash`, `storage_key`, `metadata` jsonb, `created_at`.

`type`: `fetch_log`, `research`, `script`, `storyboard`, `audio`, `alignment`, `captions`, `caption_override`, `render_props`, `preview`, `qa_report`, `export`. `caption_override` (P1-08) còn trong enum nhưng không còn được tạo từ khi xóa `EduVertical` (ADR-013 bổ sung (2) 2026-11-03).

### `artifact_dependencies`

Khóa `(artifact_id, parent_artifact_id)`. Dùng để tính tập bị làm bẩn khi một artifact cha có version mới.

### `approvals`

`id`, `workflow_run_id`, `gate` (`script`, `final`), `decision` (`approved`, `rejected`, `changes_requested`), `artifact_id`, `variant_index`, `note`, `created_at`.

Không có default cho `decision`. Approval gắn với một artifact. Preview mới cần approval mới.

`variant_index` (integer, nullable) là phương án được duyệt trong artifact script hai phương án: `1` hoặc `2`, chỉ có khi `gate = script` và `decision = approved`. CHECK `approvals_variant_index_valid` chặn mọi trường hợp khác. Migration `0001`, Director chốt 2026-10-31 (quyết định 6).

### `events`

`id`, `workflow_run_id`, `agent_run_id`, `job_id`, `type`, `payload` jsonb, `created_at`.

`type`: `workflow.transition`, `agent.status`, `job.progress`, `job.completed`, `job.failed`, `approval.recorded`.

Index `(workflow_run_id, id)`.

### `usage_records`

`id`, `workflow_run_id`, `agent_run_id`, `provider`, `model`, `input_tokens`, `output_tokens`, `thinking_tokens`, `estimated_cost_usd`, `created_at`.

Số token lấy từ metadata của response. Giá là ước tính theo bảng giá đã cấu hình, ghi kèm phiên bản bảng giá trong `metadata` của record nếu cần truy vết. Cột giá không phải hóa đơn.

### `voice_profiles`

`id`, `provider`, `provider_voice_id`, `display_name`, `kind` (`preset`, `clone`), `consent_recorded_at`, `enabled`.

MVP chỉ seed preset VieNeu và `enabled = true`. Bản `clone` chỉ `enabled` khi `consent_recorded_at` có giá trị. Chưa có API clone ở MVP.

### `brand_profiles` (Phase 6)

Một kênh ([ADR-013](decisions/ADR-013-brand-kit-and-formats.md)).

`id`, `slug` (unique, `^[a-z0-9-]{1,40}$`), `display_name`, `palette` jsonb, `fonts` jsonb, `intro_asset_id`, `outro_asset_id`, `sonic_logo_asset_id` (text, nullable, id trong `motion_assets.asset_id`), `tone_rules` text, `narrator_voice_id` (text, nullable), `is_default` boolean, `created_at`, `updated_at`.

- `palette`: object tên màu → mã hex `#RRGGBB`; `fonts`: `{ heading, body }`. Zod trong contracts là nguồn hình dạng.
- Đúng một hàng `is_default = true`: unique index một phần `WHERE is_default`.
- `narrator_voice_id` null nghĩa là dùng `TTS_DEFAULT_VOICE`.
- `tone_rules` đưa vào prompt kịch bản.

### `brand_characters` (Phase 6)

Dàn nhân vật của kênh, một hàng mỗi nhân vật ([ADR-013](decisions/ADR-013-brand-kit-and-formats.md), [ADR-015](decisions/ADR-015-multi-speaker-voice.md)).

`id`, `brand_profile_id` (FK, `on delete cascade`), `character_key`, `display_name`, `role` (`protagonist`, `explainer`, `companion`), `skin_asset_id` (text, id tài sản lớp da trong `motion_assets.asset_id`), `personality` text, `catchphrases` jsonb (mảng chuỗi), `signature_action_id` (text, nullable), `speaks` boolean, `voice_id` (text, nullable), `sort_order` integer, `created_at`, `updated_at`.

- `character_key`: `^[a-z][a-z0-9_]{0,31}$`, unique theo `(brand_profile_id, character_key)`, khác `narrator`. Đây là giá trị `speaker` trong script `2` và `character` trong shot list.
- CHECK `brand_characters_voice_only_if_speaks`: `speaks = false` thì `voice_id IS NULL`.
- `voice_id` là `provider_voice_id` do service TTS trả về; Director chọn trên giao diện. Null khi nhân vật nói chưa có giọng: run dùng nhân vật đó trượt sớm với lỗi cấu hình, không tự lấy giọng khác.
- Seed kênh mặc định (P6-07): kênh `kenh-mac-dinh` ("Kênh mặc định", bảng màu theo bản phác nhân vật, font `system-ui`); nhân vật `ti` (`protagonist`, nói), `bit` (`explainer`, nói), `dau` (`companion`, không nói), `skin_asset_id` là `skin_ti`, `skin_bit`, `skin_dau` (P6-05 tạo tài sản cùng id); tên hiển thị tạm Tí, Bit, Đậu; `catchphrases` rỗng. Seed **không** chứa `voice_id`, `narrator_voice_id`, không chứa tên giọng.

### `motion_assets` (Phase 6)

Bản sao chỉ đọc của manifest `asset.json` trong `packages/motion-kit/src/assets/<kind>/<id>/` ([ADR-016](decisions/ADR-016-creative-mode-motion-assets.md)). Script đồng bộ là nguồn ghi duy nhất.

`id` uuid, `asset_id` (text, unique, `^[a-z0-9_]{1,64}$`), `kind`, `version` (semver), `tags` jsonb (mảng chuỗi), `brand_profile_id` (nullable: null là dùng chung mọi kênh), `created_by` (`director`, `claude-code`), `status` (`candidate`, `approved`), `source_path` (đường dẫn tương đối từ gốc repo), `preview_storage_key` (nullable, dưới `DATA_DIR`), `manifest_hash`, `synced_at`.

`kind`: `character_skin`, `expression`, `pose`, `action`, `background`, `prop`, `camera`, `sfx`, `brand_card`.

- Đồng bộ lại cùng manifest không đổi hàng (so `manifest_hash`). Manifest bị xóa khỏi repo thì hàng giữ nguyên nhưng bị loại khỏi danh sách id gửi cho LLM (`source_path` không còn tồn tại); không xóa hàng tự động.
- Danh sách id gửi vào prompt `standard` chỉ gồm `status = approved`.
- Cách giao diện đổi `candidate` thành `approved` khi bảng chỉ đọc: chốt ở P6-11 (Director chốt 2026-11-03, giữ đề xuất). Nếu P6-11 chọn cho API ghi `asset.json` trong repo thì phải bổ sung ADR-016 trước; nếu không, giao diện chỉ hiển thị và Director duyệt qua phiên Claude Code.

### `motion_asset_requests` (Phase 6)

Yêu cầu tài sản mới từ run `creative` ([ADR-016](decisions/ADR-016-creative-mode-motion-assets.md)).

`id`, `workflow_run_id` (FK), `script_artifact_id` (FK `artifacts.id`), `variant_index` (1 hoặc 2), `scene_id`, `request_key` (id yêu cầu trong shot list), `kind` (cùng tập với `motion_assets.kind`), `description` text, `fallback_asset_id` (text), `status` (`open`, `fulfilled`, `dismissed`), `fulfilled_asset_id` (text, nullable), `created_at`, `updated_at`.

- Unique `(script_artifact_id, variant_index, request_key)`: ghi lại khi job chạy lại không tạo trùng.
- CHECK `motion_asset_requests_fulfilled`: `status = 'fulfilled'` khi và chỉ khi `fulfilled_asset_id IS NOT NULL`.
- Chuyển `fulfilled` chỉ khi tài sản trỏ tới có `status = approved`.
- Ghi bảng này không phải approval của workflow và không đổi `workflow_runs.status`.

### `youtube_connections` (ADR-031)

Kênh YouTube đã kết nối của một `brand_profile` (unique). `channel_id`, `channel_title`, `channel_thumbnail`, `refresh_token_enc` (AES-256-GCM, khóa `STUDIO_TOKEN_KEY`, không bao giờ lưu dạng thô), `scopes`, `last_error` (ví dụ "Cần kết nối lại"), `connected_at`. Xóa kênh thì xóa theo.

### `youtube_uploads` (ADR-031)

Một hàng cho mỗi lần bấm "Đăng", gắn với đúng một job queue `upload` (`job_id` unique). Giữ các ô Director đã xác nhận (`request` jsonb), `export_artifact_id`, `brand_profile_id`, trạng thái bền để thử lại không đăng trùng (`session_uri` của upload resumable, `video_id`), `thumbnail` (`pending`, `set`, `failed`, `skipped`) kèm lý do, `result_artifact_id` (artifact `youtube_upload`). Enum mới: `job_queue` thêm `upload`, `artifact_type` thêm `youtube_upload` (migration `0008`).

## Ràng buộc

- Xóa project là thao tác chủ đích sau này. MVP không cần endpoint xóa hàng loạt.
- `storage_key` không chứa `..` và không bắt đầu bằng `/`.
- Job `completed` phải có artifact tương ứng, trừ job hủy trước khi tạo artifact.
- Ghi approval, đổi `workflow_runs.status` và event `approval.recorded` trong cùng một transaction.

Phase 6 là một migration mới (`0003_phase6_brand_formats`, P6-07), chạy hai lần không lỗi. Cột trạng thái và loại của bảng Phase 6 (`role`, `kind`, `status`, `created_by`, `creative_mode`) là text có CHECK, không phải enum Postgres, để thêm giá trị không cần đổi kiểu. Thứ tự: tạo `brand_profiles`, `brand_characters`, seed kênh mặc định, thêm `projects.brand_profile_id` (điền kênh mặc định rồi đặt NOT NULL), thêm cột brief (điền `explainer`, 1), nới CHECK thời lượng, thêm `workflow_runs.creative_mode`, tạo `motion_assets`, `motion_asset_requests`. Chạy trên DB `studio` cần Director cho phép.

Drizzle migration là nguồn SQL. Tài liệu này đổi trước khi đổi schema đã ship, thông qua task được phép sửa file này.
