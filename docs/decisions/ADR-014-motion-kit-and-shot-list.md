# ADR-014: Motion kit nhân vật và danh sách cảnh

- Trạng thái: Accepted (Director duyệt 2026-11-02)
- Ngày: 2026-11-02

## Bối cảnh

Video hiện là một khối hình tĩnh cho mỗi đoạn lời đọc (5–8 giây), hiện ra một lần rồi đứng yên. Director thấy hình "đơn giản" và muốn video sinh động hơn, có nhân vật (ADR-013).

Tài liệu tham khảo Director gửi ("Claude Motion & What-If Animation", Baptiste Kelano) có mấy điểm đáng học:

- nhân vật là code viết một lần, mọi tư thế và khuôn mặt là hàm của thời gian, nên giữ đồng nhất suốt video;
- nhịp cắt cảnh đo được, khoảng 27 cắt mỗi phút ở đoạn mở;
- hai cảnh liền nhau không trùng cỡ cảnh;
- render ảnh tĩnh để soát lỗi trước, sau đó mới làm chuyển động.

Trong cách của Kelano, mỗi tập Claude viết lại toàn bộ file code cảnh. Một tập mất khoảng 40 phút với gói Claude $100/tháng, và tác giả nói gói $20 sẽ hết hạn mức nhanh.

ADR-006 giữ render Remotion tại máy local, template 2D, dữ liệu vào qua `render_props`. ADR-002 giới hạn LLM ở research, script và visual.

## Quyết định

**Motion kit trong repo.** Package mới `packages/motion-kit` chứa:

- rig 2D dùng chung (góc khớp tay, chân, thân, đầu) và bộ biểu cảm khuôn mặt (ít nhất 6);
- lớp da cho từng nhân vật của kênh;
- tư thế, hành động (chuỗi tư thế có lấy đà, giữ nhịp, quá đà), bối cảnh, đồ vật, góc máy.

Mọi thứ là SVG vẽ bằng React. Đây là hàm thuần của frame: không dùng `Math.random` (thay bằng `rnd(seed, i)`), không giữ state, không gọi mạng. Mỗi tài sản có id, version và test.

**Danh sách cảnh (shot list) là dữ liệu, không phải code.** Lần gọi LLM viết kịch bản (vẫn một lần gọi, hai phương án, ADR-007) trả thêm danh sách cảnh cho mỗi phương án. Mỗi cảnh ghi:

- câu thoại được neo vào: `lineId`, và chữ để cắt cảnh;
- bối cảnh, góc máy và cỡ cảnh;
- nhân vật cùng hành động và biểu cảm;
- đồ vật, chữ trên màn hình.

Mọi id trỏ vào kho tài sản đã duyệt (ADR-016). Zod chặn id lạ. Code tính tiếp:

- frame cắt thật từ thời điểm từng chữ (alignment), cắt trước từ khóa 2 frame;
- luật nhịp theo gói thể loại: số cắt mỗi phút, cảnh tĩnh tối đa 3 giây, hai cảnh liền nhau không trùng cỡ cảnh.

Vi phạm luật nhịp được sửa bằng code nếu được (ví dụ thêm cú cắt góc khác), không được thì vào báo cáo QA.

**Template `StickStory`.** Một composition Remotion mới đọc `render_props` có danh sách cảnh đã gắn frame và vẽ bằng motion kit. `EduVertical` vẫn chạy cho gói `explainer` cũ. Version của motion kit được tính vào `templateVersion` và `content_hash`, nên đổi kit thì không dùng nhầm MP4 cũ trong cache.

**Storyboard ảnh tĩnh trước cổng script.** Sau khi LLM trả kịch bản, worker render một ảnh tĩnh cho mỗi cảnh của cả hai phương án bằng `renderStill()` (vài giây mỗi ảnh). Sau đó code tự kiểm:

- nhân vật nằm trong vùng an toàn và không bị phụ đề che;
- hai nhân vật không chồng nhau;
- chữ không tràn khung;
- đủ tương phản.

Director xem bảng storyboard cạnh lời thoại ở cổng `script`. Không thêm cổng duyệt mới; ADR-004 không đổi.

**Âm thanh hiệu ứng.** Mỗi hành động trong kho có thể kèm một SFX, đặt sau từ khóa chứ không đè lên lời. Lời đọc to hơn SFX ít nhất 3 dB. Bản export chuẩn hóa -14 LUFS. SFX phải có license ghi trong manifest (08-SECURITY, mục Media). Chưa chọn nguồn SFX.

## Phương án đã cân nhắc

