# Kế hoạch 14: tái dùng tài sản hình động và làm lại UI/UX

- Ngày: 2026-11-10
- Người soạn: Claude Opus 5.5, theo yêu cầu Director cùng ngày.
- Trạng thái: Director chốt D1–D4 ngày 2026-11-10 (mục 2). Task P7-01 đến P7-10 trong [11](11-TASKS.md).
- Đầu vào:
  - [prompt UI](design/prompts/claude-code-ui-master-prompt.md);
  - [bộ `ui-kit`](design/README.md);
  - ADR-013, 014, 016;
  - [06](06-3D-UI-DESIGN.md), [11](11-TASKS.md).

Director yêu cầu hai việc:

- **A.** Khi tạo kịch bản, dùng nhân vật, đồ vật, bối cảnh có sẵn trong kho nếu phù hợp. Thiếu thì tự động gọi API để tạo, rồi lưu vào kho. Mục tiêu là giảm token.
- **B.** Làm lại UI/UX và hình minh họa theo prompt và `ui-kit`.

Agent tự chia phase, tự soát tới khi đạt, rồi báo tóm tắt để Director nghiệm thu.

## 1. Phân tích

### 1.1 Yêu cầu A: hiện trạng

**Đã có:**
- Kho motion kit có 30 tài sản `approved`, 8 trong số đó là đồ vật (P6-19). Mỗi tài sản có `asset.json` (id, kind, tag).
- Prompt script `2` gửi **toàn bộ** danh mục cho Gemini ở mọi run. Chế độ `standard` từ chối id lạ, rồi repair một lần.

**Token:** danh mục hiện nhỏ. Khi kho lớn dần (mục tiêu của A), prompt sẽ dài theo số tài sản. Vì vậy "dùng cái phù hợp nhất" nên làm ở hai lớp:
- **Lọc trước khi gửi:** chỉ gửi tài sản liên quan tới brief và research, mỗi loại tối đa N. Mỗi run tốn ít token hơn.
- **Tái dùng thay vì tạo mới:** chỉ tạo tài sản khi kho thật sự thiếu. Tạo một tài sản (Claude viết code SVG, chạy kiểm) tốn hơn hẳn một lần viết kịch bản.

**Chưa có:**
- Chế độ `creative` (P6-13): `assetRequests[]`, bảng `motion_asset_requests`, render bằng tài sản thay thế.
- Skill `create-motion-asset` đã có nhưng chỉ chạy tay (cách A của ADR-016).

**Chặn kiến trúc:** "tự động gọi API để tạo" là **cách B** của ADR-016. ADR-016 hoãn cách B tới khi xong bảo mật mục C, mà Director đang để mục C sau. Muốn làm thì cần ADR mới (ADR-017) do Director duyệt.

**Điểm thuận lợi:** worker đã gọi được **Claude Code CLI headless** làm provider LLM (spike P6-14, `claude-code-client.ts`). Nó dùng gói thuê bao, không cần key trả phí. Đây là đường ít rủi ro nhất để tạo tài sản tự động.

### 1.2 Yêu cầu B: hiện trạng web

| Hạng mục | Có sẵn | Prompt muốn |
|---|---|---|
| Stack | React 19, Vite 7, Tailwind 4, TanStack Query, R3F; shadcn có 5 component | Như vậy; thêm component còn thiếu |
| Điều hướng | Một trang, chọn dự án ở cột trái, 5 tab, không router | Dashboard, chi tiết dự án, Sử dụng LLM, Kho hình động, Bộ nhận diện; giữ được vị trí khi tải lại |
| Theme | Tối, nhấn xanh `#5b78ff` (06 mục Token) | Sáng ấm mặc định (giấy `#f4efe6`, cam `#f26b3a`) và có tối |
| Trạng thái live | SSE cho studio, polling cho trạng thái worker và kịch bản | SSE, polling có backoff, báo "Chưa thể cập nhật" kèm giờ cập nhật cuối |
| Màn hình | Đăng nhập, home, 5 tab, usage, studio 3D | Như vậy, cộng 3 chế độ bố cục, hai màn "Sắp có", component đủ trạng thái |
| Test | vitest + Testing Library, 94 test | Thêm a11y, ảnh chụp sáng/tối ở 1440 và 1280; E2E Playwright cần tải trình duyệt |

