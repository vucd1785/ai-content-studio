# ADR-017: Tự tạo tài sản hình động bằng Claude Code headless, duyệt ở Cổng 1

- Trạng thái: **Accepted** (Director duyệt 2026-11-10)
- Ngày: 2026-11-10
- Thay một phần [ADR-016](ADR-016-creative-mode-motion-assets.md): mục "Cách A là đường duy nhất trong Phase 6" và nơi duyệt tài sản `candidate`.
- Liên quan: [ADR-007](ADR-007-llm-adapter.md), [ADR-014](ADR-014-motion-kit-and-shot-list.md), [kế hoạch 14](../14-ASSET-REUSE-AND-UI-PLAN.md), spike [P6-14](../spikes/P6-14-claude-code-headless.md)

## Bối cảnh

Director muốn ba điều (2026-11-10):
- kịch bản dùng nhân vật, đồ vật, bối cảnh có sẵn khi phù hợp;
- kho thiếu thì app **tự** gọi API để tạo, rồi lưu vào kho;
- tốn ít token hơn.

ADR-016 chỉ cho tạo tay: Director mở phiên Claude Code và gọi skill `create-motion-asset`. Đường tự động (cách B) bị hoãn tới khi xong bảo mật mục C.

Từ P6-14, worker đã gọi **Claude Code CLI headless** làm provider LLM. Lệnh này dùng gói thuê bao của Director, chạy trong thư mục tạm, và không cần key trả phí.

Director chọn trong lượt hỏi ngày 2026-11-10:
- tạo tự động bằng Claude Code headless;
- duyệt tài sản mới gộp vào Cổng 1.

## Quyết định

### 1. Tái dùng trước, tạo sau

- Trước khi gọi LLM viết kịch bản, worker chọn từ kho những tài sản `approved` liên quan tới brief và research.
  - Cách chọn: so từ khóa với `tags` và `description`.
  - Mỗi loại có trần số tài sản.
  - Tài sản bắt buộc luôn có: skin nhân vật kênh, hành động và biểu cảm cơ bản.
- Prompt chỉ mang danh mục đã lọc, nên danh mục không dài thêm khi kho lớn lên.
- Chế độ `creative` là **mặc định** của run mới. Director vẫn chọn được `standard` (không tạo tài sản).
- Ở chế độ `creative`, kịch bản chỉ được thêm `assetRequests[]` khi danh mục không có tài sản dùng được (prompt nói rõ điều này). Tối đa 3 yêu cầu mỗi phương án.

### 2. Tạo tự động trong bước storyboard, không thêm trạng thái workflow

Sau khi kịch bản qua Zod, job storyboard xử lý từng yêu cầu của cả hai phương án, trước khi chụp ảnh:

1. **Ghi yêu cầu.** Ghi `motion_asset_requests` trạng thái `open`.
2. **Dùng lại nếu đã có.** Nếu kho đã có `candidate` hoặc `approved` cùng loại khớp mô tả (từ khóa, ngưỡng cố định), đánh dấu yêu cầu `fulfilled` bằng tài sản đó, không tạo mới.
3. **Tạo bằng Claude Code headless.**
   - Prompt sinh từ skill `create-motion-asset`, chạy trong thư mục tạm.
   - Đầu ra chỉ là JSON: id, mã `index.tsx`, `asset.json`. Claude Code không được ghi thẳng vào repo.
4. **Kiểm trước khi vào kho.** Mọi bước dưới đây đạt thì mới được dùng, sai một bước là bỏ:
   - kiểm tĩnh AST:
     - chỉ import `react`, `remotion` và module của motion kit;
     - cấm `fetch`, `XMLHttpRequest`, `eval`, `Function`, `import()`, `require`, `process`, `globalThis`, `window`, `document`, `Math.random`, `Date`;
     - cấm chuỗi URL;
   - đúng kiểu với API kind tương ứng (typecheck thư mục tạm);
   - render thuần: cùng frame ra cùng SVG, có chuyển động, không có `<text>`;
   - ảnh tĩnh render được.
5. **Lưu.**
   - Mã vào `packages/motion-kit/src/assets/<kind>/<id>/`, `asset.json` `status: "candidate"`, `createdBy: "claude-code"`.
   - Đăng ký trong `assets/generated.ts`. Chỉ worker ghi file này.
   - Ảnh xem trước vào `DATA_DIR`.
   - Đồng bộ dòng `motion_assets`; yêu cầu thành `fulfilled`.
6. **Không tạo được thì vẫn chạy tiếp.** Cảnh render bằng `fallbackAssetId` có nhãn "chờ tài sản mới" như ADR-016. Lỗi ghi vào `errors[]` của storyboard; run không fail.
7. **Bundle lại.** Bundle Remotion của worker được dựng lại sau khi kho đổi, để ảnh storyboard và render thấy tài sản mới.

### 3. Duyệt ở Cổng 1

- Cổng 1 hiện tài sản mới của từng phương án cạnh storyboard: ảnh, mô tả, cảnh dùng.
- **Duyệt phương án N** đổi các tài sản `candidate` mà phương án N dùng thành `approved`. Ghi trong cùng giao dịch với approval, ở route approval.
- Phương án không được chọn, "Yêu cầu sửa", "Từ chối": tài sản giữ `candidate`. Lần tạo sau dùng lại được (bước 2), nhưng prompt `standard` không thấy chúng.
- Không thêm cổng thứ ba và không thêm trạng thái workflow.

