# Spike P6-01: shot list qua Gemini structured output

Ngày: 2026-11-02. Người làm: Claude Opus 5.5. Task: [P6-01](../11-TASKS.md). ADR: [ADR-014](../decisions/ADR-014-motion-kit-and-shot-list.md), [ADR-007](../decisions/ADR-007-llm-adapter.md). Director cho phép gọi Gemini live trong chat.

## Câu hỏi

Gemini structured output có nhận schema shot list lồng nhau (phương án → cảnh → câu thoại có người nói → shot → nhân vật) không? Nếu không, cách mã hóa nào dùng được cho P6-06?

## Cách đo

Script: `apps/worker/src/spikes/p6-01/`.

- **Cấu hình:** model và thinking level đọc từ `.env` qua `readGeminiEnv` (`gemini-3.6-flash`, `low`). Gọi qua client của adapter hiện hành. Schema gửi qua `responseJsonSchema`.
- **Brief:** "Nếu như con người không cần ngủ?", 30–45 giây.
- **Prompt:** mô tả dàn Tí, Bit, Đậu (Đậu không nói), các nhịp "Nếu như…?", và luật nhịp hình.
- **Năm cách mã hóa:**

| Cách | Cấu trúc |
|---|---|
| `nested` | variants[] → scenes[] → lines[] và shots[] → actors[] (4 tầng mảng-chứa-object) |
| `shotsJson` | như trên nhưng shots của mỗi cảnh là chuỗi JSON (vẫn còn 3 tầng: variants → scenes → lines) |
| `variantJson` | mỗi phương án là một chuỗi JSON |
| `flat` | variants[] → scenes[], lines[], shots[] cùng cấp, gắn `sceneId`; hai nhân vật là `actor1`, `actor2` (2 tầng) |
| `flatShotsJson` | như `flat` nhưng toàn bộ shots là một chuỗi JSON |

- **Kiểm tra sau khi nhận:** response được giải về cùng dạng rồi chạy Zod. Sau đó kiểm ngữ nghĩa:
  - `lineId` tồn tại;
  - từ cắt nằm trong câu;
  - không hai shot liền nhau cùng cỡ cảnh;
  - Đậu không nói;
  - đủ các nhịp.

Lệnh, từ `apps/worker`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ..\..\scripts\with-node24.ps1 node --env-file-if-exists=../../.env --import tsx src/spikes/p6-01/run-spike.ts --offline
powershell -NoProfile -ExecutionPolicy Bypass -File ..\..\scripts\with-node24.ps1 node --env-file-if-exists=../../.env --import tsx src/spikes/p6-01/run-spike.ts --live --only=flat
```

Đầu ra: `data/spikes/p6-01/` (`*.raw.json`, `results-*.json`, `run3.log`).

## Kết quả

Đã gọi qua ba lượt. Lỗi 503 ("high demand") là tạm thời và được gọi lại sau 10 phút.

| Cách | Lượt 1 | Lượt 2 | Lượt 3 | Kết luận |
|---|---|---|---|---|
| `nested` | 400 | — | 400 | Bị từ chối cố định |
| `shotsJson` | 400 | — | 400 | Bị từ chối cố định |
| `variantJson` | 503 | 503 | Nhận; Zod trượt | Model tự bịa cấu trúc bên trong chuỗi (thiếu `id`, `beat`, `lines`, `shots`) |
| **`flat`** | — | **Nhận; Zod đạt; ngữ nghĩa sạch** | — | **Dùng được** |
| `flatShotsJson` | — | 503 | Nhận; **65.520 token ra**, 308 giây, JSON bị cắt dở | Nguy hiểm: chuỗi JSON làm model chạy mất kiểm soát |

Lỗi 400 trả về ngay, không tốn token.

**Biến thể `flat`:**
- 531 token vào, 3.121 token ra, 11,4 giây, **~$0,012**.
- Hai phương án, mỗi phương án đủ 5 nhịp.
- Không có `lineId` treo; từ cắt luôn nằm trong câu; không hai shot liền nhau cùng cỡ cảnh; Đậu không nói.

**Tổng chi phí spike:** khoảng $0,27, phần lớn do `flatShotsJson` chạy mất kiểm soát.

Giá dùng để tính: `gemini-3.6-flash` $0,75 / $3,75 cho 1 triệu token (trang giá chính thức, đến hết 31/12/2026; từ 1/1/2027 tăng gấp đôi).

**Giới hạn suy ra:** schema đang chạy của script (variants → scenes, cùng sources) chỉ lồng 2 tầng và được nhận. Mọi biến thể có tầng mảng-chứa-object thứ 3 đều bị 400. Kết luận trùng với bổ sung `diagramJson` của ADR-007. Nguyên nhân chính xác phía Gemini không có trong thông báo lỗi; đây là quan sát, chưa phải giới hạn đã được Google công bố.

## Chất lượng nội dung (bản `flat`)

Cấu trúc tốt, nhưng nội dung chưa đạt:

- Mỗi cảnh chỉ có **1 câu**. Video chỉ khoảng 22–25 giây, nhịp khoảng 19 cắt/phút (mục tiêu 20–27).
- **Vị trí nhân vật không liền mạch:** Tí lúc trái lúc giữa, Bit đổi bên giữa các shot.
- Nguồn của nhịp sự thật chung chung ("Sleep Foundation", "NIH - Glymphatic System Research"), không có URL.
- Có chữ trên màn hình bị lỗi ("+8 Tiếng Mới Ngày!").
- Model dùng `narrator`, tức thêm một giọng thứ ba ngoài Tí và Bit.

## Đề xuất cho P6-06 và P6-10

1. **Dùng cách mã hóa `flat`**: tối đa 2 tầng mảng-chứa-object, `lines[]` và `shots[]` ở cấp phương án gắn `sceneId`, nhân vật là trường `actor1`/`actor2`. Contract nội bộ vẫn lồng nhau; adapter chuyển đổi như `diagramJson`.
2. **Không mã hóa danh sách lớn thành chuỗi JSON:** có nguy cơ chạy mất kiểm soát và tốn phí. Đặt trần `maxOutputTokens` cho mọi lần gọi.
3. **Vị trí nhân vật do code quyết định** theo luật liền mạch, không để LLM chọn `position`.
4. **Prompt của P6-10 phải yêu cầu:** 2–4 câu mỗi cảnh, đúng số cắt mỗi phút, nguồn lấy từ research có URL. `narrator` chỉ dùng khi gói thể loại cho phép.
5. Director định dùng Claude Code để viết kịch bản trong lúc chưa nâng cấp gói Gemini (spike P6-14). Kết quả ở đây vẫn dùng khi quay lại Gemini.
