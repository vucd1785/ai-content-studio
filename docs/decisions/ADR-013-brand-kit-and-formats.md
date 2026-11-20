# ADR-013: Bộ nhận diện kênh và gói thể loại

- Trạng thái: Accepted (Director duyệt 2026-11-02)
- Ngày: 2026-11-02

## Bối cảnh

[00-VISION.md](../00-VISION.md) giới hạn sản phẩm ở "video giáo dục ngắn về kỹ thuật phần mềm". Ngày 2026-11-02, Director muốn kênh có dấu ấn riêng: nhân vật, tính cách, thế giới, âm thanh nhận diện. Director cũng muốn làm nội dung ngoài giáo dục, ví dụ giải trí, "Nếu như…?" hay tiểu phẩm.

Template hiện có (`EduVertical`, `EduLight`) chỉ có khối chữ và sơ đồ, không có nhân vật. Video sản xuất hàng loạt mà giống nhau dễ bị nền tảng hạ phân phối. Một bộ nhận diện riêng giúp tránh điều đó.

Director đã xem bản phác ba nhân vật vẽ bằng code và chọn dùng cả ba.

## Quyết định

**Phạm vi nội dung.** Sản phẩm làm video dọc ngắn nhiều thể loại. Giáo dục kỹ thuật vẫn là một thể loại, không còn là giới hạn. Vẫn giữ: một Director, local-first, tiếng Việt, hai cổng duyệt (ADR-004).

**Bộ nhận diện kênh (brand kit).** Một kênh là một bản ghi `brand_profiles`, Director định nghĩa một lần:

- Dàn nhân vật. Mỗi nhân vật có lớp da trong motion kit (ADR-014), tính cách, vai, giọng đọc (ADR-015), động tác và câu cửa miệng đặc trưng.
- Bảng màu, font, thẻ mở đầu và kết thúc, bộ âm thanh nhận diện.
- Quy tắc giọng điệu, đưa vào prompt kịch bản.

Mỗi project chọn một kênh. Kênh đầu tiên dùng dàn ba nhân vật (tên tạm, Director đổi được):

| Nhân vật | Vai | Lời thoại |
|---|---|---|
| Tí, người que nâng cấp, khăn quàng cam | Nhân vật chính, đại diện người xem | Có |
| Bit, robot màn hình, cùng bảng màu robot studio 3D (`apps/web/src/studio/robot.tsx`) | Người giải thích, đưa dữ kiện có nguồn | Có |
| Đậu, hạt đậu có mầm lá | Bạn đồng hành, tạo tiếng cười | Không. Chỉ biểu cảm và âm thanh |

Một cảnh có tối đa hai nhân vật. Đủ ba nhân vật chỉ dùng ở thẻ mở đầu, kết thúc hoặc thẻ nhận diện.

**Gói thể loại (format pack).** Mỗi thể loại là một định nghĩa có version trong `packages/contracts`. Một gói gồm:

- các nhịp kịch bản theo thứ tự, ví dụ "Nếu như…?": mở giữa hành động, tiền đề, phần vui, sự thật có nguồn, cú lật;
- dàn nhân vật mặc định;
- tham số nhịp: số cắt mỗi phút, độ dài cảnh tĩnh tối đa;
- có cần bước research hay không;
- quy tắc QA riêng.

Lát cắt đầu có hai gói: `explainer` (tương đương luồng hiện tại) và một gói giải trí do Director chọn, đề xuất là "Nếu như…?". Thêm gói sau đó là thêm dữ liệu, không thêm service.

**Sự thật và hư cấu.**

- Mọi câu khẳng định là sự thật phải có nguồn trong research, ở mọi thể loại.
- Gói hư cấu được tắt research, nhưng khi đó kịch bản không được có nhịp "sự thật".
- QA chặn duyệt cuối nếu nhịp sự thật thiếu nguồn.

## Phương án đã cân nhắc

