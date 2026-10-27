# ADR-002: Vai trò logic và worker

- Trạng thái: Accepted
- Ngày: 2026-10-27

## Bối cảnh

Sản phẩm có bảy vai trò chuyên biệt. Bảy agent hội thoại làm tăng token, khó duyệt, và khó biết job nào đang chạy.

## Quyết định

Vai trò là `agent_runs.role` và là bàn trong studio 3D. Thực thi nằm ở ba queue: `llm`, `media`, `render`. Producer của MVP là state machine, không phải một cuộc gọi LLM điều phối.

LLM chỉ làm research, script và visual. Voice, đo audio, alignment, render và QA mặc định là code.

## Hệ quả

Thêm vai trò mới là thêm role, schema artifact và job, không thêm service. Không đưa framework hội thoại agent vào repository này.

Xem [../04-AGENT-ORCHESTRATION.md](../04-AGENT-ORCHESTRATION.md).
