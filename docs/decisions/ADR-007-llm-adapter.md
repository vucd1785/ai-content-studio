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
