# ADR-021: Thẻ chữ đầu và cuối video, làm lại một phần ở Cổng 2, chuẩn bị xuất

- Trạng thái: **Accepted**. Director 2026-11-12: "hãy fix lại cho thẻ chữ mở đầu hoặc kết thúc video và làm phần chưa làm".
- Ngày: 2026-11-12
- Liên quan:
  - [ADR-014](ADR-014-motion-kit-and-shot-list.md), bổ sung 2026-11-03: không chữ trên màn hình. ADR này thêm một ngoại lệ.
  - [ADR-017](ADR-017-auto-asset-generation.md), [ADR-018](ADR-018-publish-kit.md), [ADR-019](ADR-019-audio-library.md), [ADR-020](ADR-020-director-review-tools.md).
  - Tài liệu [04](../04-AGENT-ORCHESTRATION.md), [05](../05-VIDEO-PIPELINE.md), [07](../07-API-CONTRACTS.md).

## Bối cảnh

ADR-020 để lại năm việc chưa làm và một việc chờ Director quyết:

- **Thẻ chữ đầu hoặc cuối video.** Việc này trái với quyết định "không chữ trên màn hình" ngày 2026-11-03. Ngày 2026-11-12 Director chọn có thẻ.
- **Làm lại một phần.** Ở Cổng 2, muốn đọc lại một câu hay đổi một nền thì Director phải bấm "Yêu cầu sửa". Lệnh đó viết lại cả kịch bản: tốn token, dễ đổi cả những chỗ đã ổn.
- **Ảnh bìa.** Bộ đăng bài chưa có ảnh bìa.
- **Tên kênh.** Bộ đăng bài ghi "Kênh mặc định" khi Director chưa đặt tên kênh.
- **Kho hình động.** Kho không cho biết tài sản nào đang có trong video nào.
- **Độ to.** Video ở khoảng -19,5 LUFS. YouTube, TikTok và Facebook chuẩn hóa về khoảng -14 LUFS, nên video nghe nhỏ hơn video khác.

## Quyết định

### 1. Thẻ chữ đầu và cuối video

Đây là ngoại lệ duy nhất của luật "không chữ trên màn hình" (ADR-014, bổ sung 2026-11-03). Luật vẫn giữ cho mọi chỗ khác:

- shot không có `onScreenText`;
- minh họa chỉ có hình;
- lời mời theo dõi vẫn là lời thoại (ADR-020).

`render_props` của `StickStory` 1.6.0 có trường tùy chọn `cards`:

- `intro.title`: tiêu đề của phương án đã duyệt. Tối đa 80 ký tự, một dòng.
  - Thẻ hiện ở 2,4 giây đầu (72 frame), phần trên khung hình.
  - Thẻ bật ra bằng spring, rồi mờ dần.
- `outro.channel` và `outro.cta`:
  - `channel` là tên kênh. Giá trị là null khi kênh chưa đặt tên, lúc đó thẻ chỉ có lời mời.
  - `cta` cố định "Theo dõi để xem tiếp nhé!", hiện dạng nút đỏ nhịp nhẹ.
  - Thẻ hiện ở 3 giây cuối (90 frame).
  - Video ngắn hơn hai thẻ cộng lại thì bỏ thẻ cuối.

Cả hai thẻ phủ lên hoạt hình:

- không kéo dài video;
- không đổi audio hay phụ đề;
- không che phụ đề, vì phụ đề ở đáy khung.

Worker dựng `cards` bằng `titleCards()` ở job render. Không gọi LLM.

### 2. Làm lại một phần ở Cổng 2

**Route.** `POST /api/workflow-runs/:runId/redo` chỉ nhận run đang `waiting_final_approval`. Body là một trong bốn loại:

| `kind` | Việc | Run sang |
|---|---|---|
| `revoice` + `sceneId` | Đọc lại mọi câu của cảnh: bỏ cache TTS của các câu đó, TTS lấy mẫu lại. Bản mới ghi đè chỉ mục cache. | `producing_assets` (chỉ job voice) |
| `background` + `sceneId` + `backgroundId` | Đổi bối cảnh của mọi shot trong cảnh. Bối cảnh mới phải có trong `motion_assets`. | `preview_rendering` |
| `regenerate_asset` + `assetId` + `note` | Claude Code tạo lại một đồ vật hoặc bối cảnh đang có trong video, theo mô tả cũ cộng ghi chú. Không dùng lại tài sản có sẵn. Hình mới là `candidate`, thay hình cũ trong cả video. | `preview_rendering` |
| `rerender` | Dựng lại props từ dữ liệu mới nhất, ví dụ sau khi đặt tên kênh. | `preview_rendering` |

