# Giao diện và studio 3D

Studio 3D để giám sát và chọn vai trò. Soạn thảo, duyệt, log và video nằm trên panel 2D (ADR-009). Mọi thứ vẽ ra lấy từ `agent_runs` và `events` đã mô tả ở [04-AGENT-ORCHESTRATION.md](04-AGENT-ORCHESTRATION.md).

Bản thiết kế tham chiếu (Director duyệt hướng 2026-11-01): canvas "AI Content Studio — giao diện mới" gồm 5 màn hình. Khi mockup và tài liệu này lệch nhau, tài liệu này thắng; dữ liệu mẫu trong mockup chỉ để minh họa.

## Nguyên tắc

- Việc cần Director nổi lên trước. Mọi chỗ chờ Director quyết định dùng màu "chờ bạn" (vàng), ở danh sách dự án, thanh tiến trình và studio.
- Mỗi màn một việc chính. Nút quyết định nằm ở thanh cố định cuối màn, không rải trong nội dung.
- Một màu nhấn cho hành động chính mỗi màn. Các nút còn lại viền mảnh.
- Chỉ vẽ trạng thái đã lưu. Không có phần trăm cho job LLM, không có timer giả (ADR-009). Thời gian hiện ra là thời gian đã chạy thật cộng khoảng ước tính có ghi rõ "ước tính".

## Token thiết kế

Dùng chung cho 2D và studio 3D:

| Vai trò | Màu |
|---|---|
| Nền trang | `#0f1115` |
| Mặt thẻ | `#171a21`, viền `#262a33` |
| Chữ chính / phụ / mờ | `#e8e9ec` / `#9aa0aa` / `#7d8390` |
| Nhấn (hành động chính, đang chạy) | `#5b78ff`, chữ trên nền nhấn tối `#0b0d12` |
| Hoàn tất | `#3fb27f` |
| Chờ bạn | `#e7a33e` |
| Lỗi | `#e5534b` |
| Rảnh / tắt | `#4a4f5a` |

Chữ: Be Vietnam Pro (400, 500, 600), cỡ chữ thân 14–15 px, tiêu đề màn 24 px. Bo góc: thẻ 12–14 px, nút và ô nhập 8–10 px. Vùng bấm tối thiểu 36 px, nút chính 44 px.

## Khung ứng dụng

- Thanh trên (56 px): logo, đường dẫn `AI Content Studio / <dự án>`, chấm trạng thái worker, đăng xuất.
- Trang dự án là trang riêng: số liệu tóm tắt (chờ bạn duyệt, máy đang chạy, đã xuất, token), khối "Cần bạn xử lý" dạng thẻ có khung 9:16, rồi danh sách mọi dự án với trạng thái từng dự án.
- Trong một dự án: cột trái hẹp (220–240 px) là danh sách dự án gần đây với chấm trạng thái; vùng giữa là màn của bước hiện tại. Không còn cột phải cố định.
- Thanh tiến trình bảy bước nằm dưới tiêu đề dự án ở mọi màn trong dự án: nghiên cứu, viết kịch bản, bạn duyệt kịch bản, giọng và hình, render và QA, bạn duyệt bản cuối, xuất video. Mỗi ô ghi trạng thái (xong, đang chạy, chờ bạn, lỗi, đã dừng, chưa tới) và thời gian (thời gian thật nếu đã chạy, ước tính nếu chưa). Hai ô của Director có viền đứt màu vàng, không ước tính.

## Năm màn hình

| Màn | Khi nào mở | Nội dung chính | Thanh quyết định |
|---|---|---|---|
| Brief và bắt đầu | Chưa có run hoặc run trước đã dừng | Form brief (thời lượng là thanh kéo 30–90 giây), tài liệu tham chiếu kéo-thả; thẻ "Bắt đầu lượt chạy": chọn model, ước tính từng chặng | Nút "Bắt đầu lượt chạy" trong thẻ |
| Đang chạy | Máy đang làm (`researching` … `exporting`) | Studio 3D là khối chính; thẻ bước đang chạy; nhật ký hoạt động; chi phí | Nút "Hủy lượt chạy" trên tiêu đề |
| Duyệt kịch bản | `waiting_script_approval` | Hai phương án xếp thẳng hàng theo cảnh; đầu mỗi cột: tiêu đề, hook, số từ, thời gian đọc ước tính | Ghi chú + Từ chối, Yêu cầu sửa, Duyệt phương án 1, Duyệt phương án 2 |
| Duyệt bản cuối | `waiting_final_approval` | Video trong khung điện thoại, chọn bản; checklist QA của đúng bản đó; thông tin bản; lịch sử quyết định | Ghi chú + Từ chối, Yêu cầu sửa, Duyệt và xuất (khóa khi QA có lỗi) |
| Đã xuất | `exported` | Như duyệt bản cuối, thanh dưới là "Tải MP4" | Tải MP4 |