Backend đã có API cho mọi màn hiện có. Màn "Kho hình động" và "Bộ nhận diện kênh" chưa có API (P6-11).

### 1.3 Điểm prompt lệch tài liệu đã duyệt

| # | Prompt | Tài liệu hiện hành | Đề xuất |
|---|---|---|---|
| L1 | Theme sáng ấm mặc định | 06: theme tối, nhấn xanh | Đổi 06 theo `ui-kit` (Director chọn ở D3) |
| L2 | Duyệt tài sản gộp vào Cổng 1 | ADR-016 và 06: duyệt ở màn "Kho hình động", không phải quyết định workflow | Theo D2 |
| L3 | Ghi plan vào `docs/UI_IMPLEMENTATION_PLAN.md` | Repo ghi task ở `11-TASKS.md` | Dùng file này và các task P7 trong 11 |
| L4 | Tự chạy E2E | P2-13: tải trình duyệt Playwright cần Director cho phép | Theo D4. Không có Playwright thì chụp ảnh bằng browser pane của Claude và dùng test component |
| L5 | Nhân vật `ui-kit` | Nhân vật video là motion kit | Hai bộ tách nhau (xem [design/README](design/README.md)) |
| L6 | Hủy run mặc định focus "Giữ lượt chạy" | Hiện có nút "Không hủy" | Làm theo prompt, chỉ đổi UI |
| L7 | Router và URL | Chưa có router | Dùng hash route nhỏ tự viết, không thêm package |

## 2. Quyết định của Director (2026-11-10)

Director chọn: **D1 = B2** (Claude Code headless, [ADR-017](decisions/ADR-017-auto-asset-generation.md)), **D2 = Cổng 1**, **D3 = sáng ấm mặc định kèm tối**, **D4 = cho phép Playwright**.

Các phương án đã đưa ra:

- **D1. Cách tạo tài sản tự động.** Đề xuất **B2: worker gọi Claude Code CLI headless** với skill `create-motion-asset`.
  - Tài sản được viết trong thư mục tạm, không đụng code đang chạy.
  - Kiểm tĩnh AST: chỉ import motion kit và React; cấm `fetch`, `eval`, `import()`, `process`. Sau đó typecheck, test thuần frame, chụp ảnh tĩnh.
  - Đạt thì chép vào `packages/motion-kit/src/assets/<kind>/<id>/` với trạng thái `candidate`.
  - Dùng gói thuê bao, không key mới. Cần ADR-017 thay mục "Cách A là đường duy nhất" của ADR-016, và một phần nhỏ của bảo mật mục C (kiểm AST, render không mạng).
  - Phương án khác:
    - B1, gọi Claude API bằng key trả phí;
    - B3, tạo ảnh raster bằng API ảnh: không chạy code, nhưng không động được và lệch nét vẽ;
    - giữ cách A, tạo tay.
- **D2. Duyệt tài sản mới ở đâu.**
  - Cổng 1: kịch bản và tài sản mới duyệt cùng lúc; tài sản được duyệt cùng phương án.
  - Hoặc màn "Kho hình động" (ADR-016 hiện hành): run phải chờ hoặc render bằng tài sản thay thế.
- **D3. Theme.** Đổi sang sáng ấm mặc định kèm chế độ tối theo `ui-kit`, và cập nhật 06.
- **D4. Playwright.** Cho phép tải trình duyệt Playwright (khoảng 150 MB) để chạy E2E và chụp ảnh tự động, hay không.

## 3. Các phase

Hai nhánh độc lập. Nhánh B không cần chờ ADR nên làm trước. Nhánh A làm sau khi D1 và D2 được chốt.

### Nhánh A: tài sản