- **LLM viết code cảnh cho mỗi video** (cách của Kelano). Sáng tạo nhất, nhưng tốn hạn mức Claude mỗi tập, chất lượng mỗi lần một khác. Nếu chạy trong app thì phải thực thi code do model sinh lúc render, là rủi ro bảo mật. Chỉ dùng có kiểm soát ở chế độ sáng tạo (ADR-016).
- **Ảnh hoặc video do model sinh.** Tốn phí mỗi cảnh, khó giữ nhân vật đồng nhất, chữ tiếng Việt hay sai.
- **Chỉ thêm hiệu ứng vào template hiện có** (mức 1). Vẫn làm, gộp vào `StickStory` và vào `EduVertical`, nhưng không tạo được dấu ấn nhân vật.

## Hệ quả

- ADR-002: shot list thuộc phần LLM "script và visual", không thêm vai trò. Visual job đổi từ "lấy thẳng từ script" sang dựng storyboard từ shot list.
- ADR-006 giữ nguyên. Đây vẫn là template 2D local; thêm một composition.
- [05-VIDEO-PIPELINE.md](../05-VIDEO-PIPELINE.md) có mục mới: shot list, luật nhịp, storyboard ảnh tĩnh, SFX. Mục [06-3D-UI-DESIGN.md](../06-3D-UI-DESIGN.md) cho màn duyệt kịch bản thêm bảng storyboard.
- Thời gian render tăng vì cảnh SVG chi tiết hơn và nhiều cú cắt hơn. Máy dev chỉ có CPU (i3-4005U), nên phải đo trước khi chốt mức chi tiết của bối cảnh.
- Storyboard trước cổng script thêm một job render ảnh tĩnh vào queue `render` trước `waiting_script_approval`. Cần sửa state machine và [04-AGENT-ORCHESTRATION.md](../04-AGENT-ORCHESTRATION.md).
- Gemini structured output từng từ chối object lồng nhau (ADR-007, `diagramJson`). Shot list có thể cần cách mã hóa chuỗi tương tự. Phải kiểm live trước khi chốt schema.

Liên quan: [ADR-013](ADR-013-brand-kit-and-formats.md), [ADR-015](ADR-015-multi-speaker-voice.md), [ADR-016](ADR-016-creative-mode-motion-assets.md).

## Bổ sung 2026-11-03: chỉ hoạt hình, không chữ phủ và khung bảng

- Trạng thái: **Accepted** (Director duyệt 2026-11-03). Director yêu cầu soạn cùng ngày ("Bỏ, soạn bổ sung ADR").
- Phạm vi: script `2` và template `StickStory`. Script `1` và `EduVertical` (gồm màn sửa chữ trên màn hình của P2-12) không đổi.

### Bối cảnh

Shot list ở trên có "chữ trên màn hình". Script `2` của [05-VIDEO-PIPELINE.md](../05-VIDEO-PIPELINE.md) có thêm hai trường:

- `onScreenText` ở mỗi shot;
- `board` ở mỗi cảnh: khung code hoặc sơ đồ, "vẽ lên màn hình của Bit hoặc bảng trong bối cảnh".

P6-09 vẽ cả hai thành lớp phủ: dải chữ ở đầu khung và một khung chứa code hoặc sơ đồ. Director xem fixture ngày 2026-11-03 và kết luận lớp phủ "không hợp lý", nên "bỏ hẳn ra và làm bằng hoạt hình hết". Template đã bỏ hai lớp này (P6-09, `templateVersion` `1.1.0+kit.0.1.0`). Script `2` và contracts vẫn còn hai trường, nên prompt của P6-10 sẽ bắt LLM viết thứ không được vẽ.

### Quyết định

- **Video `StickStory` chỉ có hoạt hình và phụ đề lời thoại.**
  - Không có chữ phủ màn hình, không có khung code hay sơ đồ.
  - Phụ đề theo người nói (ADR-015) là chữ duy nhất trong khung.
- **Script `2` bỏ `onScreenText` của shot và `board` của cảnh.** Zod từ chối nếu LLM vẫn trả hai trường này, nên lần repair (ADR-007) sẽ sửa.
- **Ý nội dung truyền bằng hoạt hình:**
  - lời thoại;
  - hành động, biểu cảm, cỡ cảnh;
  - đồ vật (`props`, kind `prop`) và bối cảnh trong kho.
- **Khi kịch bản cần hình minh họa mà kho chưa có** (ví dụ một sơ đồ dữ liệu chạy giữa hai máy), dùng chế độ `creative` (ADR-016) để xin một tài sản `prop` hoặc `action` mới. Tài sản đó là hoạt hình trong bối cảnh, không phải khung chữ.
- **Kiểm storyboard** `storyboard_text_overflow` và `storyboard_low_contrast` chỉ còn áp dụng cho phụ đề.

