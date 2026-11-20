# ADR-032: Ảnh thật từ mọi nguồn trên web, khung ảnh không giá vẽ, dấu hỏi nhỏ, trang phục nhân vật, thẻ tiêu đề dưới đáy

- Trạng thái: **Accepted**. Director 2026-11-19 sau khi xem kịch bản các chủ đề SpaceX, NVIDIA, Anthropic, điện năng AI.
- Ngày: 2026-11-19
- Liên quan:
  - [ADR-030](ADR-030-real-images.md): ảnh thật. Thay mục 1 (giá vẽ, cạnh 900 px) và mở rộng mục 3 (nguồn ảnh).
  - [ADR-025](ADR-025-acting-effects-camera.md): hiệu ứng theo shot; thêm `question`.
  - [ADR-026](ADR-026-title-and-follow-outro.md), [ADR-021](ADR-021-cards-redo-and-export.md): thẻ tiêu đề; đổi vị trí.
  - [ADR-017](ADR-017-auto-asset-generation.md), [ADR-023](ADR-023-depth-layers-and-scene-lighting.md): tự tạo bối cảnh.
  - [ADR-007](ADR-007-llm-adapter.md): client Claude Code; thêm một lần gọi có công cụ `WebSearch`.
  - [08-SECURITY](../08-SECURITY.md).

## Bối cảnh

Director xem các kịch bản đang chờ Cổng 1 và nêu bảy điểm:

1. Ảnh trong khung đứng trên giá gỗ trông thừa; ảnh nhỏ.
2. Ảnh chỉ lấy từ Wikimedia Commons nên nhiều chủ đề (tên lửa SpaceX, chân dung người nổi tiếng) không có ảnh tốt. Director muốn lấy từ bất kỳ nguồn nào có ảnh rõ, chất lượng tốt nhất, miễn hợp chủ đề và kịch bản.
3. Một số kịch bản dùng đồ vật "dấu chấm hỏi khổng lồ"; nên thay bằng dấu hỏi nhỏ trên đầu nhân vật đang hỏi.
4. Người nổi tiếng (Elon Musk, Jensen Huang…) nên hiện bằng ảnh thật.
5. Bối cảnh nên tạo mới khi cần cho hợp chủ đề và kịch bản; chỉ dùng lại khi thật sự hợp, để các video không nhàm.
6. Nhân vật có thể "hóa thân" bằng trang phục khi câu chuyện cần (ra ngoài không gian thì mặc đồ phi hành gia), thay vì hiện một bộ đồ phi hành gia rời.
7. Thẻ tiêu đề ở màn đầu che hình tượng trưng và bối cảnh phía sau.

## Quyết định

### 1. Khung ảnh không giá vẽ, ảnh to hơn

- `imageProp` bỏ giá vẽ. Khung kem viền mực đặt thẳng trên mặt đất, lắc rất nhẹ quanh đáy.
- Bổ sung 2026-11-20 (Director): bỏ băng dính màu nhấn ở mép trên của khung ảnh và của thẻ kem minh họa (`card`). `MOTION_KIT_VERSION` 0.12.1.
- Khung đứng trên sàn: ảnh tối đa 130 × 200 (trước 210 × 170, cộng giá vẽ). Bề ngang giới hạn để khung không rộng hơn một chỗ đứng. Trong minh họa, khung phóng vừa ô; bỏ giá vẽ nên ảnh chiếm gần hết ô thay vì khoảng hai phần ba, tức là to hơn rõ rệt.
- `normalizeImage` giữ cạnh dài tối đa 1280 px (trước 900 px) để ảnh phóng to vẫn nét.
- Mọi ảnh thật đã có trong kho đổi theo, vì mã tài sản gọi `imageProp` của kit.

### 2. Ảnh từ mọi nguồn trên web (Director chọn "bất kỳ trang web nào")

- **Thứ tự tìm** cho yêu cầu `real`:
  1. Tìm trên web.
  2. Không được thì Wikimedia Commons như ADR-030.
  3. Không được nữa thì Claude vẽ.
- **Tìm trang:** một lần gọi Claude Code chỉ bật công cụ `WebSearch` (không `WebFetch`, không Bash, không file). Claude trả tối đa 5 trang, xếp theo độ rõ và đúng chủ đề:
  - ưu tiên trang chính thức, bộ ảnh báo chí, bách khoa, báo lớn;
  - ảnh chính của trang phải đúng thứ cần hiện;
  - có thể kèm URL ảnh trực tiếp nếu kết quả tìm kiếm có.
- **Lấy ảnh:** worker tự tải trang và ảnh bằng fetch chặn SSRF như research:
  - mọi host công khai được phép;
  - chặn địa chỉ private, loopback, link-local, metadata; nối đúng địa chỉ đã kiểm;
  - tối đa 3 redirect, 15 giây; trang đọc tối đa 2 MB đầu, ảnh tối đa 8 MB.
  - Ảnh của trang là `og:image`, `og:image:secure_url`, `twitter:image` hoặc `link rel=image_src`.
  - Chỉ nhận PNG, JPEG, WebP đã sniff chữ ký, rồi chuẩn hóa bằng ffmpeg như ADR-030.
  - Ảnh có cạnh dài dưới 600 px bị bỏ.
- **Giấy phép:** ảnh web thường có bản quyền. `asset.json` ghi:
  - `name` = "Chưa rõ giấy phép, bản quyền thuộc chủ sở hữu";
  - `source` = tên miền;
  - `url` = trang;
  - `attribution` = "Ảnh: <tiêu đề trang> (<URL trang>)".
  - Bộ đăng bài đưa dòng này vào mục "NGUỒN HÌNH ẢNH" như ảnh Commons.