- **Giữ phạm vi giáo dục, chỉ thêm nhân vật.** Ít việc hơn, nhưng không đáp ứng yêu cầu mở rộng thể loại của Director.
- **Một nhân vật duy nhất.** Đơn giản hơn, nhưng Director đã chọn cả ba. Rig dùng chung (ADR-014) nên chi phí thêm nhân vật thấp.
- **Nhân vật do model ảnh hoặc model video sinh ra.** Bị loại: tốn phí mỗi cảnh, khó giữ nhân vật đồng nhất, đi ngược ADR-006.

## Hệ quả

- Sửa [00-VISION.md](../00-VISION.md) và [01-PRD.md](../01-PRD.md): phạm vi nội dung, bước chọn kênh và thể loại trong brief.
- Migration: thêm `brand_profiles`; thêm `brand_profile_id` và `format_id` cho project hoặc brief. Cập nhật [03-DATABASE-DESIGN.md](../03-DATABASE-DESIGN.md).
- Schema kịch bản chia theo thể loại: các nhịp khác nhau, có trường người nói (ADR-015). `schemaVersion` tăng lên `2`; script `1` vẫn đọc và render được bằng `EduVertical`.
- Prompt kịch bản nhận tính cách, giọng điệu và câu cửa miệng của kênh. Đây vẫn là một lần gọi trả về hai phương án (ADR-007).
- Thời lượng brief tùy theo gói. Ràng buộc 30–90 giây trong DB phải nới, cần migration.

Liên quan: [ADR-014](ADR-014-motion-kit-and-shot-list.md), [ADR-015](ADR-015-multi-speaker-voice.md), [ADR-016](ADR-016-creative-mode-motion-assets.md).

## Bổ sung 2026-11-03: Đậu có lời thoại, ba nhân vật trong khung rộng

- Trạng thái: **Accepted** (Director duyệt 2026-11-03, gồm cả cỡ `high`). Director yêu cầu soạn ngày 2026-11-03 sau lần chạy thật đầu tiên trên web: "thêm giọng đậu là quỳnh anh", "có thể có cả 3 trong 1 khung hình"; chọn "Soạn bổ sung ADR" và "Chỉ cỡ wide".
- Phạm vi: script `2`, template `StickStory`, kênh mặc định. Script `1` và `EduVertical` không đổi.

### Bối cảnh

Bảng dàn nhân vật ở trên ghi Đậu "Không. Chỉ biểu cảm và âm thanh". [ADR-015](ADR-015-multi-speaker-voice.md) mục Quyết định ghi Zod chặn Đậu làm `speaker`. Câu "Một cảnh có tối đa hai nhân vật" làm `shots[].actors` của script `2` có tối đa 2 phần tử, và cách mã hóa `flat` (P6-01) chỉ có `actor1`, `actor2`.

Director muốn Đậu nói bằng giọng "Quỳnh Anh" (giọng mẫu VieNeu có sẵn) và muốn thấy cả ba trong một khung.

Motion kit đã đủ phần cần cho cả hai:
- Đậu dùng chung rig mặt (`Face`), nên miệng mở theo khoảng nói như Tí và Bit.
- Sân khấu có ba vị trí `left`, `center`, `right` (x = 310, 540, 770).
- Ở cỡ `medium` hai người, người thứ hai đã có lúc bị mép khung cắt (report P6-10, P6-17). Ba người ở cỡ này chắc chắn bị cắt.

### Quyết định

- **Đậu là nhân vật có lời thoại.**
  - Kênh mặc định đặt `speaks = true` cho Đậu. Giọng do Director chọn: "Quỳnh Anh".
  - Vai không đổi: bạn đồng hành tạo tiếng cười. Prompt kịch bản yêu cầu câu của Đậu ngắn (vài từ), ít hơn Tí và Bit, không đưa dữ kiện.
  - Câu khẳng định sự thật vẫn thuộc Bit hoặc người dẫn và phải có nguồn (mục Sự thật và hư cấu ở trên).
