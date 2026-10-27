# Thiết kế database

PostgreSQL giữ mọi trạng thái cần khôi phục. Tên cột dưới đây là hợp đồng cho Drizzle ở task `P2-01`. Orchestration dùng các trạng thái này theo [04-AGENT-ORCHESTRATION.md](04-AGENT-ORCHESTRATION.md).

Khóa chính là `uuid`, trừ `events.id` là `bigint` tăng dần để SSE dùng `after_id`. Thời điểm là `timestamptz`.

## Bảng

### `projects`

`id`, `title`, `created_at`, `updated_at`.

### `briefs`

`id`, `project_id`, `topic`, `audience`, `goal`, `duration_sec`, `language`, `tone`, `visual_style`, `notes`, `created_at`.

`language` của MVP là `vi`. `duration_sec` từ 30 đến 90. Một project có nhiều brief theo thời gian; workflow trỏ tới brief nó đã đọc.

### `references`

`id`, `project_id`, `kind` (`user_file`, `user_url`, `fetched_url`), `uri`, `title`, `media_type`, `byte_size`, `content_hash`, `created_at`.

`uri` của file là `storage_key`, không phải path tuyệt đối do client gửi.

### `workflow_runs`

`id`, `project_id`, `brief_id`, `status`, `resume_from`, `failure_code`, `failure_message`, `created_at`, `updated_at`.

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

`type`: `fetch_log`, `research`, `script`, `storyboard`, `audio`, `alignment`, `captions`, `caption_override`, `render_props`, `preview`, `qa_report`, `export`.

### `artifact_dependencies`

Khóa `(artifact_id, parent_artifact_id)`. Dùng để tính tập bị làm bẩn khi một artifact cha có version mới.

### `approvals`

`id`, `workflow_run_id`, `gate` (`script`, `final`), `decision` (`approved`, `rejected`, `changes_requested`), `artifact_id`, `note`, `created_at`.

Không có default cho `decision`. Approval gắn với một artifact. Preview mới cần approval mới.

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

## Ràng buộc

- Xóa project là thao tác chủ đích sau này. MVP không cần endpoint xóa hàng loạt.
- `storage_key` không chứa `..` và không bắt đầu bằng `/`.
- Job `completed` phải có artifact tương ứng, trừ job hủy trước khi tạo artifact.
- Ghi approval, đổi `workflow_runs.status` và event `approval.recorded` trong cùng một transaction.

Drizzle migration là nguồn SQL. Tài liệu này đổi trước khi đổi schema đã ship, thông qua task được phép sửa file này.