- **Chi phí:** mỗi yêu cầu `real` thêm một lần gọi Claude Code có tìm kiếm, tính vào `usage_records` của vai `visual`. Không tính vào trần lượt gọi của run.

### 3. Chân dung người nổi tiếng

- Yêu cầu tài sản có thêm `person: true` khi hình là một người có thật. `searchQuery` khi đó là họ tên đầy đủ kèm "portrait".
- Prompt kịch bản: khi một câu nói về một người nổi tiếng có thật, hiện người đó bằng ảnh thật trong minh họa ở shot nhắc tên. Không dựng nhân vật kênh đóng vai người thật.
- Commons: với `person: true`, nhận ảnh có hạn chế quyền nhân thân (`personality`). Vẫn bỏ ảnh có hạn chế nhãn hiệu và mọi hạn chế khác. Director chấp nhận vì video giải thích, không dùng ảnh để quảng cáo hay ngụ ý người đó ủng hộ.

### 4. Dấu hỏi nhỏ trên đầu nhân vật

- Hiệu ứng mới `question`: dấu "?" nhỏ màu vàng viền mực bật ra trên đầu nhân vật được lấy nét, nhún nhẹ suốt shot. Đây là hình, không phải chữ, nên không phạm luật "không chữ trên màn hình".
- Prompt: shot có nhân vật đặt câu hỏi hoặc thắc mắc thì dùng `question` và lấy nét vào người hỏi. Không xin và không dùng đồ vật dấu hỏi, dấu chấm than hay ký hiệu to.
- Tài sản `prop_dau_cham_hoi_a9c2` chuyển về `candidate`: không còn trong danh mục kịch bản mới; video cũ vẫn vẽ được.

### 5. Bối cảnh hợp chủ đề

- Prompt kịch bản: mỗi cảnh đặt ở nơi câu chuyện thật sự diễn ra.
  - Bối cảnh trong danh sách chỉ dùng khi đúng nơi đó.
  - Không có thì xin bối cảnh mới (`kind: background`), mô tả nơi chốn theo chủ đề (bãi phóng tên lửa, phòng máy chủ, trụ sở công ty…).
  - Video nên có ít nhất một bối cảnh riêng của chủ đề, trừ khi danh sách đã có bối cảnh đúng.
- Bối cảnh mới vẫn theo ADR-023 (ba lớp) và ADR-022 (tiêu chí chất lượng); trần yêu cầu tài sản mỗi kịch bản giữ 8 (ADR-027).

### 6. Trang phục nhân vật

- Mỗi diễn viên trong shot có `outfit` tùy chọn:
  - `spacesuit`: đồ phi hành gia, mũ kính, ba lô;
  - `lab_coat`: áo blouse trắng;
  - `hard_hat`: mũ bảo hộ, áo phản quang;
  - `business_suit`: vest, cà vạt.
- Kit vẽ trang phục đè lên da của nhân vật (`applyOutfit`). Dáng, tay, mặt và kiểm tay-khuỷu không đổi, nên Tí, Đậu, Bit đều mặc được.
- Prompt: chỉ mặc khi câu chuyện cần để rõ nghĩa (ra ngoài không gian, trong phòng thí nghiệm, công trường, đóng vai lãnh đạo công ty). Giữ cùng trang phục cho nhân vật đó trong suốt cảnh. Không xin đồ vật "bộ đồ phi hành gia" rời khi nhân vật có thể mặc.

### 7. Thẻ tiêu đề dưới đáy

- Thẻ tiêu đề ở đầu video nằm ở vùng phụ đề dưới đáy khung. Lúc này phụ đề của cảnh đọc tiêu đề đã bị bỏ theo ADR-026. Hình tượng trưng và bối cảnh phía trên không bị che.
- Nền thẻ trong hơn (0,78), chữ 62 px ở khung dọc, 54 px ở khung ngang.
- Thẻ kết giữ nguyên.

## Hệ quả

- **Bản quyền:** ảnh lấy từ web có thể có bản quyền. Video đăng YouTube có thể bị khiếu nại hoặc bị gỡ. Director chọn hướng này và duyệt từng ảnh ở Cổng 1 ("Làm lại một phần" để thay). Mục "NGUỒN HÌNH ẢNH" ghi nguồn nhưng không thay cho giấy phép.
- **Bảo mật:** đây là đường tải file từ host bất kỳ đầu tiên của worker. Có chặn SSRF như research, nhưng không có allowlist host. Mục C của 08-SECURITY (Director để sau) cần rà lại đường này cùng ADR-030.
- **Claude Code có công cụ:** lần gọi tìm ảnh bật `WebSearch`, khác cờ "không công cụ" của các lần gọi khác (ADR-007). Prompt chỉ chứa mô tả hình, không chứa dữ liệu riêng.
- **Phiên bản:** `MOTION_KIT_VERSION` 0.12.0 và `STICK_STORY_BASE_VERSION` 1.13.0, vì hình đổi (khung ảnh, thẻ tiêu đề) nên cache render cũ không dùng lại.
- **Kịch bản đã viết** trước thay đổi không có `outfit`, `question`, `person`. Muốn áp dụng thì dùng "Yêu cầu sửa" ở Cổng 1 hoặc chạy lại run.
- **Chưa làm:**
  - chọn ảnh thủ công trong nhiều ứng viên;
  - kiểm ảnh có chữ hay logo;
  - thêm trang phục ngoài bốn bộ trên (thêm sau theo cùng cách).
