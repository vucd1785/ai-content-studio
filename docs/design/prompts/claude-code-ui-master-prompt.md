# CLAUDE CODE MASTER PROMPT — AI CONTENT STUDIO UI/UX + FRONTEND IMPLEMENTATION

Bạn đang làm việc trực tiếp trong **Claude Code** (CLI hoặc extension trong IDE), với vai trò **Principal Product Designer + Staff Frontend Engineer + Accessibility Lead**. Sử dụng các công cụ đọc file, sửa code và chạy lệnh kiểm thử mà phiên Claude Code này thực sự có quyền truy cập; không giả định đã có công cụ hoặc quyền chưa được cấp. Hãy thiết kế và triển khai UI/UX hoàn chỉnh cho ứng dụng nội bộ **AI Content Studio**, desktop-first 1440×900, tối thiểu 1280px, toàn bộ giao diện tiếng Việt. Đây là ứng dụng chạy máy cá nhân, tự động tạo video hoạt hình dọc 9:16 (1080×1920), dài 30–180 giây, có 3 nhân vật Tí (người que khăn cam), Bit (robot mặt xanh), Đậu (hạt đậu xanh có mầm). Dùng assets đính kèm; không cần thiết kế lại nhân vật nếu không thật sự cần.

## 0. QUY TẮC KHỞI ĐỘNG — TUYỆT ĐỐI TUÂN THỦ
1. **Đọc repo trước khi coding**: kiểm tra `package.json`, kiến trúc frontend/backend, hệ routing, design system, APIs, websocket/SSE, schemas, auth, job state, docs/ADR, tests. Không giả định stack/endpoint. Viết báo cáo ngắn những gì đã có, còn thiếu, mapping màn hình → endpoint.
2. **Ưu tiên quy tắc của Claude Code và repo**: đọc `CLAUDE.md` (ở repo root và thư mục liên quan), `.claude/rules/**`, `.claude/skills/**`, `.claude/agents/**` nếu tồn tại, `AGENTS.md`, `README.md`, `docs/**`, sau đó kiểm tra `.cursor/rules/**` nếu repo vốn có. Áp dụng các chỉ dẫn không xung đột với yêu cầu và bảo mật. Kiểm tra các MCP/skill đã cấu hình và được cấp quyền trong phiên hiện tại; không tự ý cài skill, tải script từ Internet hoặc mở rộng quyền. Nếu thiếu, ghi rõ cách cài đặt chính thống để người dùng tự quyết định.
3. Giữ backend, pipeline AI, schema, các API hiện hữu. Không rewrite kiến trúc chỉ để theo stack mới. Nếu FE hiện chưa có, ưu tiên React + TypeScript + Vite + Tailwind CSS + shadcn/ui hoặc giải thích stack tương đương. TanStack Query cho server state; Zustand chỉ cho UI state nếu cần. React Three Fiber/Three.js chỉ cho Studio 3D và phải lazy-load, có 2D fallback. Không tăng tải CPU nền khi không cần.
4. Luồng thật dùng data từ backend. Không hardcode status, progress %, ETA, chi phí, kết quả QA hay lịch sử duyệt. Chưa có API thì tạo adapter/interface + mock chạy được ở dev **được gắn nhãn dữ liệu mẫu**, không giả tạo tác vụ hoàn tất.
5. Tách task thành phase, tạo checklist và ghi trạng thái `todo/in-progress/done`, thực hiện từng phase nhỏ có test + screenshot/preview ở cuối mỗi phase. Nếu Claude Code có công cụ quản lý task/plan thì sử dụng; nếu không, lưu `docs/UI_IMPLEMENTATION_PLAN.md` và cập nhật sau mỗi phase. Đừng chỉ viết plan rồi dừng; tiếp tục đến phần code trong phạm vi repo cho phép. Không tuyên bố có screenshot hoặc test pass nếu chưa thực hiện.
6. Không làm mất logic hoặc dữ liệu hiện có. Không tự ý sửa migration hay thay thế model/schema backend. Nếu API không đủ, viết API contract / integration TODO rõ ràng. Không ghi key, token, mật khẩu vào source/README.

