# PRD

Tài liệu này mô tả điều Director làm được. Cấu trúc process nằm ở [02-SYSTEM-ARCHITECTURE.md](02-SYSTEM-ARCHITECTURE.md).

## Bối cảnh

Thể loại đầu tiên là video giải thích backend, database, Redis, API và công nghệ AI. Từ Phase 6, Director làm thêm thể loại khác (giải trí, "Nếu như…?", tiểu phẩm) trên cùng một kênh có dàn nhân vật riêng ([ADR-013](decisions/ADR-013-brand-kit-and-formats.md)). Ngôn ngữ giao diện và lời thoại là tiếng Việt. Có thể có thuật ngữ English trong câu thoại và khung code.

## Kênh và gói thể loại

- **Kênh** (`brand_profiles`): Director định nghĩa một lần dàn nhân vật (lớp da, tính cách, vai, giọng đọc của nhân vật nói, câu cửa miệng), bảng màu, font, thẻ mở đầu và kết thúc, âm thanh nhận diện, quy tắc giọng điệu. Mỗi project chọn một kênh.
- **Dàn nhân vật kênh đầu** (tên tạm, Director đổi được): Tí (nhân vật chính, có thoại), Bit (người giải thích, đưa dữ kiện có nguồn, có thoại), Đậu (bạn đồng hành, không thoại, chỉ biểu cảm và âm thanh). Một cảnh có tối đa hai nhân vật; đủ ba chỉ ở thẻ mở đầu, kết thúc, thẻ nhận diện.
- **Gói thể loại**: định nghĩa có version gồm các nhịp kịch bản theo thứ tự, dàn nhân vật mặc định, nhịp cắt (số cắt mỗi phút, cảnh tĩnh tối đa), có cần research không, quy tắc QA riêng. Lát cắt đầu: `explainer` (luồng hiện tại) và gói giải trí `what_if` "Nếu như…?" (Director chốt 2026-11-03).
- **Sự thật và hư cấu**: mọi câu khẳng định là sự thật phải có nguồn trong research. Gói hư cấu được tắt research nhưng khi đó không có nhịp "sự thật". QA chặn duyệt cuối nếu nhịp sự thật thiếu nguồn.

## Việc Director làm

1. Tạo project, chọn kênh, và nhập brief: chủ đề, đối tượng, mục tiêu, thời lượng 30–90 giây, ngôn ngữ `vi`, giọng điệu, phong cách hình. Không chọn thể loại: mọi brief dùng gói chung `story` "Hoạt hình" và mọi video là hoạt hình nhân vật `StickStory` (ADR-013 bổ sung (2) 2026-11-03).
2. Đính kèm ghi chú, file `md`, `txt`, `pdf`, hoặc URL. Mỗi file tối đa 10 MB.
3. Gửi brief cho luồng sản xuất: chọn model cho lượt chạy (Gemini hoặc Claude Code, danh sách do Director cấu hình), chọn chế độ `standard` hoặc `creative` ([ADR-016](decisions/ADR-016-creative-mode-motion-assets.md)), và xem ước tính thời gian máy chạy trước khi bấm.
4. Đọc nghiên cứu, trong đó mỗi nhận định có trạng thái `verified`, `assumption` hoặc `user_provided`.
5. Xem hai phương án kịch bản từ cùng một response LLM, mỗi phương án kèm bảng storyboard ảnh tĩnh từng cảnh và báo cáo kiểm tự động. Sửa lời thoại theo câu và người nói, rồi duyệt, từ chối, hoặc yêu cầu sửa ([ADR-014](decisions/ADR-014-motion-kit-and-shot-list.md), [ADR-015](decisions/ADR-015-multi-speaker-voice.md)).
6. Nghe audio, xem storyboard và phụ đề, sửa timing từng từ.
7. Xem preview, đọc báo cáo QA, rồi duyệt, từ chối, hoặc yêu cầu sửa cảnh.
8. Tải MP4 sau khi đã duyệt đúng artifact preview đó.
9. Xem log, lỗi, version, thời gian (đã chạy thật và ước tính theo tốc độ máy) và chi phí ước tính.
10. Hủy job đang chạy hoặc tiếp tục sau lỗi.
11. Sửa kênh: đổi tên nhân vật, chọn giọng cho từng nhân vật nói từ danh sách service TTS trả về.
12. Mở "Kho hình động": lọc tài sản theo loại và kênh, xem ảnh xem trước, duyệt tài sản `candidate` do Claude Code tạo ở chế độ sáng tạo ([ADR-016](decisions/ADR-016-creative-mode-motion-assets.md)). Duyệt tài sản không phải approval của workflow.

Hai phương án kịch bản là đầu ra của một lần gọi có cấu trúc, không phải hai cuộc hội thoại.

## Định dạng đầu ra

- Khung hình 1080×1920, 30 fps, H.264 trong MP4.
- Phụ đề tiếng Việt theo trang, timing theo từ, sửa tay được; từ Phase 6, màu phụ đề theo người nói.
- Hình MVP là template: tiêu đề, đoạn giải thích, code, sơ đồ hộp-mũi tên. Footage điện ảnh không bắt buộc.
- Phase 6 thêm template `StickStory`: nhân vật SVG động từ motion kit, bối cảnh mức chi tiết 2 mặc định, cắt cảnh theo từ, SFX sau từ khóa, âm lượng export -14 LUFS. `EduVertical` vẫn dùng cho script `1` và gói `explainer` cũ.

## MVP kỹ thuật và MVP sản phẩm

MVP kỹ thuật kết thúc ở Phase 1: một lệnh local đi từ Script JSON tới MP4, với TTS, alignment và QA tối thiểu.

MVP sản phẩm kết thúc ở Phase 4: web tiếng Việt, hai cổng duyệt, orchestration, SSE, và studio 3D đọc trạng thái thật.

## Ngoài MVP

Adapter OpenAI ở môi trường chạy thật, worker gọi Claude API để sinh code tài sản lúc chạy (cách B của ADR-016, chờ ADR riêng sau bảo mật mục C), VieNeu v4, voice clone, S3, template thứ tư trở đi (ngoài `EduVertical`, `EduLight`, `StickStory`), Google Search grounding, nhiều ngôn ngữ UI, nhiều tài khoản, Remotion Lambda, và mọi đường đăng bài mạng xã hội (Publisher, Director mở sau). Không có agent Planner hay Reviewer: Director tự duyệt. Nhân vật 3D anime có rig là hướng Director tự phát triển sau; MVP dùng robot dựng bằng code (06-3D-UI-DESIGN).

## Tiêu chí nghiệm thu sản phẩm

- Export không chạy khi chưa có bản ghi approval `final` / `approved` trỏ tới đúng preview.
- Từ chối hoặc yêu cầu sửa không xóa artifact cũ.
- Một project mẫu về Redis hoặc API xem được trên màn hình dọc, phụ đề khớp lời thoại ở mức cổng Phase 0.
- Reload trang vẫn thấy trạng thái workflow từ database.

Chi tiết phase nằm ở [10-IMPLEMENTATION-PLAN.md](10-IMPLEMENTATION-PLAN.md).
