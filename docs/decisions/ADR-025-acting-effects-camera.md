# ADR-025: Hành động mới, lớp hiệu ứng, góc máy mới

- Trạng thái: **Accepted**. Director 2026-11-12 yêu cầu tiếp tục cải thiện theo video mẫu: ba việc còn lại của danh sách (hành động và tương tác, hiệu ứng, góc máy).
- Ngày: 2026-11-12
- Liên quan:
  - [ADR-014](ADR-014-motion-kit-and-shot-list.md): motion kit, shot list;
  - [ADR-023](ADR-023-depth-layers-and-scene-lighting.md): chiều sâu, ánh sáng;
  - [ADR-024](ADR-024-editing-rhythm.md): nhịp dựng, shot nhìn người nghe;
  - tài liệu [05](../05-VIDEO-PIPELINE.md).

## Bối cảnh

Video mẫu kể chuyện bằng hành động: chạy, nhìn theo vật, phản ứng. Mỗi khoảnh khắc quan trọng có hiệu ứng (chớp sáng, tia, vệt tốc độ), máy quay có góc thấp và góc nghiêng.

Kit hiện có:

- tám hành động và tư thế (vẫy, chỉ, ăn mừng, hoảng, đi, nói, đứng, anh hùng);
- năm kiểu máy (đứng yên, đẩy vào, kéo ra, lia, giật);
- không có hiệu ứng.

Shot nhìn người nghe (ADR-024) chưa có hành động "nghe".

## Quyết định

### 1. Sáu hành động mới, làm tay, `approved`

| Id | Hành động | Dùng khi |
|---|---|---|
| `action_run` | Chạy tại chỗ, chúi người, có pha bay | Vội, đuổi theo, chạy trốn |
| `action_think` | Khoanh tay, dựng tay cạnh má, nghiêng đầu | Băn khoăn, đặt câu hỏi |
| `action_listen` | Chồm tới, gật gù | Người nghe trong shot phản ứng |
| `action_shrug` | Nhún vai, ngửa tay | Không biết, bó tay, đùa |
| `action_present` | Đưa tay mở về phía trước | Giới thiệu đồ vật, minh họa ("đây là") |
| `action_look_up` | Ngả người, chỉ lên trời | Thấy thứ trên trời |

- **Kiểm tra:** cả sáu qua các kiểm hiện có của rig với cả ba nhân vật. Bàn tay và khuỷu không chạm đầu ở mọi frame, kể cả khi cộng diễn xuất tự động; tay không chạm nhân vật bên cạnh.
- **Giới hạn của "tương tác":** đây là tương tác bằng cử chỉ (`action_present` chỉ vào đồ vật bên cạnh nhờ hướng nhìn). Cầm, nhấc đồ vật cần gắn đồ vật vào bàn tay, chưa làm.

### 2. Lớp hiệu ứng `effects`

Shot có trường tùy chọn `effects`, tối đa hai hiệu ứng. Hiệu ứng vẽ trên mọi lớp của cảnh, dưới phụ đề, neo vào nhân vật được lấy nét, không có chữ.

| Id | Hình | Thời gian | Dùng khi |
|---|---|---|---|
| `flash` | Chớp trắng | 10 frame đầu shot | Phát hiện, hé lộ |
| `impact` | Vòng sóng, tia nổ, rung khung | 16 frame đầu shot (rung 10 frame) | Va chạm, rơi, sự thật gây sốc |
| `speed_lines` | Vệt tốc độ dồn về mặt nhân vật | Cả shot, mờ dần | Bất ngờ, chạy nhanh |
| `sparkle` | Sao lấp lánh quanh đầu | Cả shot | Đẹp, kỳ diệu, sạch |
| `idea` | Bóng đèn sáng bật lên trên đầu | Cả shot | Nảy ra ý tưởng, hiểu ra |
| `confetti` | Hoa giấy rơi khắp khung | Cả shot | Ăn mừng, kết vui |

- Prompt kịch bản dặn dùng hiệu ứng như điểm nhấn, khoảng một shot trên năm, và cắt đúng từ của khoảnh khắc đó.
- `fixPacing` chia shot thì chỉ phần đầu giữ hiệu ứng.

### 3. Ba góc máy mới, `approved`

| Id | Góc | Dùng khi |
|---|---|---|
| `cam_low_angle` | Máy hạ thấp: thấy nhiều trời hoặc tường phía trên, nhân vật trông lớn | Câu chốt, quyết tâm, tự hào |
| `cam_dutch` | Khung nghiêng dần tới khoảng 6 độ | Có vấn đề, nhầm lẫn, căng thẳng |
| `cam_whip` | Quét nhanh từ bên cạnh vào rồi khựng | Chuyển ý đột ngột, phản ứng bất ngờ |

- `CameraMove` có thêm `rotate` tùy chọn.
- `framing` tính vùng nhìn của khung đã xoay (`viewHalfExtents`) để không lộ mép bối cảnh.
- Lớp phủ tông ánh sáng phủ rộng hơn khung để góc nghiêng không lộ phần chưa phủ.

### 4. Danh mục kịch bản

Trần hành động trong prompt kịch bản lên 16 (trước là 12), trần góc máy lên 10 (trước là 6), để không hành động hay góc máy nào của kit bị bỏ.

### 5. Version

Motion kit `0.9.0`. `StickStory` lên `1.9.0+kit.0.9.0`.

## Hệ quả

- Kịch bản cũ không có `effects` vẫn render như trước. Kênh nào có danh mục cũ thì thấy hành động và góc máy mới ngay, vì chúng là `approved`.
- Prompt kịch bản dài thêm khoảng 9 dòng danh mục và một đoạn luật.
- Ảnh storyboard chụp ở frame giữ của shot, nên chớp trắng và vòng va chạm (chỉ ở đầu shot) không hiện trên ảnh; Director thấy chúng ở video xem trước.
- Chưa làm: cầm, nhấc đồ vật; góc qua vai; cận đặc tả đồ vật.