## 1. PRODUCT SCOPE + CÁC CỔNG DUYỆT
Director là duy nhất, xác thực một mật khẩu. Quy trình 7 bước **Nghiên cứu → Viết kịch bản (gồm storyboard) → Duyệt kịch bản (Cổng 1) → Giọng và hình → Render và QA → Duyệt bản cuối (Cổng 2) → Xuất video**.
- Cổng 1: AI tạo **2 phương án**. Mỗi phương án chứa cảnh, nhịp Mở đầu/Đặt vấn đề/Diễn giải/Sự thật/Cú chốt, shot, câu thoại, storyboard và nguồn. Director chọn **Duyệt phương án 1**, **Duyệt phương án 2**, **Yêu cầu sửa**, **Từ chối**. Với sửa/từ chối, ghi chú bắt buộc ≤2000 ký tự; lịch sử quyết định lưu vĩnh viễn. Chỉ cho duyệt ở trạng thái chờ cổng 1 và đúng version.
- Cổng 2: video preview dọc 9:16, phụ đề, báo cáo QA theo mức Lỗi/Cảnh báo, lựa chọn **Duyệt và xuất bản này**, **Yêu cầu sửa**, **Từ chối**. Khóa duyệt khi QA có lỗi chặn, hiển thị lý do và đường xử lý. Chỉ cho duyệt ở trạng thái chờ cổng 2 và version hiện hành.
- **Không xuất hiện nút có từ “Duyệt” ngoài hai cổng này**; Dashboard chỉ hiển thị **“Mở để duyệt →”** điều hướng tới cổng tương ứng (không trigger approval).
- Hủy lượt chạy là không đảo ngược: bắt buộc dialog xác nhận, mô tả tác động, mặc định focus vào “Giữ lượt chạy”.
- Studio 3D **chỉ đọc** trạng thái đã lưu. Bấm robot chỉ mở thông tin vai trò, không thay đổi workflow. Hỗ trợ “Ẩn canvas / Hiện canvas” và fallback danh sách 2D.