### Phương án đã cân nhắc

- **Giữ hai trường, vẽ trong thế giới** (chữ phấn trên bảng đen của `bg_classroom`, sơ đồ hiện trên màn hình mặt Bit). Hợp với "hoạt hình" hơn lớp phủ, nhưng vẫn là chữ và khối trên hình. Cần thêm API vẽ trong hệ thế giới cho motion kit. Để ngỏ: có thể làm sau thành một tài sản `prop` (ví dụ `prop_chalk_diagram`) qua kho, không phải trường riêng của script.
- **Giữ trường trong script, template bỏ qua.** Không phải sửa contracts, nhưng LLM tốn token viết thứ vô dụng, và Director sẽ sửa một trường không hiện ra ở đâu.

### Hệ quả

- **Gói `explainer` qua `StickStory`** không còn chiếu code hay sơ đồ. Chủ đề kỹ thuật cần code (ví dụ Redis) được giải thích bằng lời và hoạt hình. Nếu Director muốn video có code thật thì dùng `EduVertical` với script `1` như hiện nay.
- **Việc phải sửa sau khi duyệt** (task triển khai, không thuộc review này):
  - `packages/contracts/src/script/v2.ts`: bỏ `onScreenText`, `board`, cùng test;
  - [05-VIDEO-PIPELINE.md](../05-VIDEO-PIPELINE.md): mục Script JSON v2 (`board`, `onScreenText` của shot), mục Template `StickStory` (`scenes[].board`, `shots[].onScreenText`), mục Storyboard ảnh tĩnh (hai kiểm chữ chỉ áp cho phụ đề);
  - skill `create-motion-asset`, điểm 8 của checklist: chữ chỉ có trong phụ đề;
  - prompt P6-10: không yêu cầu hai trường này;
  - `docs/11-TASKS.md`: thêm ghi chú vào P6-10.
- **Không đổi:** ADR-004 (cổng duyệt), ADR-015 (phụ đề theo người nói), ADR-016 (kho tài sản), script `1`, `EduVertical`, route sửa script của P2-12.

## Bổ sung 2026-11-11: minh họa chỉ hình khi giải thích

Director yêu cầu: khi nhân vật giải thích, nội dung nên được vẽ ra cho dễ hình dung, hoặc trong bong bóng nghĩ trên đầu, hoặc trên bảng. Director chọn có cả hai kiểu và để LLM chọn kiểu theo từng câu.

- **Trường mới:** shot có `illustration` tùy chọn `{ style: "bubble" | "board", owner, items }`.
  - `items` là 1–3 id tài sản kind `prop`.
  - `owner` phải là nhân vật trong shot.
  - Không dùng ở cỡ `close`.
- **Vẫn giữ luật ở bổ sung 2026-11-03:** minh họa chỉ có hình đồ vật, không chữ, không code, không sơ đồ có nhãn. Object `.strict()`, nên một trường chữ trong `illustration` bị từ chối.
- **Cách vẽ** (`packages/motion-kit/src/stage/illustration.tsx`):
  - Vẽ trong hệ màn hình 1080×1920, không theo camera, để không bị mép khung cắt.
  - Vùng vẽ từ y = 150 tới trên đỉnh đầu nhân vật cao nhất, tối đa y = 820; luôn nằm trên vùng phụ đề.
  - `bubble`: đám mây với chuỗi chấm dẫn xuống đầu `owner`; đồ vật bật ra lần lượt.
  - `board`: bảng trắng viền gỗ; đồ vật hiện từ trái sang phải như đang vẽ.
  - Đồ vật cuối hiện xong ở frame 22 của shot. Ảnh storyboard chụp ở frame 24 nên thấy đủ; storyboard chụp shot có minh họa nếu cảnh có.
- **Version:** motion kit `0.4.0`, `StickStory` `1.4.0+kit.0.4.0`. MP4 cũ không bị dùng nhầm.
- **Prompt:** LLM thêm minh họa ở khoảng một shot của mỗi cảnh giải thích. Ở chế độ `creative`, thiếu hình thì được xin thêm `prop` theo ADR-017.

## Bổ sung 2026-11-12: minh họa xin đồ vật mới, diễn xuất tự động, máy quay, phụ đề theo cụm

Director 2026-11-11 duyệt các đề xuất sau khi review video "Vì sao nước biển mặn?": cảnh giải thích chỉ có nhân vật đứng nói, 27/30 shot người nghe đứng đơ, máy quay lặp mẫu, phụ đề ngắt giữa cụm từ.