- **Nhân vật nói hay không do cột `speaks` của kênh quyết định, không cố định theo tên.**
  - Zod của script `2` vẫn chặn nhân vật có `speaks = false`.
  - Câu "Nhân vật không nói (Đậu)" của ADR-015 đổi thành "Nhân vật có `speaks = false`". Còn lại ADR-015 giữ nguyên: giọng theo kênh, đọc theo câu, phụ đề theo người nói. Đậu có màu phụ đề riêng từ bảng màu kênh.
- **Ba nhân vật trong một khung chỉ ở cỡ `wide` và `high`.**
  - `shots[].actors` tối đa 3 khi `shotSize` là `wide` hoặc `high`, tối đa 2 ở `medium` và `close`. Zod kiểm tra theo cỡ.
  - Ba người đứng ở `left`, `center`, `right`; hai người giữ cách đặt hiện tại.
  - Mã hóa `flat` thêm `actor3`, vẫn trong 2 tầng mảng của P6-01.
  - Kiểm storyboard `storyboard_overlap` và `storyboard_unsafe_area` áp cho mọi cặp nhân vật.
- **Thay câu "Một cảnh có tối đa hai nhân vật…"** bằng quy tắc trên. Thẻ mở đầu, kết thúc của kênh vẫn có thể có cả ba.

### Phương án đã cân nhắc

- **Ba người ở mọi cỡ khung.** Bị loại: `medium` hai người đã bị cắt mép, ba người thì `close` không còn ý nghĩa.
- **Đậu chỉ "nói" bằng âm thanh không lời.** Đúng ADR cũ, nhưng không đáp ứng yêu cầu của Director, và kho SFX có license (P6-12) vẫn chưa có.
- **Thêm một nhân vật dẫn chuyện thứ tư.** Không cần: gói `what_if` không có người dẫn, và Director muốn Đậu nói.

### Hệ quả

- **Việc phải làm sau khi duyệt** (triển khai, không thuộc review này):
  - DB `studio`: Đậu `speaks = true`, `voice_id` "Quỳnh Anh". Director đã chọn giọng trong chat, nên agent không tự chọn.
  - `packages/contracts/src/script/v2.ts`: giới hạn `actors` theo cỡ khung; test.
  - Worker `llm/script-v2-prompt.ts`: `actor3` trong schema `flat` và `decodeFlatScriptV2`; luật câu ngắn cho Đậu; luật ba người chỉ ở `wide`, `high`.
  - Builder props `StickStory` (`build-stick-story-props.ts`): đặt ba người vào ba vị trí, giữ vị trí liên tục giữa các shot.
  - Storyboard checks: chạy cho ba người.
  - Màn duyệt kịch bản v2: nhãn màu cho Đậu.
  - [05-VIDEO-PIPELINE.md](../05-VIDEO-PIPELINE.md) mục Script JSON v2 (`speaker`, `actors`); [04-AGENT-ORCHESTRATION.md](../04-AGENT-ORCHESTRATION.md) đoạn `actor1`/`actor2`; ADR-015 câu về Đậu; `docs/11-TASKS.md` ghi chú vào P6-17.
- **Run cũ không bị ảnh hưởng.** Kịch bản đã duyệt có tối đa 2 người mỗi shot và Đậu không nói, vẫn hợp lệ theo luật mới.
- **Thời gian đọc giọng tăng** theo số câu của Đậu. Câu ngắn và có cache TTS nên tăng ít.
- **Không đổi:** ADR-004, ADR-014 (motion kit, shot list, storyboard trước cổng; bổ sung chỉ hoạt hình), ADR-016, script `1`, `EduVertical`.

## Bổ sung 2026-11-03 (2): một đường hoạt hình, bỏ script `1`, bỏ chọn thể loại

