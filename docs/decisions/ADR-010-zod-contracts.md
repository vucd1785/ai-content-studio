# ADR-010: Zod là hợp đồng dùng chung

- Trạng thái: Accepted
- Ngày: 2026-10-27

## Bối cảnh

API, worker, CLI và test cần cùng một định nghĩa script, research, caption và approval. Fastify 5.5 dùng `@fastify/type-provider-zod` với Zod 4.2 trở lên. Structured output của Gemini không ép mọi ràng buộc như `minLength`.

## Quyết định

`packages/contracts` chứa schema Zod, import `zod/v4`. API dùng các schema đó cho request và response. Worker validate lại trước khi ghi artifact. Sai schema là lỗi, không sửa bằng cách nới file schema trong lúc retry.

## Hệ quả

Đổi field công khai là đổi `schemaVersion` và là việc có chủ đích trong task được phép. JSON Schema gửi cho Gemini được sinh từ Zod rồi kiểm tra lại bằng Zod sau response.

Xem [../05-VIDEO-PIPELINE.md](../05-VIDEO-PIPELINE.md) và [../07-API-CONTRACTS.md](../07-API-CONTRACTS.md).
