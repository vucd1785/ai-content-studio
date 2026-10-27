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

## Tin nhắn bàn giao cho Composer

Người điều phối dán khối này khi đổi model:

```text
Làm đúng task <ID> trong docs/11-TASKS.md.
Đọc AGENTS.md, task đó, và các ADR mà task nêu.
Skill: implement-task.
Chỉ sửa File được phép.
Chạy mục Kiểm tra.
Viết reports/<ID>.md theo docs/12-MODEL-HANDOFF.md.
Dừng sau task này.
```

Task đang mở cho phiên đầu: `P0-01`.
