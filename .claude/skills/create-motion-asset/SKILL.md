---
name: create-motion-asset
description: Viết một tài sản hình động mới (tư thế, hành động, biểu cảm, đồ vật, bối cảnh, góc máy) cho packages/motion-kit theo yêu cầu của chế độ sáng tạo, render ảnh tĩnh, tự soát, chạy test. Dùng khi Director gọi create-motion-asset trong một phiên Claude Code hoặc Cursor.
disable-model-invocation: true
---

# create-motion-asset

## Mục đích và cách gọi

Cách A của [ADR-016](../../../docs/decisions/ADR-016-creative-mode-motion-assets.md): Director mở một phiên agent và gọi skill này để đáp ứng yêu cầu tài sản `open` mà run `creative` để lại. Mỗi lần gọi làm **một** tài sản. Kết quả là tài sản `candidate` trong repo; Director duyệt.

Không dùng skill này để:

- sửa rig, lớp da nhân vật hay thẻ nhận diện kênh (`character_skin`, `brand_card`): Director mở task riêng;
- sửa composition `StickStory` hay `EduVertical`: dùng `build-video-template`;
- sửa workflow, DB, route API hay trạng thái run.

## Đầu vào và tài liệu bắt buộc

- `AGENTS.md`
- `docs/decisions/ADR-014-motion-kit-and-shot-list.md`, `docs/decisions/ADR-016-creative-mode-motion-assets.md`
- `docs/05-VIDEO-PIPELINE.md`, các mục Script JSON v2, Template `StickStory`, SFX
- `docs/08-SECURITY.md`, mục Code do LLM sinh
- `docs/design/characters/sheet.html` (tỷ lệ, màu, nét của ba nhân vật)
- API công khai và một tài sản `approved` cùng kind trong `packages/motion-kit/src/assets/<kind>/` làm mẫu
- Yêu cầu tài sản: lệnh CLI của worker liệt kê yêu cầu `open` (có từ P6-13; tên lệnh ghi trong `apps/worker/package.json`). Chưa có lệnh thì Director dán yêu cầu vào chat.

## Quy trình

1. Đọc yêu cầu: `kind`, `description`, cảnh cần dùng, `fallbackAssetId`. Mở tài sản thay thế để biết khung, tỷ lệ, điểm neo.
2. Chọn `asset_id` mới: `^[a-z0-9_]{1,64}$`, chưa có trong kho, mô tả nội dung (ví dụ `action_ti_tripping`). Nhắc lại id, kind và một câu mô tả với Director trước khi viết.
3. Tạo `packages/motion-kit/src/assets/<kind>/<asset_id>/`:
   - component React vẽ SVG, nhận `frame` và props theo API của kind;
   - `asset.json`: `id`, `kind`, `version` `"0.1.0"`, `tags`, `brandProfile` (null nếu dùng chung), `createdBy` `"claude-code"`, `status` `"candidate"`, `requestKey` của yêu cầu, `licenses` (rỗng nếu chỉ vẽ bằng code);
   - test: render hai lần cùng frame ra cùng SVG, và test riêng của kind (ví dụ vị trí tay ở tư thế giơ tay).
4. Hành động là chuỗi tư thế có lấy đà, giữ nhịp, quá đà; dùng easing của kit, không tự viết bộ easing mới.
5. Render ảnh tĩnh ở ba frame (đầu, giữa, cuối hành động) trên ít nhất hai bối cảnh và hai cỡ cảnh đã có, bằng `renderStill` qua lệnh của `apps/video`. Lưu dưới `data/motion-assets/<asset_id>/` (không ghi ra ngoài `DATA_DIR`).
6. Soát từng ảnh theo checklist dưới. Sửa rồi render lại đến khi đạt hết.
7. Chạy test và typecheck của `packages/motion-kit`, rồi test của `apps/video`.
8. Báo Director: đường dẫn ảnh, diff, kết quả lệnh, điểm còn nghi ngờ. Dừng. Không đổi `status` sang `approved`, không đánh dấu yêu cầu `fulfilled`, không commit.

## Checklist soát ảnh tĩnh

1. Nhân vật đúng tỷ lệ và nét như bản phác; màu lấy từ palette của kit, không mã màu mới.
2. Tay, chân không xuyên đầu hay thân; bàn tay giơ lên nằm ngoài vùng đầu.
3. Khuôn mặt và biểu cảm đọc được ở cỡ `medium` trên điện thoại.
4. Nhân vật và đồ vật nằm trong vùng an toàn, không bị khung phụ đề che.
5. Không dải trống hay mép hở khi camera ở cỡ `wide` và `high`.
6. Đồ vật đặt đúng mặt phẳng: có bóng tiếp xúc, không lơ lửng ngoài chủ đích.
7. Hai nhân vật cùng khung không chồng lên nhau ở vị trí `left` và `right`.
8. Tài sản không vẽ chữ (ADR-014, bổ sung 2026-11-03): phụ đề là chữ duy nhất trong khung. Ý cần minh họa thể hiện bằng hình và chuyển động.
9. Chuyển động giữa ba frame liền mạch: không nhảy vị trí, không đổi kích thước bất thường.
10. Frame cuối nối được về tư thế đứng (`idle`) mà không giật.
11. Hợp mức chi tiết 2: không thêm lớp phủ toàn khung, bụi hay blur (đó là `ambience` theo cảnh).

## Lệnh được phép

- Đọc file trong repo; ghi trong `packages/motion-kit/src/assets/<kind>/<asset_id>/` và `data/motion-assets/<asset_id>/`.
- `pnpm` chạy test, typecheck, lint của `packages/motion-kit` và `apps/video`; lệnh render ảnh tĩnh của `apps/video`.
- Lệnh CLI chỉ đọc yêu cầu tài sản của worker.

Không được: cài package mới, tải file từ mạng, cài skill hay repo ngoài (ví dụ `kelano86/*`), sửa DB, gọi API của ứng dụng để duyệt, `git commit`, `git push`, chạy lệnh phá hủy.

## Ràng buộc code

- Hàm thuần của frame: không `Math.random` (dùng `rnd(seed, i)` của kit), không state giữa các frame, không `Date`.
- Không `fetch`, `eval`, `new Function`, `import()` động, `process`, đọc file, truy cập DOM ngoài SVG của chính nó.
- Chỉ import React và API công khai của `packages/motion-kit`. Không import `@react-three/fiber`.
- Tên file, identifier English; chú thích và chữ hiển thị tiếng Việt.

## Đầu ra

Một thư mục tài sản `candidate` có component, `asset.json`, test; ảnh tĩnh dưới `DATA_DIR`; tin nhắn báo Director kèm kết quả lệnh.

## Cách kiểm tra

Đủ 11 điểm checklist trên mọi ảnh; test và typecheck exit 0; tìm `Math.random`, `fetch`, `eval`, `Function(`, `import(` trong thư mục tài sản và xác nhận không có.

## Định nghĩa xong

Director có đủ ảnh và diff để duyệt. Trạng thái tài sản vẫn `candidate`.

## Dừng và leo thang

Dừng và hỏi Director khi:

- yêu cầu cần đổi API của kit, rig hay lớp da nhân vật;
- cần file ngoài (font, âm thanh, hình) có license;
- yêu cầu mô tả nội dung không phù hợp kênh, hoặc mơ hồ đến mức có nhiều cách vẽ khác nhau;
- sửa ba vòng mà ảnh vẫn trượt checklist.
