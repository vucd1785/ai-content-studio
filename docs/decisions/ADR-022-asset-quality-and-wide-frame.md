# ADR-022: Tiêu chí chất lượng hình tự tạo, khung ngang 16:9 để thử

- Trạng thái: **Accepted**. Director 2026-11-12 yêu cầu ba việc:
  - thêm vai trò "nhà tạo video hoạt hình chuyên nghiệp" vào prompt gửi Claude Code;
  - đặt tiêu chí cho kết quả; hình cũ đạt tiêu chí thì dùng lại, không tốn token, chưa đạt thì tạo mới như thường;
  - thêm lựa chọn khung hình để thử khung rộng.
- Ngày: 2026-11-12
- Liên quan:
  - [ADR-017](ADR-017-auto-asset-generation.md): tự tạo tài sản, ngưỡng dùng lại theo tag;
  - [ADR-014](ADR-014-motion-kit-and-shot-list.md): motion kit, khung 1080×1920;
  - [ADR-021](ADR-021-cards-redo-and-export.md): thẻ chữ, phụ đề;
  - tài liệu [05](../05-VIDEO-PIPELINE.md), [07](../07-API-CONTRACTS.md).

## Bối cảnh

Director thấy hình sự vật, hiện tượng chưa đẹp và chưa sinh động. Ba lỗi cụ thể:

- mặt trời đứng trên cột, có bóng dưới đất;
- giọt mưa có bóng đất;
- hình phẳng, ít chi tiết.

Có hai nguyên nhân:

- Prompt tạo hình chỉ nói về API và nét viền, không nói thế nào là đẹp.
- Luật dùng lại chỉ so tag. Một hình khớp tag là được dùng lại mãi, kể cả khi hình đó xấu.

Studio chỉ có khung dọc 1080×1920. Director muốn thử khung ngang cho YouTube thường.

## Quyết định

### 1. Vai trò trong prompt tạo hình

`GENERATION_SYSTEM_INSTRUCTION` mở đầu bằng `GENERATION_ROLE`: họa sĩ chính kiêm đạo diễn hoạt hình 2D của một studio làm video giáo dục cho trẻ 6–12 tuổi. Prompt thêm cách làm của người làm nghề:

- dáng rõ, tỷ lệ tròn trịa dễ thương;
- nguồn sáng từ trên bên trái;
- chuyển động có gia tốc và dư âm.

Vai trò chỉ chỉnh giọng. Phần đo được nằm ở mục 2.

### 2. Tiêu chí chất lượng

`apps/worker/src/assets/generate/quality.ts` giữ một bộ tiêu chí cho đồ vật và bối cảnh. Hành động và tư thế đã có kiểm rig riêng.

| Loại | Tiêu chí |
|---|---|
| Đồ vật | Ít nhất 8 hình vẽ; ít nhất 4 màu; có khối (gradient hoặc hai lớp sáng/tối trong suốt); chuyển động theo `frame`; nét viền đậm; vật trên trời không có chân đế hay `ContactShadow` |
| Bối cảnh | Ít nhất 15 hình vẽ; ít nhất 6 màu; ít nhất 2 gradient; chuyển động nhẹ theo `frame` |

**Một bộ tiêu chí, hai chỗ dùng:**

1. **Prompt.**
   - Mỗi tiêu chí là một dòng "Quality bar" trong prompt gửi Claude Code.
   - Worker chấm file Claude trả về. Thiếu tiêu chí thì gửi lại kèm tiêu chí thiếu, tính là một lần thử (tối đa 2 lần).
   - Lần cuối vẫn thiếu thì vẫn nhận hình, vì hình thật còn hơn hình thay thế, và ghi log.
2. **Dùng lại.**
   - Trước khi dùng lại một hình khớp tag, worker chấm mã nguồn của hình đó.
   - Đạt thì dùng lại, không gọi model. Chưa đạt thì xét hình khớp kế tiếp. Hết hình thì tạo mới bằng Claude Code (vẫn trong trần 3 hình mới mỗi run).

**Cách chấm.** Worker chấm bằng đọc mã nguồn: đếm thẻ hình, vòng lặp vẽ, màu, gradient, `opacity`, `frame`, `ContactShadow`. Không render, không gọi model, nên nhanh, tất định và chấm được mọi hình trong kho.

