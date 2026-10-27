# ADR-004: Cổng duyệt của Director

- Trạng thái: Accepted
- Ngày: 2026-10-27

## Bối cảnh

Kịch bản và video cuối là quyết định sáng tạo. Agent có thể hoàn tất kỹ thuật trong khi nội dung vẫn chưa được chấp nhận.

## Quyết định

Hai cổng bắt buộc: `script` và `final`. Decision chỉ có `approved`, `rejected`, `changes_requested`, do route approval ghi cùng event trong một transaction. Không có default và không có job nào tự ghi `approved`.

Approval trỏ tới một `artifact_id`. Export dùng đúng preview đã duyệt.

## Hệ quả

Workflow có các trạng thái chờ. UI phải gửi decision tường minh. QA chỉ tạo báo cáo.

Xem [../04-AGENT-ORCHESTRATION.md](../04-AGENT-ORCHESTRATION.md).
