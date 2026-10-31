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
