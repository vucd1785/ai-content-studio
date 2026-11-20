# AI Content Studio — Bộ asset và tài liệu thiết kế

Bộ này dành cho **thiết kế giao diện và lập trình**. Hình nhân vật, robot, đạo cụ, storyboard và minh họa là **SVG tự chứa** (source) + **PNG** tương ứng (dùng nhanh). Các ảnh PNG trong thư mục `08_HIFI_REFERENCES` chỉ là **mockup tham khảo về phong cách**, KHÔNG đưa trực tiếp vào UI vì chữ trong ảnh AI có thể sai dấu tiếng Việt và không tương tác/đáp ứng WCAG.

## Bắt đầu
1. Prompt thực thi đã chuyển sang `docs/design/prompts/claude-code-ui-master-prompt.md` (bản Cursor cũ: `prompts/cursor-ui-master-prompt.superseded.md`). Kế hoạch triển khai trong repo: `docs/14-ASSET-REUSE-AND-UI-PLAN.md`.
2. Cung cấp đường dẫn thư mục asset của bộ ZIP cho Agent.
3. Mở `09_LIVE_HTML_DEMO/index.html` bằng trình duyệt để xem demo mock-data cơ bản. Demo chưa kết nối backend và không phải ứng dụng production.
4. Đọc `07_DESIGN_TOKENS/design-tokens.json` và `theme.css` để dùng chung màu, khoảng cách, typography.

## Thư mục
- `01_CHARACTERS`: Tí (khăn cam), Bit (robot xanh), Đậu (hạt đậu có mầm), mỗi nhân vật có 4 tư thế và hình bộ ba.
- `02_AGENT_ROBOTS`: 7 robot vai trò (điều phối/nghiên cứu/kịch bản/hình ảnh/giọng đọc/dựng video/kiểm tra).
- `03_STUDIO_3D`: ảnh isometric xưởng robot cho light/dark. LƯU Ý: Đây là **minh họa tĩnh** để làm fallback/placeholder, KHÔNG phải mô hình WebGL 3D có thể tương tác. Studio 3D thực phải code riêng, chỉ đọc trạng thái đã lưu.
- `04_UI_ILLUSTRATIONS`: đăng nhập, trống, chờ duyệt, worker offline, xuất xong, mất kết nối, background light/dark.
- `05_STORYBOARD_SAMPLES`: 5 ảnh dọc 9:16 chỉ để demo, KHÔNG được nhầm là artifact thật do pipeline sinh.
- `06_PROPS_AND_BRANDING`: laptop, server, khiên, đồng hồ, sách, tia sáng, clapboard, micro, logo mark, favicon.
- `07_DESIGN_TOKENS`: file JSON + CSS token.
- `08_HIFI_REFERENCES`: hình mẫu giao diện (ảnh tham khảo, có thể chứa chữ chưa chuẩn).
- `09_LIVE_HTML_DEMO`: demo tương tác tĩnh (không có dữ liệu thật).

## Quy tắc tích hợp
- Ưu tiên `<img src="/assets/...svg" alt="...">` cho hình vector; sử dụng bản PNG nếu SVG không tương thích thư viện cụ thể.
- Không raster hóa toàn bộ layout thành một ảnh. Văn bản, badge, nút, biểu đồ, tiến độ phải là DOM thực có thể truy cập bằng bàn phím.
- Không nhúng file font có bản quyền; tải Be Vietnam Pro từ nguồn hợp lệ hoặc dùng font hệ thống.
- Đối với theme dark, mã màu và nền riêng có sẵn; nhân vật/robot có viền đậm thiết kế thiên về nền sáng, hãy dùng nền card sáng khi cần.
- Demo hiển thị dữ liệu giả rõ ràng, không dùng như dữ liệu live và không thực hiện các hành động nghiệp vụ.
- Dùng hình ảnh này như một bộ asset thiết kế v1, không phải motion kit GIF/3D model/voice mẫu hoàn chỉnh.

## Ảnh chụp mockup bổ sung
`09_LIVE_HTML_DEMO/screenshots/` gồm 7 ảnh PNG giao diện được dựng từ design tokens và SVG gốc, chữ tiếng Việt có thể đọc được: Dashboard sáng/tối, Đang chạy bình thường/lỗi, Cổng 1, Cổng 2 và chế độ giám sát mở rộng. Đây là hình tham khảo UI, chưa phải kết quả triển khai app thật.