**Thứ tự trong route:**

1. Kiểm yêu cầu theo `render_props` mới nhất.
2. Ghi file `artifacts/<run>/redo/<redoId>.json`.
3. Trong một transaction: đổi trạng thái run và tạo đúng một job.
   - Key job là key thường thêm `:redo:<redoId>`, cùng approval kịch bản mới nhất: `voice:<run>:approval:<a>:redo:<id>` hoặc `render:<run>:approval:<a>:redo:<id>`.
   - Transaction lỗi thì xóa file yêu cầu.

**Chuỗi job:**

- Job voice của lần đọc lại xong thì tạo job render cùng `redoId`.
- Job render:
  - với `regenerate_asset`, gọi Claude Code một lần và ghi `<redoId>.result.json`, để lần chạy lại không gọi Claude lần nữa;
  - dựng props, rồi áp **mọi** lần đổi nền và tạo lại hình sau approval kịch bản, theo thứ tự thời gian, nên lần sau không làm mất lần trước;
  - render, chạy QA, rồi trả run về Cổng 2.

**Ràng buộc:**

- Không ghi approval.
- Lệnh `redo` là nhóm cạnh riêng trong state machine, giống hủy và resume. Sơ đồ chính không đổi.
- Lỗi thì run `failed` với `resume_from` như job thường.
- Tạo lại hình không thành: video giữ hình cũ, metadata `render_props.redo` ghi lỗi, web báo.
- Cổng 2 chỉ tạo lại `prop` và `background`. `action` và `pose` cần kiểm rig ở Cổng 1.

### 3. Tên kênh trước lần xuất đầu

**Sửa tên kênh.** `PUT /api/brand-profile/contact` nhận thêm `displayName`. Trang "Bộ nhận diện kênh" có ô tên kênh.

**Chặn xuất.** Route approval trả 409 khi run duyệt bản cuối mà kênh của run vẫn tên "Kênh mặc định" (tên seed) hoặc rỗng:

- `code` là `conflict`;
- `details.reason` là `channel_name_required`.

Web khóa nút duyệt và đưa link sang trang kênh.

Kiểm ở route, không ở `recordApproval`, vì chỉ route ghi approval.

**Video dựng trước khi đặt tên.** Thẻ cuối của video đó thiếu tên kênh. Panel "Làm lại một phần" gợi ý bấm "Dựng lại".

### 4. Ảnh bìa

Job export cắt một khung JPEG ở giây 1,2 của bản xuất, lúc thẻ tiêu đề đã hiện rõ:

- file ở `artifacts/<run>/thumbnail-<hash>.jpg`;
- metadata `thumbnailKey` của artifact `export` trỏ tới file đó.

`GET /api/artifacts/:id/thumbnail` chỉ trả file ghi trong metadata của đúng artifact `export`, trong thư mục của run. Lỗi ảnh bìa không làm hỏng bản xuất.

### 5. Kho: dùng trong video nào

`GET /api/motion-assets/usage` đọc `render_props` mới nhất của mỗi run và liệt kê tài sản có trong video. Tài sản gồm:

- nền, máy quay, đồ vật, minh họa;
- skin, hành động, biểu cảm.

Kho có bộ lọc theo video và "Chưa dùng". Mỗi thẻ tài sản ghi số video dùng nó.

### 6. Độ to -14 LUFS

Sau khi Remotion ghi MP4 (cả preview lẫn export), worker chạy `loudnorm` hai lượt:

- đích I = -14 LUFS, TP = -1,5 dBTP, LRA = 11, chỉnh tuyến tính;
- mã hóa lại audio AAC 192 kbps 48 kHz, chép nguyên hình.

Chuẩn hóa ở cả preview để Director nghe đúng độ to sẽ đăng. File im lặng thì giữ nguyên.

## Hệ quả

- Video có tiêu đề ở đầu, tên kênh và lời mời ở cuối.
- Ảnh bìa có tiêu đề.
- Sửa nhỏ ở Cổng 2 không tốn token, trừ tạo lại hình (một lượt Claude Code).
- Mọi bản dựng lại vẫn qua QA và chờ Director duyệt.
- Đổi `templateVersion` sang `1.6.0+kit.0.5.0`. Cache MP4 cũ không được dùng lại, vì video mới có thẻ và đã chuẩn hóa độ to.
- Hình tạo lại ở Cổng 2 giữ trạng thái `candidate` trong Kho. Prompt `standard` chưa chọn hình đó cho video sau.
