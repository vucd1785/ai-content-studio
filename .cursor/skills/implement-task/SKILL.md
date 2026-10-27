---
name: implement-task
description: Triển khai đúng một task pending trong docs/11-TASKS.md, chạy kiểm tra và viết reports. Dùng khi người dùng gọi implement-task hoặc yêu cầu làm một task ID đã duyệt.
disable-model-invocation: true
---

# implement-task

## Mục đích và cách gọi

Dùng khi Director hoặc tin nhắn bàn giao nêu một task ID. Không dùng để đổi kiến trúc.

## Đầu vào và tài liệu bắt buộc

- `AGENTS.md`
- Khối task trong `docs/11-TASKS.md`
- ADR mà task liệt kê
- `docs/12-MODEL-HANDOFF.md`

## Quy trình

1. Xác nhận trạng thái `pending` và mọi phụ thuộc `done`.
2. Đọc **File được phép**. Lập danh sách file sẽ sửa, nằm trong danh sách đó.
3. Đọc tài liệu chuyên trách mà task trỏ tới, chỉ các mục liên quan.
4. Viết code và test trong phạm vi đó.
5. Chạy mục **Kiểm tra**.
6. Viết `reports/<task-id>.md`.
7. Đổi `Trạng thái` của đúng task đó thành `done` hoặc `blocked`.

## Lệnh được phép

Lệnh trong mục Kiểm tra của task, `pnpm`, `docker compose`, và công cụ đọc file. Không push, không sửa git config.

## Đầu ra

Diff trong phạm vi task, report, một trạng thái mới trong `docs/11-TASKS.md`.

## Cách kiểm tra

Đối chiếu từng gạch đầu dòng tiêu chí nghiệm thu với output lệnh. Thiếu một tiêu chí thì chưa `done`.

## Định nghĩa xong

Mọi tiêu chí có bằng chứng trong report và không có file ngoài danh sách được phép.

## Dừng và leo thang

Dừng nếu phụ thuộc chưa `done`, nếu cần sửa ADR, hoặc nếu kiểm tra đòi đổi schema công khai. Ghi `blocked` và ID task kế tiếp nên là chính task này sau khi Grok xem lại.
