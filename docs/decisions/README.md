# Mục lục quyết định

| ADR | Quyết định |
|---|---|
| [ADR-001](ADR-001-monorepo-processes.md) | Monorepo, Compose, Node 24 |
| [ADR-002](ADR-002-logical-agents.md) | Vai trò logic, ba queue |
| [ADR-003](ADR-003-postgres-and-redis.md) | PostgreSQL là nguồn sự thật, Redis là queue |
| [ADR-004](ADR-004-human-approval.md) | Hai cổng duyệt, không tự approved |
| [ADR-005](ADR-005-tts-alignment.md) | VieNeu v3 CPU và forced alignment |
| [ADR-006](ADR-006-remotion-local-render.md) | Remotion local, template 2D |
| [ADR-007](ADR-007-llm-adapter.md) | Adapter Gemini, Zod sau response; `diagramJson` trước Zod; bổ sung 2026-11-02: client Claude Code (gói thuê bao) |
| [ADR-008](ADR-008-local-storage.md) | Đĩa local, key tương đối |
| [ADR-009](ADR-009-3d-monitoring.md) | 3D giám sát, fiber 9 |
| [ADR-010](ADR-010-zod-contracts.md) | Zod 4 trong `packages/contracts` |
| [ADR-011](ADR-011-whisper-alignment-default.md) | Whisper + stable-ts alignment mặc định MVP |
| [ADR-012](ADR-012-alignment-trailing-silence-gate.md) | Ngoại lệ im lặng đuôi TTS trong cổng alignment (≤400 ms, PCM); bổ sung 2026-11-02: sửa từ độ dài 0 |
| [ADR-013](ADR-013-brand-kit-and-formats.md) | Bộ nhận diện kênh, dàn ba nhân vật, gói thể loại ngoài giáo dục; bổ sung 2026-11-03: Đậu có lời thoại, ba nhân vật trong khung `wide`/`high`; bổ sung (2): một đường hoạt hình, bỏ script `1` và chọn thể loại |
| [ADR-014](ADR-014-motion-kit-and-shot-list.md) | Motion kit nhân vật SVG, shot list dữ liệu, template `StickStory`, storyboard trước cổng script; bổ sung 2026-11-03: chỉ hoạt hình, bỏ `onScreenText` và `board` khỏi script `2`; bổ sung 2026-11-11: minh họa; bổ sung 2026-11-12: minh họa xin đồ vật, diễn xuất tự động, máy quay, phụ đề theo cụm |
| [ADR-015](ADR-015-multi-speaker-voice.md) | Lời thoại theo câu có người nói, giọng theo nhân vật; bổ sung 2026-11-02: căn chữ theo cảnh |
| [ADR-016](ADR-016-creative-mode-motion-assets.md) | Chế độ sáng tạo qua Claude Code, kho tài sản hình động; Claude API để ADR sau; một phần thay bởi ADR-017 |
| [ADR-017](ADR-017-auto-asset-generation.md) | Tái dùng tài sản theo brief, tự tạo tài sản thiếu bằng Claude Code headless trong bước storyboard, duyệt ở Cổng 1 |
| [ADR-018](ADR-018-publish-kit.md) | Bộ đăng bài YouTube, Facebook, TikTok do job `publish` viết sau khi xuất video; hướng dẫn đăng chung; liên hệ bản quyền của kênh |
| [ADR-019](ADR-019-audio-library.md) | Thư viện âm thanh tự tạo bằng code: bốn nhạc nền theo không khí, bảy hiệu ứng, ducking theo lời thoại |
| [ADR-020](ADR-020-director-review-tools.md) | Sửa câu tại Cổng 1 không gọi LLM, tự kiểm kịch bản bằng luật, QA hình mọi shot, báo việc chờ duyệt, chỉnh giao diện |
| [ADR-021](ADR-021-cards-redo-and-export.md) | Thẻ tiêu đề đầu và thẻ kênh cuối video (ngoại lệ của "không chữ"), làm lại một phần ở Cổng 2, tên kênh trước lần xuất, ảnh bìa, kho "dùng trong", -14 LUFS |
| [ADR-022](ADR-022-asset-quality-and-wide-frame.md) | Vai trò họa sĩ hoạt hình và tiêu chí chất lượng trong prompt tạo hình; chỉ dùng lại hình cũ đạt tiêu chí; khung ngang 16:9 để thử (chọn khi bắt đầu run) |
| [ADR-023](ADR-023-depth-layers-and-scene-lighting.md) | Bối cảnh ba lớp chiều sâu (xa, giữa, tiền cảnh) trượt lệch theo camera; tông ánh sáng `mood` theo shot; `bg_meadow` làm mẫu |
| [ADR-024](ADR-024-editing-rhythm.md) | Nhịp dựng: gói `story` v3 (18–26 cắt mỗi phút, shot tối đa 3,5 giây) cho brief mới; shot bị chia cắt sang người nghe; luật dựng hình trong prompt; ba gợi ý dựng hình ở Cổng 1 |
| [ADR-025](ADR-025-acting-effects-camera.md) | Sáu hành động mới (chạy, suy nghĩ, lắng nghe, nhún vai, giới thiệu, nhìn lên); hiệu ứng `effects` theo shot (chớp, va chạm, vệt tốc độ, lấp lánh, bóng đèn, hoa giấy); ba góc máy mới (góc thấp, góc nghiêng, lia gắt) |
| [ADR-026](ADR-026-title-and-follow-outro.md) | Gói `story` v4: mở đầu một nhân vật đọc tiêu đề trên hình tượng trưng, kết bằng cảnh ba nhân vật mời theo dõi do code dựng hình (`action_follow`, hoa giấy), thẻ kết hiện từ đầu cảnh đó |
| [ADR-027](ADR-027-unlimited-assets-and-download-name.md) | Bỏ trần hình tự tạo mỗi run (thay ADR-017 mục 4), kịch bản xin tối đa 8 hình; prompt tạo hình nêu đúng API của kit; tên file tải về theo chủ đề không dấu |
| [ADR-028](ADR-028-channel-avatar-end-card.md) | Avatar kênh (`data/brand/<slug>/avatar.*`) trên thẻ kết mời theo dõi, thay chữ tên kênh, có hiệu ứng bật ra và vòng sáng |
| [ADR-029](ADR-029-wide-layout-boards-flags.md) | Khung ngang có minh họa: nhân vật nửa trái, minh họa nửa phải; bảng phấn ở lớp học và thẻ kem viền mực thay tấm trắng; hình phức tạp lấy từ nguồn có sẵn, bắt đầu với 249 cờ (flag-icons, MIT); cảnh kết thẻ hồ sơ kênh |
| [ADR-030](ADR-030-real-images.md) | Ảnh thật trong video: ảnh Director tải lên ở Tài liệu tham khảo thành tài sản; kịch bản đánh dấu `real` thì worker tìm ảnh giấy phép mở trên Wikimedia Commons; ảnh trong khung trên giá vẽ; bộ đăng bài ghi công |
| [ADR-031](ADR-031-youtube-upload.md) | Đăng video lên YouTube bằng một nút sau hộp xác nhận của Director: OAuth với dự án Google Cloud của Director, token mã hóa, upload resumable không trùng, ảnh bìa, mô tả theo 5.000 byte |
| [ADR-032](ADR-032-web-images-question-outfits.md) | Ảnh thật tìm trên mọi trang web (Claude Code chỉ bật `WebSearch`, worker lấy `og:image` qua fetch chặn SSRF), rồi Commons; chân dung người nổi tiếng; khung ảnh bỏ giá vẽ, ảnh to hơn; hiệu ứng dấu hỏi nhỏ `question`; bối cảnh hợp chủ đề; trang phục `outfit`; thẻ tiêu đề dưới đáy |
