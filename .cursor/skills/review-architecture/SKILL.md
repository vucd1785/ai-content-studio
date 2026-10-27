---
name: review-architecture
description: Rà quyết định kiến trúc, ADR và độ lệch của một thay đổi so với docs đã duyệt. Dùng khi người dùng gọi review-architecture hoặc khi một task bị blocked vì ranh giới hệ thống.
disable-model-invocation: true
---

# review-architecture

## Mục đích và cách gọi

Dùng trước khi sửa ADR hoặc khi report task có trạng thái `blocked` vì kiến trúc. Không dùng để triển khai task.

## Đầu vào và tài liệu bắt buộc

- `docs/decisions/`
- Tài liệu hệ thống mà thay đổi đụng: architecture, orchestration, video, security
- Report `blocked` nếu có
- Diff hoặc mô tả file dự định sửa

## Quy trình

1. Nêu quyết định hiện hành bằng đường dẫn ADR.
2. Nêu điểm diff lệch quyết định đó.
3. Chọn một hướng: giữ ADR, hoặc soạn ADR mới với trạng thái đề xuất.
4. Nếu cần ADR mới, viết phương án và dừng để Director duyệt. Chưa sửa mã ứng dụng.
5. Cập nhật task bị chặn bằng ghi chú trỏ tới ADR đề xuất, chưa đổi sang `done`.

## Lệnh được phép

Đọc file, `git diff`, `git status`. Không cài package và không chạy render.

## Đầu ra

Bản nhận xét ngắn: quyết định giữ, hệ quả, task được phép làm tiếp. ADR mới chỉ xuất hiện sau khi Director đồng ý trong cùng lượt yêu cầu.

## Cách kiểm tra

Mỗi nhận xét trỏ tới file và mục. Không có đề xuất thêm service, broker, hay framework agent ngoài ADR.

## Định nghĩa xong

Director có một quyết định giữ hoặc một ADR chờ duyệt, và không có mã ứng dụng mới.

## Dừng và leo thang

Dừng nếu thiếu report hoặc diff. Không tự chấp nhận ADR mới thay cho Director.