Run lỗi: màn đang chạy, ô lỗi trên thanh tiến trình màu đỏ, thẻ bước đang chạy thành thẻ lỗi có `failure_code` và nút "Chạy lại bước lỗi".

### Phase 6: kênh, thể loại, storyboard, kho hình động

Nguồn: [ADR-013](decisions/ADR-013-brand-kit-and-formats.md), [ADR-014](decisions/ADR-014-motion-kit-and-shot-list.md), [ADR-015](decisions/ADR-015-multi-speaker-voice.md), [ADR-016](decisions/ADR-016-creative-mode-motion-assets.md). Task P6-11. Mọi chữ tiếng Việt.

- **Brief và bắt đầu.** Form brief thêm chọn kênh (mặc định kênh `is_default`) và chọn thể loại. Thanh kéo thời lượng lấy khoảng `durationSec` của gói. Thẻ "Bắt đầu lượt chạy" thêm lựa chọn chế độ: "Chuẩn" (`standard`) và "Sáng tạo" (`creative`), kèm một dòng giải thích chế độ sáng tạo cần Director mở phiên Claude Code để tạo tài sản mới.
- **Thanh tiến trình.** Ô "viết kịch bản" gồm cả `storyboarding`; nhãn phụ "đang vẽ storyboard" khi ở trạng thái đó. Không thêm ô mới, vẫn bảy bước.
- **Duyệt kịch bản (script `2`).** Mỗi cảnh hiển thị ảnh storyboard 9:16 bên cạnh các câu thoại. Mỗi câu có nhãn người nói (tên và màu nhân vật). Director sửa chữ từng câu; đổi người nói chọn trong danh sách nhân vật nói của kênh. Vấn đề kiểm tự động (`issues[]`) hiện dưới ảnh dạng chip vàng; `errors[]` của job hiện ở đầu cột, không khóa nút duyệt. Ảnh có tài sản tạm mang nhãn "chờ tài sản mới". Script `1` giữ màn như cũ.
- **Màn "Kênh".** Sửa tên hiển thị nhân vật, tính cách, câu cửa miệng, quy tắc giọng điệu. Giọng của mỗi nhân vật nói và giọng người dẫn chọn từ danh sách service TTS trả về, có nút nghe thử một câu mẫu. Không có ô gõ tên giọng tự do.
- **Màn "Kho hình động".** Lưới thẻ tài sản có ảnh xem trước, lọc theo loại, kênh, trạng thái (`candidate`, `approved`) và người tạo. Thẻ `candidate` có nút duyệt. Danh sách yêu cầu tài sản `open` của từng run, mỗi yêu cầu chỉ sang tài sản đã đáp ứng nếu có. Duyệt tài sản không phải quyết định của workflow, không dùng màu vàng của cổng duyệt.
- **Duyệt bản cuối, run `creative`.** Khi mọi yêu cầu của run đã có tài sản `approved`, thanh quyết định có thêm nút "Dựng lại với tài sản mới" (gửi `changes_requested` theo cạnh `waiting_final_approval → preview_rendering` của [04-AGENT-ORCHESTRATION.md](04-AGENT-ORCHESTRATION.md)).

Studio 3D không đổi ở Phase 6: robot vẫn là nhân vật của vai trò, không dùng dàn nhân vật kênh. Avatar chỉ vẽ trạng thái đã lưu.

## Studio 3D

### Vị trí

Studio là khối chính của màn "Đang chạy", rộng hết vùng giữa, cao khoảng 420–460 px, bên phải là khung chi tiết vai trò (260–300 px). Ở các màn duyệt và brief, studio không hiện: lúc đó không có gì chuyển động và chỗ thuộc về nội dung cần đọc.

Studio có hai nút: "Hiệu năng thấp" và "Ẩn studio". Ẩn studio thì các phần 2D của màn vẫn đủ dùng (thẻ bước, nhật ký, danh sách vai trò trong khung chi tiết).

### Cảnh

