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
| `GET` | `/api/projects` | Danh sách rút gọn. |
| `POST` | `/api/projects` | Body `{ title }`. |
| `GET` | `/api/projects/:projectId` | Project, brief mới nhất, run mới nhất. |
| `PATCH` | `/api/projects/:projectId` | Đổi `title`. |
| `PUT` | `/api/projects/:projectId/brief` | Tạo brief mới, không sửa lịch sử brief cũ. |
| `POST` | `/api/projects/:projectId/references` | Multipart một file, hoặc JSON `{ url, title }` cho URL Director cung cấp. |
| `DELETE` | `/api/projects/:projectId/references/:referenceId` | Gỡ tham chiếu khỏi project. File đã dùng trong artifact cũ vẫn nằm trên đĩa. |

Brief: `topic`, `audience`, `goal`, `durationSec`, `language`, `tone`, `visualStyle`, `notes`. `language` chỉ nhận `vi` ở MVP. `durationSec` là số nguyên 30–90.

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

Body approval:

```json
{
  "gate": "script",
  "decision": "approved",
  "artifactId": "uuid",
  "note": "Dùng phương án 1, rút ngắn cảnh 2"
}
```

`gate` là `script` hoặc `final`. `decision` là `approved`, `rejected`, hoặc `changes_requested`. Thiếu field là `validation_error`.

`changes_requested` và `rejected` bắt buộc `note` dài 1–2000 ký tự. `approved` được để `note` rỗng.

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