### 4. Giới hạn và chi phí

- Tối đa 3 tài sản tạo mới mỗi run, mỗi tài sản một lần thử cộng một lần sửa lỗi.
- Hết hạn mức hoặc Claude Code chưa đăng nhập: không tạo, dùng tài sản thay thế, ghi rõ lỗi.
- Mỗi lần gọi ghi `usage_records` với provider `claude-code`.
- Code do Claude sinh chỉ được bundle sau khi qua mục 2.4. Code `candidate` chạy trong render storyboard và preview của chính run đó; video export chỉ dùng tài sản đã duyệt ở Cổng 1.

### 5. Không đổi

- Provider kịch bản mặc định (Gemini) và cách chọn model của run.
- Kind `character_skin` và `brand_card` không tạo tự động.
- Cách A (Director tự gọi skill) vẫn dùng được.
- Commit do Director quyết định. Tài sản sinh ra là file chưa commit trong repo.

## Phương án đã cân nhắc

- **Claude API key trả phí:** tốn tiền theo lần gọi, thêm key và adapter mới. Director không chọn.
- **Ảnh raster từ API ảnh:** không chạy code, nhưng hình đứng yên và lệch nét vẽ với kho SVG. Director không chọn.
- **Giữ cách A:** an toàn nhất, nhưng không tự động như Director muốn.
- **Duyệt ở màn "Kho hình động":** run phải render bằng tài sản thay thế rồi "Yêu cầu sửa" để render lại. Director chọn gộp vào Cổng 1.

## Hệ quả

- **Bảo mật:** [08-SECURITY.md](../08-SECURITY.md) thêm mục "Code do LLM sinh". Phần này làm trước phần còn lại của mục C.
  - Kiểm AST cấm API mạng và hệ thống.
  - Render storyboard và preview trong Chromium headless của Remotion, không có dữ liệu bí mật trong trang.
  - Chỉ code đã qua kiểm mới được bundle.
- **Skill:** `create-motion-asset` thêm phần "chạy headless": đầu vào là yêu cầu, đầu ra là JSON.
- **Route approval Cổng 1:** ghi `approved` cho tài sản của phương án được duyệt. Đây vẫn là route approval (AGENTS.md).
- **Màn "Kho hình động":** xem, lọc, xem ảnh. Không có nút duyệt riêng; tài sản `candidate` ghi "chờ duyệt cùng kịch bản".
- **Docs cần sửa:** 03 (`motion_asset_requests` dùng như cũ), 04 (bước storyboard), 05, 06 (Cổng 1, Kho hình động), 07 (approval body không đổi), 08.
- **Rủi ro:**
  - Claude Code headless mất 1–3 phút mỗi tài sản và tốn hạn mức gói. Bước storyboard dài thêm.
  - Kiểm AST là danh sách cấm, không thay sandbox OS; mục C đầy đủ vẫn còn.

## Bổ sung 2026-11-10 (2): tự tạo hành động và tư thế

Director yêu cầu sau run thật `127c569f`: chế độ Sáng tạo là mặc định, nên thiếu gì phải tự tạo. Run đó xin 4 hành động và tư thế (ngáp dài, lướt điện thoại, gục đầu ngủ gật) nhưng chỉ đồ vật và bối cảnh được tạo.

- **Kind `action` và `pose` được tự tạo** cùng luồng ở mục 2. Đầu ra là file `index.ts` chỉ chứa dữ liệu khung khóa `ActionClip` cho rig chung.
  - Import chỉ từ `rig/math.js`, `rig/pose.js`; không JSX.
  - Cùng kiểm AST, typecheck (kiểu `ActionClip`), render thử ở cỡ trung.
  - Hành động phải có chuyển động giữa frame 24 và 47; tư thế được đứng yên.
- `expression`, `camera`, `character_skin`, `brand_card` vẫn không tự tạo. Yêu cầu loại này giữ `open` và cảnh dùng tài sản thay thế.
- Luật tay không cắt qua mặt chỉ được prompt nhắc. Test của motion kit (`kit.test.tsx`) kiểm mọi hành động trong kho, kể cả hành động tự tạo, khi chạy test.

## Bổ sung 2026-11-11 (3): siết ngưỡng dùng lại

Director quyết sau run thật `e8143c46`. Yêu cầu "đồng bằng sông Cửu Long" bị ghép với bản đồ thế giới `bg_ban_do_the_efbc` chỉ vì trùng một tag "dòng sông". Tag nhiều chữ được 2 điểm, nên chỉ một tag đã đủ ngưỡng cũ.

- **Luật mới ở bước 2 (dùng lại nếu đã có):** cần đủ cả hai điều kiện:
  - đủ điểm như cũ (tag nhiều chữ 2 điểm, tag một chữ 1 điểm, tổng ≥ 2);
  - khớp **ít nhất 2 tag khác nhau** của tài sản.
- Tag trùng lặp chỉ tính một lần.
- Chọn danh mục cho prompt (mục 1) không đổi.
- Hệ quả: hình được dùng lại ít hơn, tạo mới nhiều hơn một chút, nhưng vẫn trong trần 3 tài sản mới mỗi run.
