# ADR-009: Studio 3D chỉ để giám sát

- Trạng thái: Accepted
- Ngày: 2026-10-27

## Bối cảnh

Director cần thấy việc đang chạy mà không biến canvas thành nơi soạn kịch bản. Progress giả làm mất niềm tin vào trạng thái job.

## Quyết định

Canvas dùng fiber 9 và drei 10, hình low-poly bằng code, camera isometric. Nó subscribe trạng thái đã lưu. Panel 2D giữ form, diff kịch bản, duyệt, log và player.

Không có phần trăm cho job LLM. Thanh render dùng số liệu callback `renderMedia()`. `prefers-reduced-motion` và chế độ `dpr` 1 là một phần của MVP 3D.

Fiber 10 alpha không dùng.

## Hệ quả

Phase 4 đứng sau SSE. Có thể vận hành studio khi canvas bị tắt.

Xem [../06-3D-UI-DESIGN.md](../06-3D-UI-DESIGN.md).
