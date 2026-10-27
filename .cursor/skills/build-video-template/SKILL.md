---
name: build-video-template
description: Dựng composition Remotion và render MP4 từ render_props. Dùng khi người dùng gọi build-video-template hoặc làm task P0-05, P1-04, P1-05, P5-03.
disable-model-invocation: true
---

# build-video-template

## Mục đích và cách gọi

Dùng khi thêm hoặc sửa template video. Không dùng cho canvas studio trong `apps/web`.

## Đầu vào và tài liệu bắt buộc

- `docs/05-VIDEO-PIPELINE.md`
- `docs/decisions/ADR-006-remotion-local-render.md`
- Fixture hoặc `render_props` mà task chỉ định

## Quy trình

1. Giữ khung 1080×1920, 30 fps, H.264.
2. Đọc duration và caption từ props. Không tính lại bằng số từ.
3. Vẽ đúng slot task yêu cầu: `title`, `explain`, `code`, `diagram`, `cta`.
4. Ghi license của font hoặc icon mới vào manifest package.
5. Render fixture và đọc ffprobe.
6. Với preview/export, chặn lần render thứ hai khi hash props không đổi.

## Lệnh được phép

Script render của `apps/video`, ffprobe hoặc `npx remotion ffprobe`, test unit của hash props.

## Đầu ra

Composition, MP4 fixture hoặc lệnh tạo lại, kết quả ffprobe trong report.

## Cách kiểm tra

ffprobe đúng `width`, `height`, `r_frame_rate`. Tìm import `@react-three/fiber` trong `apps/video` và xác nhận không có.

## Định nghĩa xong

MP4 mở được bằng số đo trên và composition không gọi mạng.

## Dừng và leo thang

Dừng nếu Remotion đòi `licenseKey` mà environment chưa có, hoặc Chrome không chạy trong container. Ghi version Remotion vào report. Không chuyển sang render cloud trong cùng task.
