# ADR-029: Bố cục khung ngang, khung minh họa hợp bối cảnh, cờ từ nguồn có sẵn, thẻ kết mới

- Trạng thái: **Accepted**. Director 2026-11-15, sau khi thử bản rộng chủ đề "Quốc gia nào dài nhất thế giới?":
  - ở bản rộng, hình quá nhỏ trong khung trắng, và khung trắng không phù hợp;
  - nhắc nước nào thì nên có cờ nước đó;
  - cảnh cuối nên sắp xếp lại bố cục Follow;
  - bản rộng nhiều diện tích hơn nên cần bố cục khác.

  Director đồng ý plan 1 → 2 → 4 → 3 và chốt: "về cờ thì lấy hình ảnh từ nguồn có sẵn, bất kỳ hình ảnh nào quá phức tạp mà AI tự vẽ không thể hiện đúng và chi tiết thì nên lấy hình từ nguồn và đưa vào".
- Ngày: 2026-11-15
- Liên quan:
  - [ADR-014](ADR-014-motion-kit-and-shot-list.md): minh họa;
  - [ADR-022](ADR-022-asset-quality-and-wide-frame.md): khung ngang;
  - [ADR-026](ADR-026-title-and-follow-outro.md): cảnh kết;
  - [ADR-028](ADR-028-channel-avatar-end-card.md): avatar kênh.

## Bối cảnh

Đo trên video Chile bản 16:9 (24 shot):

- **Hình bị ép thành dải mỏng.** Ở cỡ trung và cỡ cận, nhân vật chiếm gần hết bề ngang. Minh họa `board` lùi về dải trên đầu nhân vật, cao khoảng 200 px, nên hình chỉ còn một chấm.
- **Thẻ minh họa hẹp.** Khi có chỗ bên cạnh, minh họa là một tấm thẻ đứng hẹp.
- **Khung trắng lạc phong cách.** Tấm trắng viền nâu trông như cửa sổ dán đè, không hợp lớp học hay đồng cỏ.
- **Không có cờ.** Kho không có cờ. Claude vẽ "bản đồ Chile" bằng một dải sọc tượng trưng, người xem không nhận ra nước nào.
- **Cảnh kết chưa dùng hết khung.** Thẻ Follow ở trên, ba nhân vật nhỏ ở giữa, hai bên trống. Nền tối của thẻ nặng nề so với phong cách hoạt hình.

## Quyết định

### 1. Khung ngang có minh họa: nhân vật một nửa, minh họa một nửa

- `shotFraming(..., { reserveIllustration })` dồn nhóm nhân vật vào nửa trái khung (`ILLUSTRATION_SHARE` = 0,5).
  - Máy lùi vừa đủ cho nhóm nằm trong nửa đó.
  - Áp dụng khi shot có minh họa, ở khung ngang, không phải cỡ cận.
- Vùng minh họa bên phải:
  - rộng tới 940 px;
  - cao 70% khung (từ y = 50), nằm trên phụ đề.
- Khung dọc không đổi.
- Kiểm storyboard (`screenLayout`) dùng cùng luật.

### 2. Khung minh họa hợp bối cảnh

Minh họa `board` không còn tấm trắng viền nâu:

- **`chalk`:** dùng cho lớp học, tức bối cảnh có `classroom` hoặc `lop_hoc` trong id. Bảng phấn xanh đậm, viền gỗ, máng phấn, vệt phấn mờ.
- **`card`:** dùng cho các bối cảnh còn lại. Thẻ màu kem, viền mực đậm, nghiêng nhẹ, bóng đổ, băng dính màu nhấn.

Minh họa `scene` vẫn không có khung.

### 3. Hình phức tạp lấy từ nguồn có sẵn, bắt đầu từ cờ quốc gia

**Nguyên tắc.** Hình mà AI tự vẽ dễ sai chi tiết, và người xem đối chiếu được, thì không để Claude vẽ. Hình đó lấy từ nguồn có giấy phép rõ ràng rồi đưa vào kho như tài sản `approved` (`createdBy: "director"`).

**Cờ quốc gia:**

- **Nguồn:** 249 cờ ISO 3166-1 từ gói `flag-icons` 7.5.0, giấy phép MIT. Chép giấy phép vào `assets/LICENSE.flag-icons`; mỗi `asset.json` ghi `licenses`.
- **Sinh tài sản:** `scripts/import-flags.mts` tạo `assets/prop/flag_<mã>/` và `assets/flags.generated.ts`. Chạy lại khi nâng version gói.
- **Hình vẽ:** `flagProp` nhúng SVG gốc (data URI), thêm cột cờ và chuyển động bay: chia dải dọc lệch theo sóng, kèm bóng nếp vải.
- **Tag:** tên tiếng Việt (bảng khoảng 110 nước hay gặp; nước khác giữ tên tiếng Anh), tên tiếng Anh, "cờ …", "quốc kỳ …".
- **Danh mục kịch bản:** tag của cờ đủ điểm chỉ với tên nước một âm tiết ("Chile", "Nga"), nên brief nhắc nước nào thì cờ nước đó vào danh mục.
- **Prompt kịch bản:** nhắc tên nước thì đưa cờ nước đó vào minh họa ở shot cắt đúng tên nước. Không xin vẽ cờ mới.
- **Kiểm chất lượng:** tài sản nhập từ nguồn bỏ qua kiểm tiêu chí vẽ của ADR-022.
- **Chữ trên cờ:** vài lá cờ có chữ (Brazil, Ả Rập Xê Út…). Hình cờ giữ nguyên, coi là một phần của cờ.

**Chưa làm:** hình dáng lãnh thổ thật (bản đồ từng nước) và các hình phức tạp khác như địa danh, cơ quan cơ thể. Cần chọn nguồn và giấy phép cho từng loại.

### 4. Cảnh kết mới

- **Thẻ:** thẻ hồ sơ kênh màu kem, viền mực, nghiêng nhẹ, băng dính màu nhấn. Chữ lời mời màu mực. Avatar, nút Follow, con trỏ và "✓ Đã follow" giữ như ADR-026 và ADR-028.
- **Khung ngang:**
  - Thẻ rộng 720 px đứng bên trái, giữa chiều cao.
  - Nhân vật dồn sang phần phải: chừa trái 45%, `END_CARD_SHARE`.
  - Bối cảnh không đủ rộng để máy lùi thì lớp nhân vật tự dời, bối cảnh đứng yên.
  - Mọi người quay sang trái, chỉ về phía thẻ.
- **Khung dọc:** thẻ ở nửa trên, nhân vật bên dưới chỉ lên.

### 5. Version

Motion kit `0.11.0`. `StickStory` lên `1.12.0+kit.0.11.0`.

## Hệ quả

- **Video đang chờ Cổng 2:** bấm "Dựng lại" là có bố cục mới, khung minh họa mới và thẻ kết mới. Không tốn AI.
- **Cờ:** chỉ có ở kịch bản viết sau thay đổi này (lượt mới, hoặc "Yêu cầu sửa"), vì cờ phải nằm trong kịch bản.
- **Kích thước kho:** khoảng 2,6 MB SVG cờ nằm trong bundle Remotion. Bundle lớn hơn nhưng render không chậm đi đáng kể.
- **Danh mục `motion_assets`:** có thêm 249 hàng cờ.
