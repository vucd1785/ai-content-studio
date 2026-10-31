# Quy trình agent tự hành

Áp dụng cho phiên Claude (hoặc model khác) làm thay vai trò lập kế hoạch và triển khai. Không thay [AGENTS.md](../AGENTS.md), [11-TASKS.md](11-TASKS.md), [12-MODEL-HANDOFF.md](12-MODEL-HANDOFF.md) hay skill `implement-task`; file này nối chúng thành một vòng lặp. Khi mâu thuẫn, AGENTS.md và ADR thắng.

## 1. Khôi phục ngữ cảnh

1. Đọc `AGENTS.md`, mục cuối `docs/12-MODEL-HANDOFF.md` (checkpoint), `docs/11-TASKS.md`.
2. `git status` và `git diff --stat`. Cây làm việc có thể chứa thay đổi chưa commit của nhiều task. Không reset, clean, checkout; không coi mọi file chưa commit là của task hiện tại.
3. Trạng thái thật là repo: khối task, `reports/<id>.md`, kết quả lệnh chạy lại. Không tin lời một phiên trước nếu không có bằng chứng.

## 2. Chọn task

- Task đủ điều kiện: `pending` và mọi ID trong **Phụ thuộc** là `done`.
- Thứ tự theo đồ thị phụ thuộc và **Ưu tiên**, không theo số thứ tự. Task ghi "chỉ khi Director mở" (ví dụ `P5-03`) không tự chọn.
- Một phiên làm từng task một, xong (report + kiểm tra) rồi mới sang task kế.

## 3. Mỗi task: Phân tích → Kế hoạch → Code → Tự rà → Kiểm tra → Tài liệu

1. **Phân tích**: khối task, ADR nó nêu, mục liên quan trong 02–09, code có sẵn. Ghi yêu cầu, tiêu chí, non-goal, rủi ro DB/filesystem/bảo mật.
2. **Kế hoạch**: ngắn, nằm trong report (mục Design decisions). Quyết định nhỏ có thể đảo ngược thì tự chốt. Chỗ tài liệu bỏ ngỏ mà là quyết định sản phẩm → cổng Director (mục 5).
3. **Code**: chỉ **File được phép** (mở rộng hợp lý như Zod ở `packages/contracts`, query ở `packages/db` theo ADR-010 và rule backend — ghi rõ trong report). Không refactor ngoài phạm vi, không thêm dependency không cần.
4. **Tự rà**: đọc lại diff thật. Logic, edge case, type, SQL/transaction, hợp đồng API, lỗi trả về, bảo mật, test có thật sự fail nếu code sai không.
5. **Kiểm tra**: Node 24 qua `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/with-node24.ps1 <lệnh>`. Chạy mục **Kiểm tra** của task + test/typecheck của package bị đụng + regression gần (ví dụ session test khi sửa `apps/api`). Ghi exit status thật. Không skip, không làm yếu test.
6. **Tài liệu**: `reports/<id>.md` theo mẫu trong 12-MODEL-HANDOFF; mục task trong 12-MODEL-HANDOFF; checkpoint (mục 6).

Video: dùng lại artifact có sẵn; không tạo lại TTS, alignment, render chỉ để kiểm tra thay đổi không liên quan.

## 4. Trạng thái và Director verify

- Định nghĩa xong (11-TASKS): mọi tiêu chí có bằng chứng trong report.
- Thực hành của dự án: Director verify từng task. Agent **không** tự ghi `done` cho task mà Director chưa verify. Task đã có bằng chứng tự động: giữ `pending` trong 11-TASKS, report ghi `Status: pending — chờ Director verify` kèm lệnh verify và tiêu chí PASS/FAIL.
- Sau khi Director báo PASS trong chat: closeout chỉ sửa tài liệu (report mục Director verification, 11-TASKS `done`, 12-MODEL-HANDOFF).
- Hệ quả: task phụ thuộc vào task đang chờ verify chưa đủ điều kiện. Agent làm tiếp các nhánh độc lập rồi dừng, liệt kê các task chờ verify.

## 5. Cổng Director (dừng và hỏi)

Dừng và hỏi trước khi:

- Sửa ADR hoặc kiến trúc lõi (`docs/decisions/` — report `blocked` + `review-architecture`).
- Đổi schema/migration ngoài task cho phép.
- Thao tác DB phá hủy, xóa/ghi đè dữ liệu người dùng hay media.
- Đổi hợp đồng auth/bảo mật không tương thích.
- Gọi API ngoài tốn chi phí đáng kể (Gemini live, v.v.), tải lại model AI lớn.
- Publish, deploy, mở service ra ngoài loopback; push hay thao tác Git không đảo ngược. Commit chỉ khi Director yêu cầu.
- Quyết định sản phẩm tài liệu chưa chốt (model ID, license, `licenseKey` Remotion...).
- Ghi `done` cho task chưa được Director verify.

Khi hỏi, đưa: quyết định cần, đề xuất, phương án khác và đánh đổi, rủi ro, hành động cụ thể sau khi duyệt.

## 6. Checkpoint và khôi phục

Ở mỗi mốc lớn (xong task, trước việc dài, khi dừng) cập nhật mục **Checkpoint agent** cuối `docs/12-MODEL-HANDOFF.md`:

- Task hiện tại và trạng thái
- Việc đã xong, file đã đổi
- Lệnh đã chạy và exit status
- Lỗi còn mở
- Hành động kế tiếp chính xác
- Có cần Director duyệt không

Lệnh không rõ kết quả (bị ngắt) coi là chưa chạy; chạy lại.

## 7. An toàn

Cấm: `git reset --hard`, `git clean`, `git checkout -- <file>`, `docker compose down -v`, `docker volume rm`, `DROP`/`TRUNCATE` không được duyệt, xóa đệ quy `data/`. Không đụng `data/tts`, `data/alignment`, `data/pipeline`, `data/render` ngoài task cho phép.

Test dùng thư mục tạm và DB/Redis riêng khi có thể. Nếu dùng chung (DB `studio`, Redis Compose), chỉ dọn đúng hàng/key test tạo ra, đặt prefix nhận diện. Không in secret vào code, log, report.

## 8. Giao tiếp

Tiếng Việt với Director. Identifier, tên file, API giữ English. Tóm tắt ở mốc quan trọng. Lệnh verify dạng PowerShell kèm PASS/FAIL.