- Canvas isometric nền `#0b0d12`, sàn hình thoi `#12151c` viền `#262a33`, hai đường chéo mờ chia sàn.
- Bàn Director ở tâm, lớn hơn các bàn khác, màn hình viền vàng, nhãn "Bạn · Director". Bàn Director không có đèn trạng thái.
- Bảy bàn vai trò xếp quanh tâm theo thứ tự quy trình, bắt đầu từ trên trái và đi theo chiều kim đồng hồ: Nghiên cứu, Kịch bản, Hình ảnh, Giọng đọc, Dựng video, Kiểm tra; Điều phối ở dưới trái, gần lối vào. Thứ tự này khớp thanh tiến trình nên mắt đi một vòng là đọc được luồng.
- Mỗi bàn: mặt bàn isometric, một màn hình nhỏ, một robot, đèn trạng thái trên đầu, nhãn tên và trạng thái dưới bàn. Hình học dựng bằng code; không có nhân vật rig, physics hay gói asset bên ngoài (ADR-009). Nhân vật 3D anime có rig là hướng phát triển sau, Director tự mở khi sẵn sàng (quyết định 9, handoff).
- Camera `OrthographicCamera` góc isometric, orbit giới hạn góc nghiêng và zoom, không lật xuống dưới sàn.

### Robot của từng vai trò

Mục tiêu: đẹp nhất có thể trong giới hạn hình dựng bằng code. Mỗi robot là một nhân vật nhỏ dễ thương, nhận ra được vai trò chỉ bằng dáng và đồ vật.

Chung cho mọi robot:

- Tỉ lệ chibi: đầu lớn (khoảng 45% chiều cao), thân bo tròn, tay và chân ngắn dạng viên nang. Khớp vai, khuỷu và cổ là các nhóm `Object3D` lồng nhau để xoay được (khung xương dựng bằng code, không phải rig từ file).
- Mặt là một màn hình phẳng trên đầu, vẽ bằng `CanvasTexture` sinh trong code: hai mắt và miệng phát sáng. Biểu cảm đổi theo trạng thái (bảng dưới). Chớp mắt ngẫu nhiên 3–6 giây một lần khi rảnh hoặc đang chạy.
- Vật liệu toon (`MeshToonMaterial` với gradient 3 bậc) và viền mảnh tối (`Outlines` của drei) để ra chất hoạt hình. Thân màu kem `#e9e4da`, phần khớp than chì `#3a4157`, mỗi vai trò thêm một màu riêng ở phụ kiện.
- Ánh sáng: một đèn bán cầu dịu, một đèn chính chéo trên tạo bóng mềm, bóng tiếp xúc dưới chân (`ContactShadows`). Chế độ hiệu năng thấp bỏ đèn chính có bóng và bóng tiếp xúc.

| Vai trò | Dáng và phụ kiện | Màu riêng | Khi đang chạy |
|---|---|---|---|
| Điều phối | Cầm bảng kẹp hồ sơ, ăng-ten hình cờ nhỏ | Than chì `#5f6b85` | Lật trang bảng kẹp, quay đầu nhìn các bàn |
| Nghiên cứu | Kính lúp trong tay, chồng sách trên bàn | Xanh ngọc `#1f9a8c` | Đưa kính lúp qua lại trên trang sách |
| Kịch bản | Bút lông cầm tay, cuộn giấy trên bàn | Tím `#7f77dd` | Viết, cuộn giấy dài ra từng nấc |
| Hình ảnh | Bảng vẽ và bảng màu | San hô `#d85a30` | Vẽ trên bảng, màn hình bàn đổi màu |
| Giọng đọc | Tai nghe to và micro đứng | Hồng `#d4537e` | Miệng trên màn mặt mở khép theo nhịp, vòng sóng nhỏ quanh micro |
| Dựng video | Máy quay nhỏ trên chân, băng phim | Xanh lam `#378add` | Máy quay xoay chậm, đèn ghi hình đỏ nhấp nháy |
| Kiểm tra | Kính tròn, danh sách có dấu tích | Xanh lá `#639922` | Đánh dấu từng dòng trên danh sách |

Bàn Director không có robot: là ghế đạo diễn có chữ "Bạn", loa cầm tay và màn hình viền vàng. Khi có cổng chờ duyệt, ghế sáng viền vàng và có biển "Chờ bạn duyệt".

### Biểu cảm theo trạng thái

