# Giao diện 3D

Studio 3D giám sát và chọn vai trò. Soạn thảo, duyệt, log và video nằm trên panel 2D. Trạng thái vẽ ra lấy từ `agent_runs` và `events` đã mô tả ở [04-AGENT-ORCHESTRATION.md](04-AGENT-ORCHESTRATION.md).

## Bố cục

Khung giữa là canvas isometric, nền tối. Bảy bàn vai trò và một bàn Director ở giữa. Hình học low-poly dựng bằng code: sàn, bàn, màn hình, thân robot đơn giản. MVP không có nhân vật rig, physics, hay gói asset bên ngoài.

Camera là `OrthographicCamera`, orbit giới hạn góc nghiêng. Click một avatar thì chọn `role` và mở inspector 2D của vai trò đó. Tooltip hiện tên vai trò, trạng thái và câu từ event cuối.

Panel trái là danh sách project. Panel phải là brief, kịch bản, duyệt, `@remotion/player` và log. Tắt canvas thì các panel này vẫn dùng được.

## Ánh xạ trạng thái

| `agent_runs.status` | Hình |
|---|---|
| `idle` | Đèn tắt, đứng yên |
| `queued` | Đèn chờ |
| `running` | Đèn sáng và nhãn việc đang làm |
| `waiting_approval` | Biển chờ duyệt |
| `completed` | Đèn hoàn tất, đứng yên |
| `failed` | Đèn lỗi và `error_code` |
| `cancelled` | Đèn tắt, nhãn đã hủy |

Job LLM phát event `started`, `validated`, `completed`, `failed`. Không phát phần trăm.

Job render phát `job.progress` với các field mà callback `onProgress` của `renderMedia()` cung cấp, trong đó có số frame và `progress` do Remotion tính từ frame. UI chỉ vẽ thanh tiến độ khi payload có các field đó.

TTS kiểu một response WAV không có mức âm từng chunk. Avatar voice ở trạng thái `running` cho đến event hoàn tất kèm duration ffprobe. Thanh waveform chỉ xuất hiện khi payload có mốc chunk thật.

## Hiệu năng và chuyển động

Chế độ hiệu năng thấp đặt `dpr` bằng 1 và tắt shadow. `prefers-reduced-motion` tắt animation lặp. Animation còn lại là đổi màu đèn và một nhịp ngắn khi trạng thái đổi.

Query dữ liệu nằm ngoài vòng `useFrame`. Canvas đọc snapshot từ store, không gọi API mỗi frame.

`P4-01` được phép tạo hình khi đã có shell web. Nối dữ liệu thật là `P4-02`, sau khi SSE đã có. Trước đó không gắn timer giả để avatar tự sang `completed`.
