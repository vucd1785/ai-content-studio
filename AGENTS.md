# Hướng dẫn cho coding agent

Đọc file này trước khi sửa repository. Nguồn sự thật là tài liệu trong `docs/`, không phải lịch sử chat.

## Đang ở đâu

Repository đang ở giai đoạn tài liệu. Chưa có mã ứng dụng. Task được phép làm tiếp là `P0-01` trong [docs/11-TASKS.md](docs/11-TASKS.md), và chỉ sau khi Director yêu cầu triển khai.

## Cách làm một task

1. Chọn một task `pending` có mọi phụ thuộc `done`.
2. Đọc khối task đó, các ADR nó nêu, và tài liệu chuyên trách nó trỏ tới.
3. Gọi skill ghi trong task. Skill nằm ở `.cursor/skills/<tên>/SKILL.md`.
4. Chỉ sửa **File được phép**.
5. Chạy mục **Kiểm tra**.
6. Viết `reports/<task-id>.md` theo [docs/12-MODEL-HANDOFF.md](docs/12-MODEL-HANDOFF.md).
7. Đổi trạng thái task thành `done` hoặc `blocked`. Dừng.

Định nghĩa xong là toàn bộ tiêu chí nghiệm thu của task đó đã có bằng chứng trong report.

## Tài liệu

| Việc | File |
|---|---|
| Tầm nhìn | [docs/00-VISION.md](docs/00-VISION.md) |
| Hành vi Director | [docs/01-PRD.md](docs/01-PRD.md) |
| Process | [docs/02-SYSTEM-ARCHITECTURE.md](docs/02-SYSTEM-ARCHITECTURE.md) |
| Bảng | [docs/03-DATABASE-DESIGN.md](docs/03-DATABASE-DESIGN.md) |
| Workflow | [docs/04-AGENT-ORCHESTRATION.md](docs/04-AGENT-ORCHESTRATION.md) |
| Video | [docs/05-VIDEO-PIPELINE.md](docs/05-VIDEO-PIPELINE.md) |
| Studio 3D | [docs/06-3D-UI-DESIGN.md](docs/06-3D-UI-DESIGN.md) |
| API | [docs/07-API-CONTRACTS.md](docs/07-API-CONTRACTS.md) |
| Bảo mật | [docs/08-SECURITY.md](docs/08-SECURITY.md) |
| Test | [docs/09-TEST-STRATEGY.md](docs/09-TEST-STRATEGY.md) |
| Phase | [docs/10-IMPLEMENTATION-PLAN.md](docs/10-IMPLEMENTATION-PLAN.md) |
| Task | [docs/11-TASKS.md](docs/11-TASKS.md) |
| Đổi model | [docs/12-MODEL-HANDOFF.md](docs/12-MODEL-HANDOFF.md) |
| ADR | [docs/decisions/README.md](docs/decisions/README.md) |

Quyết định chưa chốt nằm ở mục tương ứng trong kế hoạch triển khai. Không tự điền model ID, license alignment, hay `licenseKey` của Remotion.

## Ranh giới

- UI và tài liệu viết tiếng Việt. Identifier, tên file, API và tên công nghệ giữ English.
- Không ghi `approved` ngoài route approval.
- Không sửa `docs/decisions/` trong task triển khai. Cần đổi ADR thì report `blocked` và gọi `review-architecture`.
- Avatar 3D chỉ vẽ trạng thái đã lưu.
- Provider LLM của ứng dụng tách khỏi model đang viết code trong Cursor.