| Phase | Việc | Xong khi |
|---|---|---|
| A1 Lọc danh mục | Thêm `description`/`tags` đủ cho mọi tài sản. Hàm chọn tài sản liên quan theo từ khóa brief, research, nhịp; giữ tài sản bắt buộc (nhân vật kênh, hành động cơ bản). Mỗi loại tối đa N | Test chọn; số token prompt trước/sau đo trên 2 brief thật (DDoS, giấc ngủ) |
| A2 Yêu cầu tài sản | Shot list `creative` có `assetRequests[]`. Bảng `motion_asset_requests`, `motion_assets` (**migration: cổng Director**). Render bằng tài sản thay thế, có nhãn trên storyboard | Test tích hợp worker |
| A3 Tạo tự động | Job `asset_generate` theo D1: gọi Claude Code headless, kiểm AST, typecheck, ảnh tĩnh, lưu `candidate`. Ghi chi phí vào `usage_records`, có trần số lần mỗi run | Test với Claude giả; một lần chạy thật tạo một đồ vật |
| A4 Duyệt và dùng lại | Duyệt theo D2. `approved` thì `fulfilled`, render lại không gọi TTS. Lần sau A1 chọn được tài sản này | Test luồng đủ vòng; run thứ hai dùng lại không tạo mới |

### Nhánh B: UI/UX

| Phase | Việc | Xong khi |
|---|---|---|
| B0 Audit | Bảng màn hình → endpoint → component; tiêu chí nghiệm thu từng màn | Mục 4 của file này điền đủ |
| B1 Nền | Token sáng và tối từ `ui-kit/07`, font chung với video, shell mới (topbar 64, sidebar 224/208, panel 336/288, chế độ Làm việc / Tập trung / Giám sát), hash route, asset SVG vào `apps/web/public/assets`, component nền (Badge, Stepper, EmptyState, ErrorPanel, ConfirmDialog, Toast) | Test component; ảnh chụp shell sáng và tối ở 1440 và 1280 |
| B2 Vào việc | Đăng nhập, Dashboard (Cần bạn xử lý, thẻ số liệu, bảng dự án), tạo dự án, Brief và tài liệu, Bắt đầu lượt chạy | Test; ảnh chụp |
| B3 Đang chạy | Stepper 7 bước, ETA khoảng, tiến độ thật, lỗi ba loại (task, mất kết nối, worker tắt), chạy lại, hủy có xác nhận | Test các trạng thái; ảnh chụp bình thường và lỗi |
| B4 Cổng 1 | Hai phương án, storyboard phóng to, thoại theo nhân vật (tên, màu, icon), nghiên cứu có nhãn, ghi chú bắt buộc, lịch sử quyết định | Test; ảnh chụp |
| B5 Preview và Cổng 2 | Dòng thời gian version, xem bản cũ chỉ đọc, video 9:16, danh sách QA, khóa duyệt có lý do, tải MP4 | Test; ảnh chụp |
| B6 Giám sát và phụ | Sử dụng LLM có lọc; studio danh sách 2D bằng robot `ui-kit`; studio 3D đổi màu theo token, lazy-load, dừng khi ẩn; màn "Kho hình động" (nối A4) và "Bộ nhận diện" có nhãn "Sắp có" nếu chưa có API | Test; ảnh chụp |
| B7 Soát cuối | Bàn phím, tương phản, `prefers-reduced-motion`, sáng/tối ở 1440, 1280 và tablet, CPU khi rảnh, docs 06 và 07 | Checklist mục 5 đạt; report |

## 4. Bảng màn hình → endpoint

Điền ở B0.

## 5. Cách tự soát mỗi phase

1. Đọc lại yêu cầu của phase trong prompt và các điểm lệch ở mục 1.3.
2. Chạy typecheck, biome, vitest các package bị đụng.
3. Mở app thật (API, worker, Vite) và chụp màn bằng browser pane ở 1440×900 và 1280×800, cả sáng lẫn tối. So với `ui-kit/09_LIVE_HTML_DEMO/screenshots`.
4. Soát: chữ tiếng Việt từ code, tương phản AA, focus thấy được, không có nút "Duyệt" ngoài hai cổng, không số giả ngoài dữ liệu mẫu có nhãn.
5. Sai thì sửa rồi lặp từ bước 2. Đạt thì ghi `reports/P7-xx.md` và chuyển phase.

Không đổi task sang `done` khi Director chưa nghiệm thu. Không commit khi chưa được yêu cầu.
