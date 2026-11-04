---
name: build-video-template
description: Dựng composition Remotion, motion kit nhân vật và render MP4 từ render_props. Dùng khi người dùng gọi build-video-template hoặc làm task P0-05, P1-04, P1-05, P5-03, P6-03, P6-05, P6-09, P6-12.
disable-model-invocation: true
---

# build-video-template

## Mục đích và cách gọi

Dùng khi thêm hoặc sửa template video. Không dùng cho canvas studio trong `apps/web`.

## Đầu vào và tài liệu bắt buộc

- `docs/05-VIDEO-PIPELINE.md`
- `docs/decisions/ADR-006-remotion-local-render.md`
- Phase 6: `docs/decisions/ADR-014-motion-kit-and-shot-list.md`, `docs/spikes/P6-03-render-cost.md`, bản phác `docs/design/characters/sheet.html`
- Fixture hoặc `render_props` mà task chỉ định

## Quy trình

1. Giữ khung 1080×1920, 30 fps, H.264.
2. Đọc duration và caption từ props. Không tính lại bằng số từ.
3. Vẽ đúng slot task yêu cầu: `title`, `explain`, `code`, `diagram`, `cta`. Với `StickStory`: vẽ shot đã gắn frame bằng component của `packages/motion-kit`, không vẽ nhân vật trực tiếp trong `apps/video`.
4. Motion kit và composition là hàm thuần của frame: không `Math.random` (dùng `rnd(seed, i)`), không state giữa frame, không mạng, không đọc file lúc render.
5. Đổi composition hoặc motion kit thì nâng version; version kit nằm trong `templateVersion` và `content_hash`.
6. Soát ảnh tĩnh (`renderStill`) trước khi render cả video: vùng an toàn, phụ đề không che nhân vật, tay không bị đầu che, không dải trống ở mép khung.
7. Ghi license của font, icon hoặc SFX mới vào manifest package.
8. Render fixture và đọc ffprobe.
9. Với preview/export, chặn lần render thứ hai khi hash props không đổi.

Tài sản mới cho kho (tư thế, hành động, đồ vật, bối cảnh) theo yêu cầu của chế độ sáng tạo dùng skill `create-motion-asset`, không dùng skill này.

## Lệnh được phép

Script render của `apps/video`, `renderStill`, ffprobe hoặc `npx remotion ffprobe`, test unit của hash props và của `packages/motion-kit`, typecheck.

## Đầu ra

Composition, MP4 fixture hoặc lệnh tạo lại, kết quả ffprobe trong report.

## Cách kiểm tra

ffprobe đúng `width`, `height`, `r_frame_rate`. Tìm import `@react-three/fiber` trong `apps/video` và `packages/motion-kit` và xác nhận không có. Tìm `Math.random`, `fetch`, `eval`, `new Function` trong `packages/motion-kit` và xác nhận không có. Đo loudness khi task có âm thanh (P6-12).

## Định nghĩa xong

MP4 mở được bằng số đo trên và composition không gọi mạng.

## Dừng và leo thang

Dừng nếu Remotion đòi `licenseKey` mà environment chưa có, hoặc Chrome không chạy trong container. Ghi version Remotion vào report. Không chuyển sang render cloud trong cùng task.
