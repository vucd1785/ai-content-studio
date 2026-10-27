---
name: build-3d-scene
description: Dựng studio 3D low-poly và nối avatar với trạng thái agent đã lưu. Dùng khi người dùng gọi build-3d-scene hoặc làm task P4.
disable-model-invocation: true
---

# build-3d-scene

## Mục đích và cách gọi

Dùng cho canvas trong `apps/web/src/studio`. Không dùng để render MP4.

## Đầu vào và tài liệu bắt buộc

- `docs/06-3D-UI-DESIGN.md`
- `docs/decisions/ADR-009-3d-monitoring.md`
- Khối task `P4-*`

## Quy trình

1. Dựng hình bằng geometry đơn giản, tám vị trí, camera orthographic giới hạn góc.
2. Nhận trạng thái qua props hoặc store. Mặc định `idle`.
3. Khi task yêu cầu dữ liệu thật, map `agent_runs.status` theo bảng trong tài liệu 3D.
4. Thanh tiến độ chỉ gắn với payload có số frame.
5. Thêm cờ reduced-motion và `dpr` 1 khi task là `P4-03`.
6. Click chọn role và mở panel 2D có sẵn khi task là `P4-04`.

## Lệnh được phép

`pnpm` typecheck và test của `apps/web`. Không chạy Remotion render.

## Đầu ra

Component studio, reducer hoặc store nếu task nối SSE, report.

## Cách kiểm tra

Test hoặc đọc code xác nhận không có timer tự chuyển sang `completed`. Xác nhận `apps/web` không import entry render của `apps/video`.

## Định nghĩa xong

Canvas phản ánh props đã cho và luồng duyệt 2D vẫn còn khi canvas ẩn, nếu task đụng điều hướng.

## Dừng và leo thang

Dừng nếu chưa có event thật mà task lại yêu cầu mô phỏng job. Không thêm fiber 10, physics, hay asset nhân vật có rig.
