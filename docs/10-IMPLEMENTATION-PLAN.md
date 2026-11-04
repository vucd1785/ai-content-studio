# Kế hoạch triển khai

Ước lượng là ngày làm việc của một developer cùng Composer, sau bộ tài liệu này. Task cụ thể nằm ở [11-TASKS.md](11-TASKS.md).

Quyết định đã duyệt ngày 27/10/2026: stack trong [02-SYSTEM-ARCHITECTURE.md](02-SYSTEM-ARCHITECTURE.md), Node 24, Gemini trước, không Search grounding, hai phương án kịch bản trong một response, alignment CTC với phương án Whisper-align trong cùng spike, TTS CPU, một mật khẩu local, đĩa local, và chưa viết mã ứng dụng trước bộ tài liệu này.

## Phase 0 — Khả thi

Mục tiêu: trên máy này, Postgres, Redis, một WAV tiếng Việt, một báo cáo alignment, và một MP4 Remotion trong container.

Phụ thuộc: không có mã sẵn.

Sản phẩm: skeleton monorepo, schema script, service TTS tối thiểu, spike alignment, render ngắn.

Định nghĩa xong: ba việc media chạy lại được; `P0-04` ghi `Decision: go` hoặc `Decision: no-go`. Phase 1 chỉ bắt đầu khi decision là `go`.

Rủi ro: dung lượng model, license acoustic model, Chrome của Remotion trên Docker Desktop/Windows, yêu cầu license Remotion 5. Thời lượng ước tính: 4 ngày.

## Phase 1 — Pipeline

Mục tiêu: Script JSON tới MP4 giáo dục 30–90 giây, rồi một script thật từ Gemini.

Phụ thuộc: Phase 0 go, gồm `P0-05`.

Sản phẩm: template `EduVertical`, CLI, override phụ đề, adapter Gemini.

Định nghĩa xong: fixture không gọi LLM vẫn ra MP4; schema sai bị từ chối; sửa timestamp không gọi TTS; hash props không đổi thì không render lại.

Rủi ro: caption tiếng Việt lệch ở câu có số và mã lệnh. Thời lượng: 10 ngày.

## Phase 2 — Web và duyệt

Mục tiêu: Director thao tác lát cắt Phase 1 trên trình duyệt tiếng Việt.

Phụ thuộc: CLI Phase 1 đã ra MP4.

Sản phẩm: session, project, brief, hai cổng duyệt, player, version.

Định nghĩa xong: không có đường ghi approval tự động; từ chối giữ artifact cũ.

Rủi ro: phạm vi UI phình trước khi cổng duyệt chắc. Thời lượng: 10 ngày.

## Phase 3 — Orchestration

Mục tiêu: state machine chạy hết vòng, có SSE, hủy, resume, usage.

Phụ thuộc: API approval và pipeline media.

Định nghĩa xong: kill worker giữa render rồi resume không gọi lại TTS; đổi cảnh không chạy lại research; usage có token từ response.

Rủi ro: job kẹt lệch giữa Redis và PostgreSQL. Đối chiếu lúc khởi động là một phần của phase này. Thời lượng: 8 ngày.

## Phase 4 — Studio 3D

Mục tiêu: canvas đọc `agent_runs` thật.

Phụ thuộc: SSE đã có. Không làm 3D bằng dữ liệu giả để “có hình trước”.

Định nghĩa xong: project idle không tự nhảy sang completed; render thật cập nhật theo frame; tắt canvas vẫn xuất video được.

Rủi ro: kéo R3F vào package Remotion. Hai package phải tách. Thời lượng: 7 ngày.

## Phase 5 — Tối ưu

Mục tiêu: cache research theo hash tài liệu và màn usage. Template thứ hai chỉ khi Director mở task.

Phụ thuộc: orchestration đã ghi usage thật.

Định nghĩa xong của lát cắt đầu: cùng bộ tài liệu không gọi lại research; màn hình chỉ tổng hợp `usage_records`. Thời lượng lát cắt đầu: 6 ngày.

## Phase 6 — Thương hiệu và hình động

Director duyệt [ADR-013](decisions/ADR-013-brand-kit-and-formats.md), [ADR-014](decisions/ADR-014-motion-kit-and-shot-list.md), [ADR-015](decisions/ADR-015-multi-speaker-voice.md), [ADR-016](decisions/ADR-016-creative-mode-motion-assets.md) ngày 2026-11-02. Task `P6-01` đến `P6-13` trong [11-TASKS.md](11-TASKS.md). Bản phác ba nhân vật: [design/characters/sheet.html](design/characters/sheet.html).

Mục tiêu: video có dàn nhân vật riêng của kênh, nhiều thể loại, nhiều giọng, nhịp cắt cảnh sinh động; kho hình động lớn dần qua chế độ sáng tạo.

Phụ thuộc: P3-17, P5-05 và các task Phase 2–5 đang chờ verify phải xong trước. Lát cắt này đổi script schema, workflow và render.

Thứ tự đề xuất:

1. **Spike** (không sửa mã ứng dụng):
   - Gemini structured output với schema shot list lồng nhau. Gọi live, cần Director cho phép.
   - Whisper căn câu ngắn dưới 1 giây.
   - Thời gian render một cảnh SVG nhân vật trên máy CPU.
2. **Tài liệu:** 00, 01, 03, 04, 05, 06, 07, 08 theo bốn ADR; skill `create-motion-asset`; sửa `build-video-template`.
3. **`packages/motion-kit`:** rig, 6 biểu cảm, 3 lớp da (Tí, Bit, Đậu), tư thế và hành động cơ bản, 2 bối cảnh, 3 cỡ cảnh. Test và ảnh tĩnh.
4. **Contracts:** script schema `2` (câu có người nói), gói thể loại `explainer` và một gói giải trí, schema shot list, kiểm luật nhịp.
5. **Migration:** `brand_profiles`, thể loại của brief, `workflow_runs.creative_mode`, `motion_assets`, `motion_asset_requests`, nới ràng buộc thời lượng.
6. **Voice:** synthesize và căn theo câu, phụ đề có người nói.
7. **Template `StickStory`:** dựng `render_props` từ shot list, frame cắt lấy từ alignment.
8. **LLM và storyboard:** prompt script `2` kèm shot list và tính cách kênh; job ảnh tĩnh trước cổng script, có kiểm tự động.
9. **Web:** chọn kênh, thể loại, chế độ trong brief và khi bắt đầu run; bảng storyboard ở màn duyệt kịch bản; sửa kênh (giọng nhân vật); màn kho hình động.
10. **SFX và mix:** sau khi Director chọn nguồn SFX có license; chuẩn hóa -14 LUFS khi export.
11. **Chế độ sáng tạo cách A:** lưu yêu cầu tài sản, lệnh CLI xuất yêu cầu, skill, render lại bằng tài sản mới qua "Yêu cầu sửa".

Sau lần chạy thật đầu tiên (ADR-013 bổ sung (2) 2026-11-03, task P6-18): bỏ script `1`, `EduVertical`, `EduLight` và ô chọn thể loại; mọi video đi một đường hoạt hình với gói chung `story`.

Định nghĩa xong của lát cắt đầu: một video thể loại giải trí với Tí và Bit, mỗi nhân vật một giọng, đoạn mở có ít nhất 20 cú cắt mỗi phút, bảng storyboard hiện ở cổng script, chạy ở chế độ `standard`, qua QA và export được. (Câu cũ "`EduVertical` vẫn render được script `1`" hết hiệu lực từ P6-18.)

Quyết định còn chờ Director (task liên quan dừng ở cổng Director cho tới khi có):

| Việc | Ghi chú |
|---|---|
| Gói thể loại giải trí đầu tiên | Đề xuất "Nếu như…?" |
| Tên chính thức của ba nhân vật | Hiện là tên tạm: Tí, Bit, Đậu |
| Giọng VieNeu cho Tí và Bit | Director chọn trong 25 giọng mẫu; agent không điền |
| Nguồn SFX và license | Chưa chọn; không lấy SFX của repo ngoài khi chưa kiểm license |
| Khoảng thời lượng theo thể loại | Hiện brief cố định 30–90 giây |
| Cho phép gọi Gemini live trong spike shot list | Tốn phí nhỏ |

## Quyết định chưa chốt

Các mục này không đổi kiến trúc đã duyệt. Chúng được ghi ở task tương ứng, không được điền giả trong tài liệu.

| Việc | Nơi chốt |
|---|---|
| ID model Gemini cho từng task và thinking level cụ thể | `P1-07`, sau khi đọc model list của tài khoản. Biến env đã có tên, giá trị chưa pin. |
| Thư viện chuẩn hóa tiếng Việt và acoustic model CTC, gồm license | `P0-04`. No-Go thì dừng Phase 1. |
| Major version Remotion và việc Free License một người có cần `licenseKey` khi render local | `P0-05`. |
| Tag Docker `postgres:17` và `redis:7` còn tồn tại trên registry lúc cài | `P0-01`. Nếu tag thiếu, chọn tag major kế tiếp còn được hỗ trợ và ghi vào report, không đổi engine. |
| GPU của máy dev | Đã kiểm 2026-10-31: i3-4005U, Intel HD Graphics, không GPU NVIDIA. TTS chạy CPU, RTF khoảng 9; ước tính thời gian trên giao diện dùng số đo này (`MACHINE_SPEED`). |
| Thời điểm đổi image sang Node 26 | Sau khi dòng 26 vào LTS và có task được phép sửa image. Hiện giữ `node:24`. |

Adapter OpenAI, S3, voice clone và VieNeu v4 nằm ngoài MVP. Chưa có task triển khai cho chúng.

## Cách chạy một phase

Một phiên Composer làm một task. `verify-phase` chỉ chạy khi mọi task của phase đã `done` hoặc `skipped` có lý do trong report. Bỏ qua task vì No-Go của `P0-04` là leo thang, không phải tự ý `skipped`.