- **Minh họa xin đồ vật mới.**
  - Ở chế độ `creative`, `illustration.items` được nêu thẳng id yêu cầu `rN` của một `assetRequests` kind `prop` (`ILLUSTRATION_REQUEST_IDS`). Contracts từ chối `rN` ở chế độ `standard`, hoặc khi yêu cầu không phải `prop`.
  - Worker thay `rN` bằng tài sản đã tạo. Yêu cầu chưa xong thì bỏ khỏi minh họa; minh họa không còn đồ vật thì bỏ hẳn.
  - Giới hạn: tối đa 5 yêu cầu, tối đa 3 yêu cầu không dùng cho minh họa.
- **Diễn xuất tự động** (`aliveOffset`, motion kit 0.5.0). Sau khi tư thế hoặc hành động một lần đã xong:
  - người nghe gật đầu theo chu kỳ riêng và đung đưa nhẹ;
  - người nói nghiêng đầu nhấn nhá;
  - hành động lặp không cộng thêm.
  - Test kit kiểm luật tay với lớp này ở frame 0–240.
- **Camera mới:** `cam_pull_out` (lùi máy mở cảnh), `cam_pan` (lia ngang), `cam_bump` (giật máy nhấn bất ngờ).
- **Đạo diễn máy quay bằng luật** (`directCameras`, sau `fixPacing`):
  - hoảng hốt, hoặc ngạc nhiên ở cỡ cận: giật máy, không quá một lần trong ba shot;
  - shot rộng mở cảnh đang đứng yên: lùi máy;
  - cùng kiểu máy ba shot liền: đổi kiểu.
- **Phụ đề theo cụm nghĩa** (`groupCaptionPhrases`):
  - ngắt ở dấu câu, khi đổi người nói, khi ngừng quá 450 ms, hoặc khi khung đủ khoảng 42 ký tự hay 2,6 giây;
  - câu cảm ngắn đi cùng vế sau; giữ chữ thêm 400 ms để không nháy tắt.
- **Version:** motion kit `0.5.0`, `StickStory` `1.5.0+kit.0.5.0` (kèm nhạc và SFX của ADR-019).
- **Không đổi:** không chữ trên màn hình (bổ sung 2026-11-03). Lời mời theo dõi ở cuối video là lời thoại (ADR-020).

## Bổ sung 2026-11-12 (2): thẻ chữ đầu và cuối video

- Trạng thái: **Accepted** (Director 2026-11-12).
- Ngoại lệ duy nhất của luật không chữ (bổ sung 2026-11-03):
  - thẻ tiêu đề ở 2,4 giây đầu;
  - thẻ tên kênh và lời mời theo dõi ở 3 giây cuối.
- Chi tiết ở [ADR-021](ADR-021-cards-redo-and-export.md). Mọi chỗ khác vẫn không chữ.

## Bổ sung 2026-11-12 (3): minh họa hiện trong cảnh, bỏ bong bóng nghĩ

- Trạng thái: **Accepted**. Director 2026-11-12: "bỏ khung đám mây nói chuyện ra và hiển thị khung cảnh thật xuất hiện khi nhân vật nói đến sẽ hợp lý hơn".
- **Kiểu `scene` mới** (motion kit 0.6.0):
  - Đồ vật minh họa vẽ thẳng trong khung cảnh, ở vùng trời trên đầu nhân vật, sau lưng nhân vật, không khung viền.
  - Mỗi món hiện dần khi vào shot (shot cắt đúng từ khóa đang nói), lệch nhau 6 frame, rồi lơ lửng nhẹ.
  - Ví dụ: cầu vồng mọc trên bầu trời mưa.
- **`bubble` cũ** vẫn hợp lệ cho kịch bản đã viết, nhưng vẽ như `scene`. Prompt kịch bản không dùng `bubble` nữa.
- **`board`** (bảng trắng) giữ nguyên.
- **SFX:** minh họa `scene` dùng tiếng lấp lánh thay tiếng bật.
- **Tạo hình:** vật trên trời (mặt trời, cầu vồng, mây, giọt mưa) không có chân đế hay bóng dưới đất.
- **Storyboard:**
  - chụp thêm tối đa 3 ảnh mỗi cảnh, cho các shot khác có minh họa hoặc đồ vật (`extraStills`), để ý chính ở shot sau vẫn thấy được ở Cổng 1;
  - ảnh tĩnh ghi rõ `cards: {}`, không lấy thẻ chữ của fixture.