- Trạng thái: **Accepted** (Director duyệt 2026-11-03). Director yêu cầu ngày 2026-11-03: "bỏ v1 đi, tui muốn dùng v2 thôi… v2 sẽ áp dụng cho tất cả… nên ko cần chọn loại". Director đã chọn: xóa hẳn code script `1`; một khung chung cho mọi chủ đề; thời lượng 30–90 giây.
- Phạm vi: toàn bộ luồng tạo video. Thay phần "Gói thể loại" ở mục Quyết định và các câu "script `1` vẫn đọc và render được bằng `EduVertical`" ở mục Hệ quả của ADR này, cùng các câu "Script `1` và `EduVertical` không đổi" ở bổ sung 2026-11-03 của [ADR-014](ADR-014-motion-kit-and-shot-list.md).

### Bối cảnh

Hiện brief chọn thể loại:
- "Giải thích" (`explainer`) đi script `1` và template `EduVertical`: một giọng đọc, chữ phủ, khung code, sơ đồ.
- "Nếu như…?" (`what_if`) đi script `2` và template `StickStory`: Tí, Bit, Đậu nói chuyện; chỉ có hoạt hình và phụ đề.

Hai đường dùng chung research, cổng duyệt, QA, export. Mọi khâu khác tách đôi: prompt, schema, voice, render props, template, màn duyệt, màn sửa kịch bản.

Director đã xem cả hai, chỉ muốn đường hoạt hình, và không muốn nó gắn với kiểu "Nếu như…?". DB `studio` không còn run nào dùng script `1` (đã xóa dự án cũ ngày 2026-11-03).

### Quyết định

- **Một đường duy nhất: script `2` và template `StickStory`** cho mọi run mới. Script `1`, template `EduVertical` và code chỉ phục vụ chúng bị xóa:
  - prompt và schema script `1`;
  - nhánh `v1` của visual, voice, render, QA, export;
  - route và màn sửa kịch bản `1` (P2-12);
  - `caption_override` của `EduVertical` (P1-08);
  - fixture và test tương ứng.
- **Brief không còn ô thể loại.** Mọi brief dùng một gói chung `story` v1 "Hoạt hình":

  | Nhịp | Nội dung | Cần nguồn |
  |---|---|---|
  | `cold_open` | Mở ngay vào tình huống | Không |
  | `premise` | Đặt vấn đề hoặc câu hỏi | Không |
  | `play` | Diễn giải bằng tình huống vui | Không |
  | `fact` | Sự thật có nguồn | Có |
  | `payoff` | Cú chốt | Không |

  - Không có người dẫn (`allowNarrator: false`): Tí, Bit, Đậu nói hết lời thoại.
  - Research bắt buộc.
  - Thời lượng 30–90 giây.
  - Nhịp: 20–27 cú cắt mỗi phút, shot đứng yên tối đa 3 giây, hai shot liền nhau không cùng cỡ khung.
- **Giữ cơ chế gói thể loại trong `packages/contracts`.** Thêm thể loại sau vẫn là thêm dữ liệu, nhưng giao diện chỉ hiện ô chọn khi có từ hai gói dùng được.
  - Gói `explainer` bị xóa, vì nó chỉ chạy được bằng script `1`.
  - Gói `what_if` giữ lại để đọc brief và run cũ đã lưu. Brief mới không chọn được gói này.
- **Không đổi:**
  - mọi luật của script `2`: dàn nhân vật, bổ sung 2026-11-03 về Đậu và ba người;
  - storyboard trước cổng (ADR-014), giọng theo người nói (ADR-015);
  - cổng duyệt (ADR-004), Remotion local (ADR-006), alignment (ADR-005, 011, 012);
  - chế độ `creative` (ADR-016).

### Phương án đã cân nhắc

- **Chỉ ngừng dùng script `1`, để nguyên code.** Ít rủi ro hơn, nhưng mỗi khâu còn hai nhánh phải bảo trì và test. Director chọn xóa hẳn.
- **Cho `explainer` chạy bằng script `2`, vẫn giữ ô chọn thể loại.** Director không muốn chọn loại.
- **Không có khung nhịp, LLM tự sắp.** Linh hoạt hơn nhưng khó kiểm luật nhịp và nguồn. Director chọn một khung chung.

### Hệ quả