## 2. KIẾN TRÚC THÔNG TIN / NAVIGATION
Trang Đăng nhập → Dashboard “Dự án của bạn” → Chi tiết dự án (5 tab: Brief và tài liệu / Đang chạy / Kịch bản / Preview và version / Bản cuối). Điều hướng độc lập: Sử dụng LLM / Kho hình động (sắp có) / Bộ nhận diện kênh (sắp có). Studio 3D là panel giám sát toàn cục theo context dự án/lượt chạy, có chế độ mở rộng.
**Dự án** có nhiều **lượt chạy**. Lượt chạy có artifact/version/decision/QA/log/usage riêng. Không trộn ID dự án với run ID, không ghi đè version.
- Dashboard: khu **Cần bạn xử lý** luôn nằm đầu, tiếp theo lỗi cần xử lý, máy đang chạy, tất cả dự án. Thẻ: Chờ bạn duyệt / Máy đang chạy / Đã xuất / Token Gemini tháng này. Tạo dự án mới tên ≤200 ký tự. Trạng thái “Chưa chạy” nếu chưa có run.
- Brief: Chủ đề, Người xem, Mục tiêu, Thời lượng [30,180], Giọng điệu, Phong cách hình, Ghi chú; lỗi từng field. Upload `.md/.txt/.pdf` ≤10MB hoặc nhập URL có validation. Chọn model Gemini/Claude Code, mô tả ước lượng thời gian, cảnh báo token thật, khởi chạy. Cho phép “Tiêu chuẩn / Sáng tạo” ở nơi hợp lý (future-flag).
- Đang chạy: stepper 7 bước với Xong/Đang chạy/Chờ bạn/Lỗi/Đã dừng/Chưa tới; elapsed, ETA, hiện tiến độ thật `cảnh 3/7`, `đang căn chữ`, `frame 1200/3600`. ETA hiển thị **khoảng** và phân biệt tới cổng kế tiếp hay tới lúc xuất. Đừng giả hiển thị % nếu backend không có dữ liệu. Lỗi: tên bước, lời giải thích dễ hiểu, mã lỗi, kỹ thuật thu gọn, cách sửa; Chạy lại bước lỗi; Hủy lượt chạy với confirmation. Phân biệt lỗi task, mất kết nối và worker dừng.
- Kịch bản: so sánh 2 PA theo tab hoặc cạnh nhau; storyboard dọc click phóng to, thoại phân biệt Tí/Bit/Đậu bằng tên + màu + icon, số shot/câu/nguồn. Research claims ghi “Đã xác minh” / “Giả định” / “Bạn cung cấp”, link nguồn; trạng thái đang tạo ảnh storyboard; ô note ≤2000 ký tự với validation; lịch sử quyết định.
- Preview và version: versioned artifact: nghiên cứu/kịch bản/storyboard/âm thanh/căn thời gian/phụ đề/render props/preview/báo cáo QA/bản xuất; nhãn “Đang xem”; xem bản cũ read-only; video 9:16 có phụ đề.
- Bản cuối: video 9:16 lớn, QA error/warning và trạng thái khóa duyệt hợp lệ, tải file MP4 sau khi xuất.
- Sử dụng LLM: bảng model, input/output/thinking tokens, estimated USD mỗi call, tổng theo run và tháng, filter; ghi rõ không phải hóa đơn.
- Sắp có: Kho hình động gồm nhân vật, hành động, biểu cảm, bối cảnh, góc máy, đồ vật; thẻ preview/ứng viên/đã duyệt. Chế độ sáng tạo có danh sách yêu cầu tài sản mới. Bộ nhận diện kênh: logo, bảng màu, font, hồ sơ Tí/Bit/Đậu, màu thoại, giọng TTS, nút nghe thử (chỉ hoạt động nếu audio có thực). Các chức năng chưa nối backend phải có nhãn “Sắp có”, không tạo thao tác giả hoàn tất. Nếu cần duyệt tài sản, gộp vào Cổng 1 thay vì âm thầm tạo cổng duyệt thứ ba.

## 3. LAYOUT / VISUAL SYSTEM
- Topbar 64px: logo/tên app, Worker đang chạy/đã tắt/mất kết nối, theme toggle, Đăng xuất.
- Sidebar trái rộng 224px (1280:208px), điều hướng + dự án gần đây. Trung tâm responsive, panel giám sát bên phải rộng ~336px (1280:288px).
- Có 3 chế độ: **Làm việc** (3 vùng) / **Tập trung** (ẩn panel khi duyệt kịch bản, video) / **Giám sát** (mở rộng xưởng). Lưu preference UI cục bộ.
- Light mặc định: giấy #f4efe6, mực #1f2a44, outline #0b0d12, cam #f26b3a, cyan #8fe9ff, lá #6cc04a, Đậu #2bb3a3. Dark theo `design-tokens.json`. Chọn màu chữ/nền cho WCAG AA; KHÔNG dùng cam sáng trên nền trắng cho chữ nhỏ; trạng thái phải có chữ/icon, không chỉ màu.
- Font Be Vietnam Pro, scale 12/14/16/20/24/32 px, spacing 4/8/12/16/24/32/40/48; radius 8/12/16/24; shadow nhẹ, outline focus rõ. Tôn trọng prefers-reduced-motion. Dùng bộ SVG/PNG từ thư mục tài nguyên, không nhúng ảnh mockup nguyên màn hình làm UI thật.
- Giao diện sáng ấm áp, chuyên nghiệp, vui nhẹ nhàng. Dùng Tí/Bit/Đậu ở onboarding/empty/header; tránh nhồi mascot lên mọi card. Kích thước màn hình 1440×900, kiểm thử 1280 và tablet xem được.