| `agent_runs.status` | Mắt và miệng (màn mặt) | Dáng |
|---|---|---|
| `idle` | Mắt tròn, miệng cười nhẹ | Đứng, thở nhẹ |
| `queued` | Mắt tròn nhìn sang bàn trước | Đứng chờ, gõ chân |
| `running` | Mắt tập trung (nửa vầng), miệng thẳng | Động tác làm việc của vai trò |
| `waiting_approval` | Mắt nhìn về bàn Director | Giơ biển "Chờ bạn duyệt" |
| `completed` | Mắt cười cong `^ ^` | Giơ tay một lần rồi về đứng yên |
| `failed` | Mắt `x x`, màn mặt viền đỏ | Vai chùng, đầu cúi |
| `cancelled` | Màn mặt tắt | Đứng yên, xám mờ |

### Ánh xạ trạng thái

| `agent_runs.status` | Đèn | Robot và bàn | Nhãn dưới bàn |
|---|---|---|---|
| `idle` | Tắt `#4a4f5a` | Màu xám, màn hình tối | Rảnh |
| `queued` | Vàng mờ, nhấp nháy chậm | Xám | Đang chờ |
| `running` | Xanh `#5b78ff` kèm vòng sáng | Robot sáng màu, màn hình viền xanh sáng, mặt bàn ánh xanh | Đang chạy · thời gian đã chạy |
| `waiting_approval` | Vàng `#e7a33e` | Biển "Chờ bạn duyệt" trên bàn | Chờ bạn |
| `completed` | Xanh lá `#3fb27f` | Robot màu trung tính, đứng yên | Hoàn tất |
| `failed` | Đỏ `#e5534b` | Màn hình viền đỏ | Lỗi · `error_code` |
| `cancelled` | Tắt | Xám mờ | Đã hủy |

Dưới canvas có chú giải năm màu: hoàn tất, đang chạy, chờ bạn duyệt, lỗi, rảnh.

### Tooltip và khung chi tiết

- Rê chuột lên robot: tooltip nhỏ cạnh robot (nền `#1b2340`, viền nhấn) ghi tên vai trò, trạng thái và câu từ event cuối.
- Click robot (hoặc chọn trong danh sách 2D): khung chi tiết bên phải hiện vai trò, queue, đã chạy bao lâu, ước tính, lần thử, vài event gần nhất, và ghi chú riêng nếu có (ví dụ máy không GPU nên TTS chậm). Click bàn Director mở màn duyệt nếu đang ở cổng.
- Bàn phím: Tab đi qua danh sách vai trò 2D; chọn ở đó cũng đổi robot được chọn trên canvas.

### Tiến độ

Job LLM phát event `started`, `validated`, `completed`, `failed`. Không phát phần trăm.

Job media phát `job.progress` chuẩn hóa `{done, total, unit}` (P3-17): voice đếm bước đọc lời và căn chữ của từng cảnh (`unit: "scene_step"`, kèm `sceneIndex`, `sceneCount`, `phase`), render và export đếm frame (`unit: "frame"`). Thanh tiến trình hiện phần trăm từ số đếm này. Trước P3-17, job render dự kiến phát các field mà callback `onProgress` của `renderMedia()` cung cấp, trong đó có số frame và `progress` do Remotion tính từ frame. Studio chỉ vẽ thanh tiến độ trên bàn Dựng video khi payload có các field đó.

TTS kiểu một response WAV không có mức âm từng chunk. Robot Giọng đọc ở `running` cho đến event hoàn tất kèm duration ffprobe. Sóng âm chỉ xuất hiện khi payload có mốc chunk thật.

## Chuyển động và hiệu năng

- Chuyển động được phép, đều tắt khi `prefers-reduced-motion` (khi đó robot đứng yên ở tư thế của trạng thái, biểu cảm màn mặt vẫn đổi):
  - động tác làm việc riêng của từng vai trò (bảng ở trên), thở nhẹ khi rảnh, chớp mắt;
  - chuyển giữa hai động tác pha trộn trong khoảng 250 ms, không giật;
  - màn hình bàn đang chạy nhấp nháy dịu;
  - đèn `queued` nhấp nháy chậm;
  - một nhịp phóng to ngắn (khoảng 300 ms) khi trạng thái đổi;
  - camera trượt nhẹ về phía bàn vừa chuyển sang `running`, chỉ khi người dùng không đang xoay.
- Không có chuyển động trang trí khi studio rảnh: không xoay camera tự động, không hạt, không glow lan.
- Chế độ hiệu năng thấp: `dpr` bằng 1, tắt shadow, tắt mọi animation lặp.
- Query dữ liệu nằm ngoài vòng `useFrame`. Canvas đọc snapshot từ store, không gọi API mỗi frame. Không gắn timer giả để robot tự sang `completed`.
