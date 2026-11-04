# Spike P6-03: chi phí render cảnh nhân vật SVG

Ngày: 2026-11-02. Người làm: Claude Opus 5.5. Task: [P6-03](../11-TASKS.md). ADR: [ADR-014](../decisions/ADR-014-motion-kit-and-shot-list.md).

## Câu hỏi

Máy dev chỉ có CPU, render một video có hai nhân vật SVG, nhịp khoảng 20 cú cắt mỗi phút, ở các mức chi tiết bối cảnh khác nhau thì mất bao lâu? Mức chi tiết nào nên làm mặc định cho motion kit (P6-05)?

## Cách đo

- **Máy:** Intel i3-4005U, 4 luồng, 7,9 GB RAM, không GPU. Remotion 4.0.539, `renderMedia()` H.264, concurrency mặc định. Trong lúc đo không chạy việc nặng nào khác. Container `tts` đang bật nhưng không có job.
- **Nội dung:** 30 giây, 900 frame, 10 cảnh mỗi cảnh 3 giây (20 cắt mỗi phút). Cỡ cảnh luân phiên rộng, trung, cận, góc cao; camera đẩy vào nhẹ trong mỗi cảnh. Tí và Bit (từ [bản phác](../design/characters/sheet.html)) nói qua lại: miệng mấp máy theo frame, chớp mắt, thở, chuyển tư thế có quá đà trong 10 frame đầu cảnh. Có hộp phụ đề.
- **Ba mức bối cảnh:**
  1. Nền phẳng: tường, sàn, một đường chân tường.
  2. Phòng phối cảnh một điểm tụ: tường, sàn ván, cửa sổ, kệ sách, tranh, bàn, đèn bàn, chậu cây. Khoảng 20 hình.
  3. Mức 2 thêm khoảng 20 hình (thảm, ghế, đồng hồ, cốc, chồng sách, dây điện), bóng tiếp xúc, vệt nắng và quầng đèn bằng gradient, tấm che tối góc toàn khung, 30 hạt bụi bay, tiền cảnh mờ bằng `feGaussianBlur`.
- **Biến thể "mức 3 không blur":** bỏ `feGaussianBlur` để tách chi phí của bộ lọc.
- **Bản nền:** template `EduVertical` hiện tại với `render_props` thật của run `4c15d3bb` (26 giây, bỏ audio).

Code: `apps/video/src/spikes/p6-03/` (entry riêng, không đăng ký vào workflow). Đầu ra: `data/spikes/p6-03/`.

Lệnh chạy lại, từ `apps/video`, qua `scripts/with-node24.ps1`:

```powershell
node src/spikes/p6-03/render-cost.mjs stills
node src/spikes/p6-03/render-cost.mjs full <đường dẫn render_props.json của run>
node src/spikes/p6-03/render-cost.mjs noblur
```

## Kết quả

| Bản | Thời gian render | Giây render mỗi giây video | So với bản nền | Dung lượng MP4 |
|---|---|---|---|---|
| `EduVertical` (bản nền, 26 s) | 110,7 s | 4,26 | 1,00× | 1,3 MB |
| Mức 1 | 136,7 s | 4,56 | 1,07× | 7,9 MB |
| Mức 2 | 168,1 s | 5,60 | 1,31× | 10,9 MB |
| Mức 3 | 257,4 s | 8,58 | 2,01× | 14,1 MB |
| Mức 3 không blur | 245,0 s | 8,17 | 1,92× | — |

- **Ảnh tĩnh** (`renderStill`): 1,9–3,6 giây mỗi ảnh. Ảnh đầu tiên của mỗi lượt chậm hơn (5,8 s) do khởi động.
- **Bundle:** khoảng 80 giây khi chạy lần đầu (cache lạnh), 13–16 giây những lần sau.
- **ffprobe** cả 5 file: `h264`, 1080×1920, `30/1`; 900 frame (bản nền 780).

Ước tính cho một video 60 giây trên máy này, chỉ tính render, chưa tính TTS:

| Mức | Thời gian |
|---|---|
| Mức 1 | khoảng 4,6 phút |
| Mức 2 | khoảng 5,6 phút |
| Mức 3 | khoảng 8,6 phút |

Preview và export render riêng, nên mỗi run tốn gấp đôi các số trên.

Ước tính cho bảng storyboard trước cổng script (ADR-014): 2 phương án × 12 cảnh = 24 ảnh tĩnh × khoảng 2,5 giây ≈ 1 phút, cộng thời gian bundle.

## Nhận xét

- Chỉ thêm nhân vật động vào nền phẳng (mức 1) thì chậm hơn template hiện tại khoảng 7%. Riêng nhân vật và nhịp cắt nhanh không tốn đáng kể.
- Phòng phối cảnh với khoảng 20 hình (mức 2) chậm hơn bản nền khoảng 31%. Đây là mức hợp lý.
- Mức 3 tốn gấp đôi bản nền. Blur chỉ chiếm khoảng 5% chênh lệch. Phần còn lại có thể đến từ các lớp gradient trong suốt phủ toàn khung (tấm che tối góc, vệt nắng, quầng đèn) và bụi đổi vị trí mỗi frame, vốn làm khung hình khó nén hơn: file MP4 to gần gấp đôi mức 1. **Đây là suy đoán, chưa đo tách từng yếu tố.**
- Hình mức 3 đẹp rõ rệt so với mức 2: có chiều sâu và nguồn sáng thấy được, đúng tinh thần tài liệu tham khảo.

## Lỗi soát được trên ảnh tĩnh

Soát theo cách "render ảnh tĩnh rồi kiểm":

- **Dải đen ở đáy khung** ở cảnh rộng và góc cao, do camera nhìn quá mép dưới căn phòng. Đã sửa: kéo dài sàn ra ngoài khung.
- **Tay vẫy của Tí trông như gãi đầu**, vì bàn tay nằm sát mép đầu. Chưa sửa trong spike; ghi lại cho P6-05: góc vẫy phải mở rộng hơn, có test vị trí bàn tay.

Ảnh: `data/spikes/p6-03/stills/L{1,2,3}-f{45,135,315,585,675}.png`.

## Đề xuất cho P6-05

**Director chốt 2026-11-02: mức 2 là mặc định.**

1. **Mặc định là mức 2,** cộng có chọn lọc các yếu tố rẻ của mức 3: bóng tiếp xúc, quầng đèn cục bộ, vài đồ vật thêm.
2. Tấm che tối toàn khung, bụi bay và blur tiền cảnh là **tùy chọn theo cảnh**, chỉ dùng cho cảnh cần không khí. Shot list ghi cờ cho các cảnh này.
3. P6-05 đo tách từng yếu tố của mức 3 (tấm che, vệt nắng, bụi), mỗi yếu tố một lần render, để biết yếu tố nào đáng giá.
4. Chưa đo, nhưng nên thử ở P6-09: render preview ở nửa độ phân giải (tùy chọn `scale` của Remotion) để rút ngắn thời gian preview. Export vẫn full HD.
