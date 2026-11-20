# ADR-023: Bối cảnh ba lớp chiều sâu, tông ánh sáng theo cảnh

- Trạng thái: **Accepted**. Director 2026-11-12 đưa video mẫu ("Animator vs. Animation 14") và chọn làm hai việc đầu trong danh sách cải thiện: chiều sâu bối cảnh và ánh sáng theo cảnh.
- Ngày: 2026-11-12
- Liên quan:
  - [ADR-014](ADR-014-motion-kit-and-shot-list.md): motion kit, shot list;
  - [ADR-017](ADR-017-auto-asset-generation.md): tự tạo tài sản;
  - [ADR-022](ADR-022-asset-quality-and-wide-frame.md): tiêu chí chất lượng, khung ngang;
  - tài liệu [05](../05-VIDEO-PIPELINE.md).

## Bối cảnh

Video mẫu có ba thứ mà studio chưa có:

- bối cảnh nhiều lớp, có tiền cảnh che mép khung và hậu cảnh lùi xa;
- mỗi cảnh một tông màu theo cảm xúc (đỏ khi nguy hiểm, xanh đêm khi yên tĩnh), có nguồn sáng;
- nhân vật phẳng nổi trên nền nhiều chi tiết. Điểm này studio đã có.

Bối cảnh của kit là một tấm phẳng. Camera lia hay đổi cỡ cảnh thì cả tấm trượt cùng nhau, nên hình trông dẹt. Nhân vật và bối cảnh luôn cùng một màu ở mọi cảnh.

Video mẫu vẽ tay từng khung, bối cảnh 3D. ADR này chỉ lấy ngôn ngữ hình ảnh, không sao chép nhân vật hay cảnh của video đó.

## Quyết định

### 1. Bối cảnh ba lớp

`BackgroundAsset` thêm hai lớp tùy chọn:

| Lớp | Vẽ gì | Thứ tự | Trượt theo camera |
|---|---|---|---|
| `Far` | Trời, mây, núi xa; trong nhà là tường sau | Sau cùng, phủ kín `bounds` | Chậm hơn (hệ số 0,3) |
| `Component` | Mặt đất, cây, đồ đạc, nơi nhân vật đứng; phần trên để trống | Giữa | Dính vào thế giới |
| `Near` | Vài bóng tiền cảnh ở hai góc dưới (cỏ, lá, góc bàn) | Trước nhân vật | Nhanh hơn (hệ số -0,45), kit làm mờ |

- Độ lệch của một lớp là `(tâm camera - mốc) × hệ số`. Mốc là giữa bối cảnh, ở tâm khung cỡ rộng. Ở mốc, các lớp nằm đúng chỗ đã vẽ.
- Lớp xa trượt ít hơn camera nên vùng nhìn không bao giờ ra ngoài vùng lớp đó đã vẽ. Test kiểm điều này với mọi cỡ cảnh, mọi chuyển động máy, hai khung hình.
- Bối cảnh một lớp cũ không có `Far`, `Near` và vẽ y hệt trước.
- `bg_meadow` (đồng cỏ) là bối cảnh ba lớp làm tay, `approved`, dùng làm mẫu trong prompt tạo bối cảnh thay cho `bg_room`.

**Bối cảnh tự tạo.** Prompt dặn Claude Code vẽ ba lớp và xuất `{ stage, Far, Component, Near }`. Bộ tiêu chí của ADR-022 thêm tiêu chí "ba lớp". Hệ quả theo đúng luật của ADR-022: bối cảnh tự tạo cũ (một lớp) không được dùng lại cho yêu cầu mới, mà được vẽ lại.

**Danh mục tối thiểu.** Prompt kịch bản luôn có ít nhất ba bối cảnh gốc thay vì hai: lớp học, phòng, đồng cỏ. Trước đó chỉ có hai bối cảnh trong nhà.

### 2. Tông ánh sáng theo cảnh

Shot có trường tùy chọn `mood`:

| Giá trị | Dùng khi | Hình |
|---|---|---|
| `day` | Ban ngày sáng | Quầng nắng nhẹ góc trên trái |
| `warm` | Hoàng hôn, ấm cúng, kỷ niệm vui | Phủ cam, quầng nắng vàng |
| `cool` | Mưa, trời u ám, suy nghĩ | Phủ xanh xám |
| `night` | Đêm, yên tĩnh, vũ trụ | Phủ xanh đậm, quầng trăng, viền tối |
| `danger` | Vấn đề, cảnh báo, căng thẳng | Phủ đỏ, quầng đỏ từ dưới đập theo nhịp, viền tối |
| `wonder` | Khám phá, ý chính | Phủ tím sang xanh ngọc, quầng sáng giữa khung đập chậm |

- Lớp phủ dùng kiểu trộn `multiply`. Bối cảnh bị phủ đậm, nhân vật và đồ vật bị phủ nhạt hơn nên vẫn nổi.
- Quầng sáng dùng kiểu trộn `screen`, vẽ trên cùng.
- Không có `mood` thì vẽ như trước.
- Kịch bản chọn `mood` cho từng shot. Prompt dặn giữ một tông trong một cảnh và đổi tông ít nhất một lần trong video.
- `mood` đi từ kịch bản tới render props, nên ảnh storyboard và video cùng tông.
- Bối cảnh mới được dặn vẽ màu ban ngày trung tính, vì kit phủ tông lên trên.

### 3. Version

Motion kit `0.8.0`. `StickStory` lên `1.8.0+kit.0.8.0`, nên cache MP4 cũ không dùng lại.

## Hệ quả

- Run cũ và kịch bản cũ không có `mood` vẫn render như trước.
- Chiều sâu chỉ thấy ở bối cảnh ba lớp: `bg_meadow` và bối cảnh tự tạo từ nay. `bg_room`, `bg_classroom` và sáu bối cảnh tự tạo cũ vẫn là một lớp. Tông ánh sáng thì áp cho mọi bối cảnh.
- Tiền cảnh dùng bộ lọc mờ, tốn thêm thời gian render mỗi khung. Chưa đo trên video đầy đủ.
- Giao diện Cổng 1 chưa hiện tên tông của từng shot. Director thấy tông qua ảnh storyboard.
- Chưa làm trong ADR này: hành động và tương tác đồ vật, nhịp dựng, lớp hiệu ứng, góc máy mới.
