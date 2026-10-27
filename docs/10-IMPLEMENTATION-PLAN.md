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

## Quyết định chưa chốt

Các mục này không đổi kiến trúc đã duyệt. Chúng được ghi ở task tương ứng, không được điền giả trong tài liệu.

| Việc | Nơi chốt |
|---|---|
| ID model Gemini cho từng task và thinking level cụ thể | `P1-07`, sau khi đọc model list của tài khoản. Biến env đã có tên, giá trị chưa pin. |
| Thư viện chuẩn hóa tiếng Việt và acoustic model CTC, gồm license | `P0-04`. No-Go thì dừng Phase 1. |
| Major version Remotion và việc Free License một người có cần `licenseKey` khi render local | `P0-05`. |
| Tag Docker `postgres:17` và `redis:7` còn tồn tại trên registry lúc cài | `P0-01`. Nếu tag thiếu, chọn tag major kế tiếp còn được hỗ trợ và ghi vào report, không đổi engine. |
| GPU của máy dev | Không chặn MVP. Profile TTS mặc định vẫn là CPU. |
| Thời điểm đổi image sang Node 26 | Sau khi dòng 26 vào LTS và có task được phép sửa image. Hiện giữ `node:24`. |

Adapter OpenAI, S3, voice clone và VieNeu v4 nằm ngoài MVP. Chưa có task triển khai cho chúng.

## Cách chạy một phase

Một phiên Composer làm một task. `verify-phase` chỉ chạy khi mọi task của phase đã `done` hoặc `skipped` có lý do trong report. Bỏ qua task vì No-Go của `P0-04` là leo thang, không phải tự ý `skipped`.
