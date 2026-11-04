# Hướng dẫn cho coding agent

Đọc file này trước khi sửa repository. Nguồn sự thật là tài liệu trong `docs/`, không phải lịch sử chat.

## Đang ở đâu

Mã ứng dụng đã có cho Phase 0–5 (`apps/`, `packages/`). Tiến độ thật lấy từ trường `Trạng thái` trong [docs/11-TASKS.md](docs/11-TASKS.md) và các file `reports/<task-id>.md`, không lấy từ mục này.

Ảnh chụp ngày 2026-11-02 (nhánh `feat/phase2-5-workflow-studio`, nhiều thay đổi chưa commit):

- Đã viết report, chờ Director nghiệm thu: P2-11, P2-12, P3-12, P3-13, P3-14, P3-15, P3-16, P3-17, P4-05, P5-04. Không tự đổi sang `done`.
- P3-17 còn phải chạy lại integration test của worker (`asset-jobs.integration.test.ts`) và bộ test API khi Docker/Postgres ổn định, rồi cập nhật report.
- Chưa làm: P2-13 (Playwright, cần Director cho phép tải browser), P2-14.
- Bảo mật mục C để sau.

Chỉ commit khi Director yêu cầu.

## Cách làm một task

1. Chọn một task `pending` có mọi phụ thuộc `done`.
2. Đọc khối task đó, các ADR nó nêu, và tài liệu chuyên trách nó trỏ tới.
3. Gọi skill ghi trong task. Skill nằm ở `.cursor/skills/<tên>/SKILL.md`.
4. Chỉ sửa **File được phép**.
5. Chạy mục **Kiểm tra**.
6. Viết `reports/<task-id>.md` theo [docs/12-MODEL-HANDOFF.md](docs/12-MODEL-HANDOFF.md).
7. Đổi trạng thái task thành `done` hoặc `blocked`. Dừng.

Định nghĩa xong là toàn bộ tiêu chí nghiệm thu của task đó đã có bằng chứng trong report.

Phiên agent tự hành làm nhiều task liên tiếp theo [docs/13-AUTONOMOUS-AGENT-WORKFLOW.md](docs/13-AUTONOMOUS-AGENT-WORKFLOW.md) (chọn task, cổng Director, checkpoint). File đó không nới ràng buộc nào ở đây.

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
| Spike Phase 6 | [docs/spikes/](docs/spikes/) (P6-01 shot list, P6-02 căn chữ, P6-03 render, P6-14 Claude Code) |
| Nhân vật kênh | [docs/design/characters/sheet.html](docs/design/characters/sheet.html) |
| Tài sản hình động | skill `create-motion-asset` ([.cursor](.cursor/skills/create-motion-asset/SKILL.md), [.claude](.claude/skills/create-motion-asset/SKILL.md)) |

Quyết định chưa chốt nằm ở mục tương ứng trong kế hoạch triển khai. Không tự điền model ID, license alignment, hay `licenseKey` của Remotion.

## Ranh giới

- UI và tài liệu viết tiếng Việt. Identifier, tên file, API và tên công nghệ giữ English.
- Không ghi `approved` ngoài route approval.
- Không sửa `docs/decisions/` trong task triển khai. Cần đổi ADR thì report `blocked` và gọi `review-architecture`.
- Avatar 3D chỉ vẽ trạng thái đã lưu.
- Provider LLM của ứng dụng tách khỏi model đang viết code trong Cursor.