## 4. 3D STUDIO + 2D FALLBACK
Studio có 7 agent: Điều phối, Nghiên cứu, Kịch bản, Hình ảnh, Giọng đọc, Dựng video, Kiểm tra; trạng thái Rảnh/Đang chờ/Đang chạy/Chờ duyệt/Hoàn tất/Lỗi/Đã hủy. Có Bàn Director, thanh tiến độ render thật; chỉ đọc dữ liệu. Tối ưu GPU/CPU (lazy import, giảm FPS ở idle, tạm dừng khi hidden, cleanup WebGL), có error boundary và nút chuyển sang danh sách 2D. Khi không đủ điều kiện làm model 3D thật ở phase đầu, sử dụng ảnh `03_STUDIO_3D` làm **placeholder rõ nhãn**, đồng thời triển khai danh sách 2D vận hành thật; không gọi ảnh tĩnh là canvas 3D tương tác.

## 5. TOÀN BỘ TRẠNG THÁI + COMPONENTS
Mỗi trang và component phải có: loading/skeleton, empty, populated, error, offline/stale nếu phù hợp. 14 trạng thái run: **Đã gửi ý tưởng, Đang nghiên cứu, Có nghiên cứu, Đang viết kịch bản, Đang dựng storyboard, Chờ duyệt kịch bản, Đang dựng hình và giọng, Đang render preview, Đang kiểm tra, Chờ duyệt bản cuối, Đang xuất, Đã xuất, Lỗi, Đã hủy**.
Xây component: Button primary/secondary/danger/disabled có lý do, StatusBadge, Stepper, ScriptSceneCard, PortraitStoryboard, PortraitVideoPlayer, ErrorPanel, Toast, ConfirmDialog, FormField with validation, FileDropzone, DataTable, CharacterAvatar, EmptyState, InspectorRoleCard, QAList, VersionTimeline, UsageSummary. Đầy đủ hover/focus-visible/disabled/loading, keyboard navigation, ARIA/status announcement, modal focus trap; tương phản chữ thường ≥4.5:1, large ≥3:1. Không chặn bàn phím khi video/lớp phủ xuất hiện.

## 6. DỮ LIỆU, AN TOÀN LUỒNG VÀ API
- Lập TypeScript types/interfaces cho `Project`, `Run`, `Stage`, `ScriptOption`, `Scene`, `ResearchClaim`, `ArtifactVersion`, `QAReport`, `AgentStatus`, `LLMUsage`, `ApprovalDecision`, `WorkerHealth`; map backend states (không tự ý đổi tên states của server).
- API/UI tách qua repository hooks; server là single source of truth. Dùng SSE/WebSocket nếu repo có, fallback polling có backoff. Khi connection lost, hiển thị “Chưa thể cập nhật trạng thái” với timestamp cập nhật cuối, không suy đoán run fail.
- Approval phải gửi đúng run/version/gate, có pending state, idempotency nếu API hỗ trợ, chống double-click/stale action, kiểm tra server trả về; cache invalidation cẩn thận. Các artifact cũ không ghi đè. Cancel phải có confirm, hiển thị trạng thái chờ server ack.
- File uploads validate cả client và backend (nếu có quyền), URL hợp lệ, sanitize text, chống XSS. Không lưu mật khẩu plain text, không lộ secret trong localStorage/log. Đăng xuất xóa session state. Auth flow gồm sai mật khẩu, thiếu mật khẩu, mất kết nối.
- ETA/chi phí/token thực tế lấy từ API. Chi phí USD là ước tính; khi chưa có rate chính xác hiển thị “Chưa đủ dữ liệu để ước tính”, không bịa. QA blocker khóa Cổng 2 kèm diễn giải.

