# ADR-030: Ảnh thật trong video: ảnh Director tải lên và ảnh giấy phép mở từ Wikimedia Commons

- Trạng thái: **Accepted**. Director 2026-11-15: hình phức tạp không phải cờ mà AI vẽ không rõ hoặc không đặc trưng thì đưa ảnh thật vào video; chọn làm "cả hai cách".
- Ngày: 2026-11-15
- Liên quan:
  - [ADR-017](ADR-017-auto-asset-generation.md): tài sản tự tạo;
  - [ADR-018](ADR-018-publish-kit.md): bộ đăng bài;
  - [ADR-029](ADR-029-wide-layout-boards-flags.md): nguyên tắc "hình phức tạp lấy từ nguồn", cờ;
  - [08-SECURITY](../08-SECURITY.md).

## Bối cảnh

Claude vẽ "bản đồ Chile" bằng một dải sọc màu cam: người xem không nhận ra. Địa danh, bản đồ thật, loài vật, tác phẩm nghệ thuật, sơ đồ cơ thể đều là thứ người xem đối chiếu được. Cờ đã lấy từ nguồn có sẵn (ADR-029); các hình phức tạp khác chưa có đường nào.

## Quyết định

### 1. Đồ vật "ảnh thật" (`imageProp`)

- **Hình dạng:** ảnh đặt trong khung màu kem viền mực, có băng dính màu nhấn, đứng trên giá vẽ, lắc rất nhẹ. Ảnh chụp không lạc giữa cảnh hoạt hình phẳng. Trong minh họa, khung được phóng vừa ô như mọi đồ vật.
- **Lưu trữ:** ảnh nhúng sẵn trong mã tài sản (WebP data URI), nên Remotion và storyboard vẽ như nhau.
- **Chuẩn hóa:** ảnh luôn được giải mã lại bằng ffmpeg rồi lưu (`normalizeImage`):
  - một khung, cạnh dài tối đa 900 px, WebP;
  - chỉ nhận PNG, JPEG, WebP đã sniff chữ ký.
- **Ghi vào kho:** worker ghi tài sản (`writeImageAsset`), gồm `assets/prop/photo_<…>/{index.tsx, asset.json}`, rồi đăng ký vào `generated.ts`.
  - Mã do worker viết, không do model sinh, nên không qua kiểm AST.
  - Mỗi nguồn ảnh tạo một lần, nhận diện bằng `requestKey`.
  - `asset.json` ghi `licenses` (tên giấy phép, nguồn, tác giả, URL, dòng ghi công).
- **Kiểm chất lượng:** tài sản lấy từ nguồn không chấm theo tiêu chí vẽ của ADR-022.

### 2. Cách 1: ảnh Director tải lên

- **Tải lên:** "Tài liệu tham khảo" nhận thêm ảnh PNG, JPG/JPEG, WebP, tối đa 10 MB.
  - API sniff chữ ký thật; đổi đuôi hay nội dung lạ bị từ chối.
  - SVG và GIF không nhận.
- **Nghiên cứu:** bước nghiên cứu bỏ qua ảnh, ghi lý do `image_for_video`.
- **Thành tài sản:** job kịch bản đưa ảnh vào kho trước khi viết kịch bản (`importReferenceImages`).
  - Tài sản `approved`, thuộc kênh của dự án.
  - Tag lấy từ tên file: Director đặt tên theo nội dung ảnh, ví dụ `ban-do-chile.png`.
  - Ảnh hỏng thì bỏ qua và ghi log.
- **Danh mục:** ảnh này luôn có trong danh mục của run. Prompt dặn dùng mỗi ảnh ít nhất một lần, trong minh họa ở shot nói về thứ ảnh thể hiện.

### 3. Cách 2: tự tìm trên Wikimedia Commons

- **Đánh dấu trong kịch bản:** yêu cầu tài sản `prop` có thêm `real` và `searchQuery` (2–5 từ tiếng Anh). Prompt chế độ creative dặn đặt `real: true` khi hình vẽ phẳng sẽ sai hoặc không nhận ra được:
  - bản đồ hay đường biên thật của một nước;
  - địa danh, công trình nổi tiếng;
  - loài vật, loài cây cụ thể;
  - tranh nổi tiếng, sơ đồ giải phẫu, máy móc thật.
- **Tìm ảnh (`findCommonsImage`):**
  - **Host:** chỉ gọi `commons.wikimedia.org` (API), `upload.wikimedia.org` và `thumb.wikimedia.org` (ảnh thu nhỏ). Không theo redirect; mỗi lần gọi tối đa 20 giây; ảnh tối đa 6 MB.
  - **User-Agent:** chung của công cụ, không chứa thông tin cá nhân.
  - **Giấy phép:** chỉ nhận phạm vi công cộng, CC0, CC BY, CC BY-SA. Bỏ ảnh có hạn chế (nhãn hiệu, quyền nhân thân).
  - **Định dạng:** lấy ảnh thu nhỏ PNG/JPEG do Commons render, kể cả từ SVG; không tải SVG gốc.
  - **Xếp hạng:** theo số từ khóa có trong tên file, cần khớp ít nhất một nửa, rồi theo thứ tự tìm kiếm. Tìm kiếm của Commons hay đưa ảnh phong cảnh lên trước bản đồ.
- **Dùng lại trước khi tìm:** yêu cầu `real` chỉ dùng lại tài sản lấy từ nguồn, không dùng lại hình Claude vẽ.
- **Kết quả:** tìm được thì ảnh là tài sản `candidate`; Director thấy và duyệt ở Cổng 1 như hình Claude vẽ. Không tìm được hoặc lỗi mạng thì Claude vẽ như cũ.

### 4. Ghi công

- **Mô tả YouTube và Facebook:** bộ đăng bài thêm mục "NGUỒN HÌNH ẢNH" cho mọi ảnh trong video có giấy phép yêu cầu ghi công (`imageCreditsFor`). Câu bản quyền thêm "trừ các hình ảnh ghi ở mục Nguồn hình ảnh".
- **TikTok:** chú thích TikTok ngắn, nên ghi "Ảnh từ Wikimedia Commons, ghi nguồn đầy đủ ở mô tả YouTube".

## Hệ quả

- **Ảnh có chữ:** ảnh trên Commons có thể có chữ, như sơ đồ có nhãn tiếng Anh, trái luật "không chữ trên màn hình". Director thấy ở Cổng 1 và quyết định: dùng "Làm lại một phần" để thay, hoặc tải ảnh khác lên.
- **Kích thước kho:** mỗi ảnh khoảng 30–300 KB nằm trong mã tài sản.
- **Mạng:** worker gọi Internet tới Wikimedia ở bước storyboard khi kịch bản có yêu cầu `real`.
- **Bảo mật:** đây là đường tải file từ ngoài thứ hai, sau fetch URL nghiên cứu. Mục C của tài liệu bảo mật (Director để sau) cần rà lại đường này.
- **Chưa làm:**
  - trang chọn ảnh thủ công trong nhiều ứng viên Commons;
  - lọc ảnh có chữ tự động;
  - CC BY-SA có thể đòi chia sẻ tương tự với tác phẩm phái sinh. Video hiện chỉ ghi công; Director cần cân nhắc khi đăng thương mại.