- **Mất tạm khả năng sửa kịch bản trên web.** Màn sửa của P2-12 chỉ có cho script `1`. Sửa câu của script `2` thuộc P6-11. Trong lúc chờ, Director chỉ duyệt một phương án, hoặc từ chối kèm ghi chú để viết lại.
- **Không còn video có code thật hay sơ đồ.** Nội dung kỹ thuật được giải thích bằng lời thoại và hoạt hình (đã ghi ở bổ sung ADR-014).
- **DB:**
  - cột `briefs.format_id` có mặc định `'explainer'`, cần migration đổi mặc định sang `'story'`;
  - enum trạng thái run giữ nguyên (`storyboarding` đã có);
  - artifact `caption_override` không còn được tạo.
- **Việc phải làm sau khi duyệt** (triển khai, mở task mới P6-18):
  - contracts: gói `story`, bỏ `explainer`, bỏ schema script `1` khỏi đường tạo mới, test;
  - API: brief không nhận `formatId` từ client, luôn ghi `story`; xóa route sửa kịch bản `1`;
  - web: bỏ ô "Thể loại", màn duyệt và sửa script `1`, player `EduVertical`;
  - worker: bỏ nhánh `v1` ở script, visual, voice, render, QA, export; `usesScriptV2` luôn đúng;
  - video: xóa `EduVertical` và fixture;
  - docs 00, 01, 04, 05, 07, 09, 10, 11; README ADR.
  - Các task đã xong của Phase 1–5 không mở lại. P6-18 ghi rõ phần nào của chúng bị xóa.
- **Report cũ** (P1-04, P1-08, P2-12, P5-03…) vẫn mô tả code script `1` như lúc đó. Không sửa report cũ.

## Bổ sung 2026-11-09: gói `story` v2, nhịp chậm hơn, video dài hơn, font phụ đề

- Trạng thái: **Accepted** (Director duyệt 2026-11-09).
  - Director yêu cầu sau khi xem video DDoS: "font chữ khó nhìn… chuyển cảnh hơi nhanh tui muốn chậm lại một chút… ko nhất thiết video phải ngắn".
  - Director đã chọn: font Be Vietnam Pro; 12–18 cú cắt mỗi phút, shot đứng yên tối đa 5 giây; thời lượng 30–180 giây.
- Phạm vi: thay các con số "Thời lượng 30–90 giây" và "Nhịp: 20–27 cú cắt mỗi phút, shot đứng yên tối đa 3 giây" của bổ sung 2026-11-03 (2) cho brief mới. Câu "cảnh tĩnh tối đa 3 giây" ở ADR-014 hiểu theo gói đang dùng.

### Quyết định

- **Gói `story` v2 "Hoạt hình"** là `DEFAULT_FORMAT` của brief mới. Năm nhịp, dàn nhân vật, research và không người dẫn giữ như v1. Hai thứ đổi:
  - thời lượng 30–180 giây;
  - nhịp 12–18 cú cắt mỗi phút, shot đứng yên tối đa 5 giây, hai shot liền nhau vẫn không cùng cỡ khung.
- **Gói `story` v1 giữ nguyên** để đọc brief và run đã lưu, giống `what_if`. Không cần migration: CHECK của DB đã là 10–600 giây.
- **Phụ đề `StickStory` dùng font Be Vietnam Pro.**
  - File TTF (giấy phép SIL OFL 1.1) nằm trong `apps/video`, render không cần mạng và lần nào cũng như nhau.
  - Font chữ của brand kit là font dự phòng.
  - Chữ to và đậm hơn, nền phụ đề đậm hơn. Từ đang đọc được gạch chân thay vì đổi độ đậm, nên dòng chữ không xô lệch.

### Hệ quả

- Video dài nhất 3 phút, render khoảng 20 phút trên máy dev (đo P6-19: khoảng 6,7 giây máy cho mỗi giây video).
- Gemini nhận số shot theo nhịp mới qua prompt sẵn có; builder chia shot dài hơn 5 giây.
- Template `StickStory` lên version mới nên cache không dùng lại MP4 cũ.