## 7. KẾ HOẠCH TRIỂN KHAI THEO PHASE, CÓ TEST
Phase 0: Audit repo / đọc skills + rules / API mapping / sitemap / UI acceptance criteria.
Phase 1: Theme tokens + layout + nav + typography + app shell + global states + asset integration.
Phase 2: Đăng nhập, Dashboard, tạo dự án, Brief + uploads/model selection.
Phase 3: Đang chạy, stepper, ETA/progress, run errors/retry/cancel + worker health.
Phase 4: Cổng 1 so sánh PA, storyboard, nguồn, quyết định có validation & history.
Phase 5: Preview/version/artifact, Cổng 2 QA/video/approval/export/download.
Phase 6: Sử dụng LLM, Studio 2D, 3D progressive enhancement, các màn “Sắp có”.
Phase 7: Testing E2E/unit/component & accessibility, visual checks light/dark @1440/1280, responsive tablet, performance, keyboard-only, error/empty/loading, docs handoff.

Cuối mỗi phase phải có: file đã sửa, routes khả dụng, screenshot hoặc cách truy cập tại localhost, tests đã chạy và kết quả, các điểm còn thiếu. Không tự công bố “đã xong” nếu chưa chạy/kiểm chứng thực tế. Không được dùng nội dung text/label vô nghĩa của hình AI làm UI production; toàn bộ chữ render qua code tiếng Việt.

## 8. CÁCH PHỐI HỢP TRONG CLAUDE CODE
- Đây là **prompt thực thi cho Claude Code**, không phải Cursor hoặc một prompt chỉ để brainstorm. Bắt đầu bằng kiểm tra thư mục làm việc và đường dẫn đến bộ asset; nếu chưa tìm thấy thư mục, báo chính xác đường dẫn mong đợi và tiếp tục kiểm tra các phần độc lập.
- Trước mỗi nhóm thay đổi lớn, đọc file liên quan, lựa chọn giải pháp ít xâm lấn, không ghi đè thay đổi của người dùng. Nếu repo có file đang sửa dở, không tự ý reset/clean.
- Dùng công cụ edit/write/shell thực tế có sẵn, chạy build/lint/typecheck/test khi có thể; xem output thật, sửa lỗi phát hiện. Chỉ chạy dev server hoặc trình duyệt nếu môi trường cho phép; không bịa kết quả test hay hình chụp.
- Nếu được phép dùng subagents, chỉ giao các việc độc lập và giữ một kế hoạch tích hợp chung; tránh nhiều agent cùng sửa một file. Không bắt buộc phải có subagents.
- Không tự động `git commit`, `git push`, deploy, xóa dữ liệu, thay schema hoặc sửa backend production nếu chưa được người dùng cho phép.
- Việc chọn **Claude Code** để viết code khác với tùy chọn **Gemini / Claude Code** bên trong sản phẩm (model phục vụ tạo video); giữ nguyên lựa chọn nghiệp vụ của app.
- Trong từng phase, xuất: (1) mục tiêu hoàn thành, (2) file thay đổi, (3) routes chạy được, (4) các lệnh kiểm thử và kết quả, (5) hạn chế/blocker. Khi bị giới hạn context, cập nhật plan/checklist trên ổ đĩa để tiếp tục ở phiên sau.

## 9. BẮT ĐẦU NGAY
Hãy (1) kiểm tra codebase và các rules/skills, (2) viết IA/UI audit ngắn, (3) lập phase plan thực tế, (4) bắt đầu triển khai Phase 1 và tiếp tục các phase đủ điều kiện; ưu tiên Dashboard + màn Đang chạy + Cổng 1 + Cổng 2, với mock data chỉ khi backend chưa hỗ trợ. Tái sử dụng mọi assets trong ZIP theo README. Đối chiếu thiết kế với bộ ảnh chụp tham khảo nhưng không biến ảnh chụp thành frontend giả. Nếu có bước không thể làm an toàn hoặc không thể xác minh, ghi blocker cụ thể và tiếp tục phần độc lập còn làm được.
