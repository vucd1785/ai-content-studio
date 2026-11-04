# ADR-007: Adapter LLM

- Trạng thái: Accepted
- Ngày: 2026-10-27

## Bối cảnh

Script và research cần JSON đúng schema. Provider và tên model đổi. Gói Cursor không trả lời gọi từ ứng dụng đã chạy.

## Quyết định

Một interface structured output trong worker. Implementation đầu tiên là Gemini, model ID theo biến môi trường từng task, thinking level thấp. Mọi response đi qua Zod. Sai schema thì đúng một lần repair.

OpenAI là implementation sau, cùng interface, chưa làm trong `P1-07`. Không bật Google Search grounding ở MVP. Usage lấy từ metadata response.

Hai phương án kịch bản nằm trong một response.

## Hệ quả

Đổi model không đổi schema artifact. Hết trần số lần gọi thì workflow `failed` với `cost_ceiling`.

Xem [../04-AGENT-ORCHESTRATION.md](../04-AGENT-ORCHESTRATION.md).

## Bổ sung 2026-10-30 — `diagramJson`

Gemini structured output từ chối object `diagram` khi `nodes[]` và `edges[]` cùng có mặt (HTTP 400 trên gemini-3.6-flash và gemini-3.8-flash). Từng mảng một thì được chấp nhận.

Generation schema gửi `diagramJson` (string, không bắt buộc trên scene). Adapter parse chuỗi đó thành object `diagram` rồi mới chạy Zod. Contract `@studio/contracts` không đổi. Repair vẫn tối đa một lần; lỗi parse nằm trong lần repair đó.

Live `llm:external` **PASS** trên **gemini-3.8-flash** (`@google/genai` 1.52.0), `repairCount` 0. Chưa kiểm live workaround này trên gemini-3.6-flash. Mặc định `GEMINI_MODEL_SCRIPT` không bị đổi bởi bổ sung này.

## Bổ sung 2026-11-02 — client Claude Code (gói thuê bao)

Director duyệt sau spike [P6-14](../spikes/P6-14-claude-code-headless.md). Director muốn kịch bản do Claude viết bằng gói Claude Pro của mình trong lúc chưa nâng cấp gói Gemini, và chấp nhận tự kiểm điều khoản dùng gói thuê bao cho việc app tự gọi.

**Quyết định.**

- **Client thứ hai.** `StructuredGenerateClient` có thêm implementation `claude-code`. Client chạy `claude -p` (Claude Code CLI, đăng nhập gói thuê bao, không `--bare`) với các cờ khóa chặt:
  - `--safe-mode`, `--tools ""`, `--strict-mcp-config`, `--permission-mode dontAsk`, `--no-session-persistence`, `--max-turns`;
  - `--system-prompt` của app, `--json-schema`, `--output-format json`;
  - prompt qua stdin; mỗi lần gọi chạy trong một thư mục tạm trống.
- **Chung luồng với Gemini.** Prompt, generation schema, chuyển `diagramJson`, Zod và một lần repair dùng chung. Không thêm service, không thêm queue.
- **Chọn theo lượt chạy (P3-12).**
  - Model id có dạng `claude-code` (model mặc định của tài khoản) hoặc `claude-code:<alias>`.
  - Danh sách model do Director điền trong `CLAUDE_CODE_MODELS`; agent không điền.
  - Không cấu hình thì danh sách model như cũ, chỉ có Gemini.
- **Usage.** Ghi `provider = "claude-code"`, `model` là tên model CLI báo đã chạy, `estimated_cost_usd = 0`, vì gói thuê bao không tính theo token.
- **Lỗi.**
  - Chưa đăng nhập hoặc không chạy được CLI: `configuration_missing`, không retry.
  - Hết hạn mức gói: mã mới `quota_exhausted`, không retry. Director bấm Tiếp tục sau khi hạn mức reset.
  - Lỗi khác: `provider_error`, retry như Gemini.

**Hệ quả.**

- Worker chạy queue `llm` cần `GEMINI_API_KEY` **hoặc** Claude Code đã cấu hình.
- Ứng dụng vẫn không thực thi code do model sinh. Claude Code không có công cụ nào được bật.
- Đường dẫn CLI và thư mục cấu hình đọc từ biến môi trường (`CLAUDE_BIN`, `CLAUDE_CONFIG_DIR`), không viết cứng.
