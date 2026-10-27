---
name: verify-phase
description: Đối chiếu mọi task của một phase với tiêu chí trong docs/10-IMPLEMENTATION-PLAN.md và các report. Dùng khi người dùng gọi verify-phase sau khi các task của phase đã done.
disable-model-invocation: true
---

# verify-phase

## Mục đích và cách gọi

Dùng khi Director yêu cầu nghiệm thu một phase. Không dùng để triển khai task còn `pending`.

## Đầu vào và tài liệu bắt buộc

- `docs/10-IMPLEMENTATION-PLAN.md`
- `docs/11-TASKS.md`
- `reports/` của các task thuộc phase
- `docs/09-TEST-STRATEGY.md`

## Quy trình

1. Liệt kê mọi task của phase và trạng thái.
2. Phase 1 trở đi: xác nhận `docs/spikes/P0-04-alignment.md` có `Decision: go` trước khi coi các task media sau spike là hợp lệ.
3. Mở từng report `done` và kiểm tra mục kiểm tra đã có kết quả.
4. Chạy lại lệnh kiểm tra then chốt nếu report không dán kết quả.
5. Ghi `reports/phase-<n>.md` với các mục đạt, các mục thiếu, và task cần mở lại.

## Lệnh được phép

Lệnh đã ghi trong report của các task thuộc phase. Không sửa mã để ép xanh trong skill này.

## Đầu ra

`reports/phase-<n>.md` với kết luận `pass` hoặc `fail`.

## Cách kiểm tra

Mỗi tiêu chí trong định nghĩa xong của phase có một report hoặc một lệnh vừa chạy. Task `pending` trong phase làm kết luận thành `fail`.

## Định nghĩa xong

File phase nêu pass hoặc fail, và không có task nào bị đổi trạng thái thành `done` nếu report cũ thiếu bằng chứng.

## Dừng và leo thang

Nếu bằng chứng mâu thuẫn với ADR, dừng và chuyển `review-architecture`. Không đánh `skipped` cho task No-Go của alignment.
