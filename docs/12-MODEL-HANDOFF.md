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

Task đang mở cho phiên triển khai Phase 1: **`P1-01`** (xem [11-TASKS.md](11-TASKS.md)).
