# ADR-016: Chế độ sáng tạo và kho tài sản hình động

- Trạng thái: Accepted (Director duyệt 2026-11-02)
- Thay một phần bởi [ADR-017](ADR-017-auto-asset-generation.md) (2026-11-10): tạo tài sản tự động bằng Claude Code headless; tài sản `candidate` duyệt ở Cổng 1 thay vì màn Kho hình động.
- Ngày: 2026-11-02

## Bối cảnh

Shot list (ADR-014) chỉ được dùng tài sản đã có trong motion kit. Khi kịch bản cần thứ kho chưa có (một tư thế, đồ vật, bối cảnh hay hành động mới), Director muốn có tùy chọn "sáng tạo": Claude viết tài sản mới, rồi lưu vào kho để các video sau dùng lại.

Có hai cách để Claude viết code:

- **A.** Claude Code, trong một phiên phát triển như phiên agent hiện nay, dùng gói thuê bao của Director.
- **B.** Worker gọi Claude API lúc chạy.

Cách B nghĩa là ứng dụng thực thi code do model sinh khi render. [08-SECURITY.md](../08-SECURITY.md) chưa có mục nào cho việc này. Phần bảo mật mục C (bind cổng, key trả phí) Director đang để sau. [AGENTS.md](../../AGENTS.md) tách provider LLM của ứng dụng khỏi model đang viết code. [00-VISION.md](../00-VISION.md) ghi ứng dụng tự trả phí API của provider.

## Quyết định

**Chế độ chọn theo lượt chạy.** Khi bắt đầu run, Director chọn `standard` hoặc `creative`. Lựa chọn lưu trên `workflow_runs`.

- `standard`: prompt chỉ đưa danh sách id tài sản đã duyệt. Shot list có id lạ thì Zod từ chối, đi qua một lần repair như ADR-007.
- `creative`: shot list được kèm `assetRequests[]`. Mỗi yêu cầu gồm loại tài sản, mô tả, cảnh cần dùng, và id tài sản thay thế gần nhất trong kho. Cảnh đó render bằng tài sản thay thế, có nhãn "chờ tài sản mới" trên storyboard.

**Kho tài sản.** Tài sản là code nên nằm trong repo: `packages/motion-kit/src/assets/<kind>/<id>/`, gồm component và `asset.json`. `asset.json` ghi id, loại, version, tag, kênh, người tạo (`director`, `claude-code`) và trạng thái `candidate` hoặc `approved`. Code phải nằm trong repo để Remotion bundle được và để qua review, test.

Bảng `motion_assets` là bản sao chỉ đọc của các manifest, kèm đường dẫn ảnh xem trước dưới `DATA_DIR`, phục vụ giao diện tìm và duyệt. Một script đồng bộ manifest vào bảng. Yêu cầu tài sản lưu ở `motion_asset_requests`, trạng thái `open`, `fulfilled` hoặc `dismissed`, trỏ tới run và tài sản được tạo.

**Cách A là đường duy nhất trong Phase 6.**

1. Director mở một phiên Claude Code và gọi skill mới `create-motion-asset`.
2. Skill đọc các yêu cầu `open` qua lệnh CLI của worker. Skill chỉ ghi vào kho; không đụng workflow hay DB của run.
3. Skill viết component theo API của motion kit. Ràng buộc: hàm thuần của frame, không mạng, không `Math.random`.
4. Skill render ảnh tĩnh, tự soát theo checklist trong skill (dựa trên checklist 11 điểm của tài liệu tham khảo), rồi chạy test và typecheck.
5. Director xem diff và ảnh tĩnh, đổi `candidate` thành `approved`. Commit chỉ khi Director yêu cầu.
6. Run đang chờ dùng tài sản mới bằng "Yêu cầu sửa" ở cổng final (P3-14). Job render dựng lại `render_props`, thay tài sản tạm bằng tài sản mới theo `motion_asset_requests`. Không thêm trạng thái workflow; không gọi lại TTS.

Ứng dụng lúc chạy không gọi Claude. Provider LLM của ứng dụng vẫn là Gemini (ADR-007).

**Cách B để ADR sau.** Chỉ soạn khi phần bảo mật mục C đã xong. ADR đó phải có:

- sandbox render không mạng;
- kiểm tĩnh trên AST: chỉ import API của motion kit và React; cấm `fetch`, `eval`, `Function`, `import()`, `process`, truy cập DOM ngoài phạm vi;
- typecheck;
- trần chi phí mỗi run, ghi `usage_records`;
- adapter Claude thêm vào ADR-007;
- tài sản vẫn phải qua `candidate` → Director duyệt rồi mới vào kho.

## Phương án đã cân nhắc

- **Chỉ cách B ngay từ đầu.** Tự động hơn, nhưng thực thi code do model sinh mà chưa có sandbox và review bảo mật là rủi ro không chấp nhận được. Cũng thêm provider và key trả phí mà Director chưa duyệt.
- **Lưu code tài sản trong `DATA_DIR` thay vì repo.** Không qua review và test, bundler phải nạp code động từ thư mục dữ liệu. Để lại cho cách B nếu cần, với sandbox.
- **Không có chế độ sáng tạo, Director tự mở task cho tài sản mới.** Đơn giản nhất, nhưng kho không lớn dần theo nhu cầu của kịch bản.

## Hệ quả

- Hạn mức Claude: cách A tốn hạn mức gói thuê bao khi tạo tài sản, không tốn mỗi video. Theo tài liệu tham khảo, một tập viết lại toàn bộ cảnh có thể vượt hạn mức gói $20. Một tài sản lẻ nhỏ hơn nhiều, nhưng chưa đo.
- Migration: `workflow_runs.creative_mode`, `motion_assets`, `motion_asset_requests`. Cập nhật [03-DATABASE-DESIGN.md](../03-DATABASE-DESIGN.md) và [07-API-CONTRACTS.md](../07-API-CONTRACTS.md).
- Skill mới `create-motion-asset` (`.cursor/skills/` và bản tương đương cho Claude Code). Sửa skill `build-video-template`.
- Giao diện có màn "Kho hình động": lọc theo loại và kênh, ảnh xem trước, duyệt `candidate`.
- [08-SECURITY.md](../08-SECURITY.md) thêm mục: ứng dụng không thực thi code do LLM sinh lúc chạy; chỉ code đã vào repo và qua review mới được bundle.
- Không cài skill hay repo bên ngoài (ví dụ `kelano86/*`) khi chưa kiểm license và chưa có Director cho phép.

Liên quan: [ADR-007](ADR-007-llm-adapter.md), [ADR-013](ADR-013-brand-kit-and-formats.md), [ADR-014](ADR-014-motion-kit-and-shot-list.md).