**Vật trên trời.** Xét theo 6 chữ đầu của mô tả, tức là món chính, so khớp nguyên từ có dấu ("mây" không khớp "máy"). Không xét tag, vì tag hay chứa từ của chủ đề: lăng kính có tag "cầu vồng".

**Giới hạn.** Chấm mã nguồn không thấy lỗi chỉ lộ ra khi nhìn, ví dụ bối cảnh "dòng sông" có một vùng không tô (khoảng đen). Lỗi kiểu đó vẫn cần Director xem ở Cổng 1, hoặc dùng "Tạo lại hình" ở Cổng 2.

### 3. Khung ngang 16:9 để thử

**Chọn khung.** Director chọn khung khi bắt đầu run.

- Cột `workflow_runs.aspect_ratio`:
  - giá trị `9:16` (mặc định) hoặc `16:9`, có CHECK;
  - migration `0007`.
- `POST /api/projects/:projectId/workflow-runs` nhận `aspectRatio` tùy chọn.
- Khung không đổi trong suốt run.
- Run cũ là `9:16`.

**Render props.** `width`/`height` của `StickStory` là 1080×1920 hoặc 1920×1080. Cặp khác bị từ chối. Ảnh storyboard và video cùng khung. QA so kích thước MP4 với props như cũ.

**Motion kit 0.7.0.** `StageShot`, `framing`, `shotFraming` nhận `frameSize`; mặc định khung dọc, nên khung dọc vẽ y hệt trước.

Ở khung ngang:

- Cỡ rộng đặt mặt đất ở 75% chiều cao khung, góc cao ở 72%.
- Cỡ trung lấy từ đùi trở lên.
- Cỡ cận đặt mặt ở 42% như cũ.
- **Bối cảnh cũ** (vẽ rộng 1080) được phóng đều quanh điểm giữa mặt đất cho đủ bề ngang khung (khoảng 1,96 lần với bối cảnh 1080). Nhân vật và đồ vật giữ cỡ, mặt đất giữ chỗ. Camera chỉ nhìn trong vùng bối cảnh đã phóng, nên không có dải đen.
  - Đã thử soi gương bối cảnh hai bên rồi bỏ: lộ đường nối, lặp đồ vật.
- **Bối cảnh mới** được dặn vẽ kín x -440..1520 và dùng `GENERATED_WIDE_BACKGROUND_STAGE`, nên ở khung ngang gần như không phải phóng. Ở khung dọc, camera vẫn đứng giữa như cũ.
- **Minh họa** chuyển sang bên còn trống cạnh nhân vật, cao khoảng 62% khung, vì trên đầu nhân vật chỉ còn dải hẹp.
- **Phụ đề** sát đáy hơn: lề 36, chữ 50 px. Thẻ tiêu đề và thẻ kênh cách mép trên 60.

**Version.** `StickStory` lên `1.7.0+kit.0.7.0`, nên cache MP4 cũ không dùng lại.

## Hệ quả

- Hình tự tạo theo một chuẩn đo được. Hình cũ chưa đạt sẽ được vẽ lại khi có yêu cầu tương tự, tốn một lượt Claude Code mỗi hình.
- Đây là hình đang có trong kho lúc ghi ADR. Có hình là `candidate`, mới dùng trong video cầu vồng.
  - Chưa đạt, có bóng đất dù là vật trên trời: `prop_mat_troi_tron_8f65`, `prop_hinh_ve_phang_152d`, `prop_giot_nuoc_mua_80aa`, `prop_cau_vong_hinh_2926`.
  - Chưa đạt, thiếu khối: `prop_laptop`, `prop_load_meter`, `prop_packets`.
  - Chưa đạt, thiếu cả chi tiết: `prop_queue_crowd`, `prop_server_overload`.
  - Chưa đạt, thiếu chi tiết: `prop_shield`.
  - Chưa đạt, đứng yên: `bg_classroom`, `bg_room`.
- Bộ tiêu chí chỉ chặn đường dùng lại theo yêu cầu. Kịch bản vẫn được chọn thẳng tài sản `approved` trong danh mục (ví dụ `bg_classroom`).
- Khung ngang là lựa chọn thử:
  - Bối cảnh cũ được phóng nên đồ vật trong cảnh to hơn so với nhân vật (bàn trong lớp học to hơn).
  - Bộ đăng bài vẫn viết cho Shorts, Reels, TikTok.
  - Ảnh bìa lấy khung 16:9 như video.
