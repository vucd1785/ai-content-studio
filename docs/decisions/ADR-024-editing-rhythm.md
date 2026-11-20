# ADR-024: Nhịp dựng: gói `story` v3, cắt sang người nghe, luật dựng hình

- Trạng thái: **Accepted**. Director 2026-11-12 chọn làm việc thứ ba trong danh sách cải thiện theo video mẫu: nhịp dựng.
- Ngày: 2026-11-12
- Liên quan:
  - [ADR-013](ADR-013-brand-kit-and-formats.md): gói thể loại, `story` v2;
  - [ADR-014](ADR-014-motion-kit-and-shot-list.md): shot list, luật nhịp;
  - [ADR-020](ADR-020-director-review-tools.md): tự kiểm kịch bản bằng luật;
  - [ADR-023](ADR-023-depth-layers-and-scene-lighting.md): chiều sâu, ánh sáng;
  - tài liệu [05](../05-VIDEO-PIPELINE.md).

## Bối cảnh

Video mẫu cắt cảnh mỗi 2 đến 3 giây, đổi cỡ cảnh liên tục và hay cắt sang nhân vật đang phản ứng. Studio hiện có:

- Gói `story` v2 (mặc định): 12–18 cắt mỗi phút, shot đứng yên tối đa 5 giây. Gói này được làm chậm ngày 2026-11-09 cho video dài tới 3 phút.
- Prompt kịch bản chỉ nêu số shot và "hai shot liền nhau khác cỡ cảnh". Không nói mở cảnh thế nào, khi nào cắt sang người nghe.
- Khi một shot quá dài, code chia shot và xen cỡ cảnh, nhưng mọi phần vẫn nhìn cùng một người.

Director muốn video ngắn, nên nhịp chậm của v2 không còn hợp.

## Quyết định

### 1. Gói `story` v3 là gói của brief mới

| | v2 | v3 |
|---|---|---|
| Cắt mỗi phút | 12–18 | 18–26 |
| Shot đứng yên tối đa | 5 giây | 3,5 giây |
| Thời lượng, nhịp truyện, dàn nhân vật | 30–180 giây | như v2 |

- Video 60 giây có 18 đến 26 shot.
- Phụ đề đi theo lời nói, không theo shot, nên cắt nhanh không làm phụ đề khó đọc.
- Brief đã lưu giữ gói đã ghi. Lưu lại brief thì brief đó chuyển sang v3.

### 2. Cắt sang người nghe khi chia shot

`fixPacing` chia shot dài hơn mức tối đa. Từ nay, nếu shot có từ hai nhân vật thì phần lẻ (phần 2, phần 4) lấy nét nhân vật kia. Người nói vẫn mở miệng theo `speakingRanges`, nên tiếng và hình không lệch. Shot một nhân vật chia như trước.

### 3. Luật dựng hình trong prompt kịch bản

Prompt thêm năm luật:

1. Mở mỗi cảnh bằng cỡ rộng hoặc góc cao, rồi tiến gần dần; cả video dùng ít nhất ba cỡ cảnh.
2. Vài lần trong video, cắt giữa câu sang shot lấy nét người nghe, với biểu cảm phản ứng.
3. Câu nêu một vật cụ thể thì cắt đúng từ đó sang shot có đồ vật hoặc minh họa.
4. Câu dài hơn khoảng 10 từ có hai shot.
5. Một nhân vật không giữ một hành động quá ba shot liền.

### 4. Gợi ý ở Cổng 1

`reviewScriptV2` thêm ba gợi ý mức `info`, không chặn duyệt, chỉ xét khi video có từ 6 shot:

| Mã | Khi nào |
|---|---|
| `few_shot_sizes` | Cả video dùng ít hơn ba cỡ cảnh |
| `no_reaction_shot` | Không shot hai người nào lấy nét người nghe |
| `repeated_action` | Một nhân vật giữ một hành động hơn ba shot liền |

## Hệ quả

- Video dài 3 phút theo v3 cần 54 shot trở lên, trong khi kịch bản chứa tối đa 64 shot. Phần thiếu do `fixPacing` chia thêm.
- Nhiều shot hơn thì kịch bản dài hơn, tốn thêm token đầu ra ở bước viết kịch bản.
- Chưa làm: shot không lời. Shot đang neo vào câu thoại, nên một khoảng lặng chỉ có hình cần đổi cả đường âm thanh.
- Chưa làm trong ADR này: hành động và tương tác đồ vật, lớp hiệu ứng, góc máy mới.
