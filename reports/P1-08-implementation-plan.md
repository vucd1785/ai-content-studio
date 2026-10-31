# P1-08 — Kế hoạch triển khai (chưa code)

Nguồn: [docs/11-TASKS.md](../docs/11-TASKS.md) mục P1-08, [docs/05-VIDEO-PIPELINE.md](../docs/05-VIDEO-PIPELINE.md) mục Sửa timing, [ADR-005](../docs/decisions/ADR-005-tts-alignment.md), [docs/04-AGENT-ORCHESTRATION.md](../docs/04-AGENT-ORCHESTRATION.md) bảng làm bẩn version.

**Không triển khai trong phiên closeout P1-07.**

## Phạm vi đã chốt

Sửa **timing** (`startMs`, `endMs`) của một từ phụ đề. Render dùng bản đã sửa. **Không** gọi TTS. **Không** đổi lời thoại / WAV / artifact alignment gốc.

Sửa **nội dung chữ** (text khác audio) **không** nằm trong tiêu chí P1-08. Không thêm yêu cầu đó.

## Tiêu chí nghiệm thu

- File override đổi `startMs`/`endMs` của một từ.
- Hàm áp override ra captions dùng cho render.
- Test: số lần `synthesize` vẫn bằng số WAV cảnh, không tăng sau override.
- Một lần chạy CLI với override (không synthesize lại nếu cache WAV còn).

## File được phép (task)

Schema override, hàm áp override, test CLI, `reports/P1-08.md`, `docs/11-TASKS.md`.

Không sửa TTS, Whisper, Remotion composition, Redis brief, contract script, model Gemini.

## Luồng

1. Alignment gốc (P1-02/P1-03) → `mapAlignmentToCaptions` → `captions[]` (`text`, `startMs`, `endMs`, `timestampMs`).
2. Artifact `caption_override` ghi các từ đã sửa (id hoặc index cảnh + chỉ số từ, `startMs`, `endMs`).
3. Hàm apply: copy captions, ghi đè timing các mục khớp override. Không đọc WAV. Không gọi `/synthesize` hay `/align`.
4. `timestampMs` của từ bị sửa = `startMs` mới (quy ước word-level trong `packages/contracts/src/captions/types.ts`).
5. Render props lấy captions đã apply. Hash props đổi → preview/export cũ không được tái sử dụng (bảng bẩn: override làm bẩn render props, preview, QA, export; WAV giữ).

## Ràng buộc

- `endMs` > `startMs`, không âm, không vượt duration cảnh đã đo.
- Không đơn điệu sau override thì hàm apply lỗi (cùng tinh thần P1-03).
- Alignment artifact trên đĩa không bị ghi đè.
- Cache audio: `synthesizeContentKey` theo text + voice. Override timing không đổi text → không miss cache TTS.

## Việc cho Composer (thứ tự)

1. Schema Zod override (trong contracts hoặc module worker được task cho phép — ưu tiên cạnh captions, không đụng `scriptSchema`).
2. `applyCaptionOverride(captions, override)` thuần, có test: một từ đổi timing; từ khác giữ nguyên; interval sai thì throw.
3. Nối vào chỗ CLI dựng captions/props (đọc file override nếu có).
4. Test đếm `synthesize`: fixture đã có WAV, chạy với override, `synthesizeReused` hoặc số lần gọi client không tăng.
5. Một lệnh CLI ghi trong report. Không render MP4 mới nếu task không bắt buộc render — task nói “một lần chạy CLI với override”. Nếu CLI hiện render, dùng cache render hoặc cờ đã có; không synthesize.
6. `reports/P1-08.md`, trạng thái task `done` chỉ khi test và CLI có bằng chứng.

## Không làm

- API HTTP mới (chưa có trong task / `07-API-CONTRACTS`).
- Sửa text caption, gọi lại align, đổi narration.
- P1-09, Phase 2, Postgres artifact row (P2 chưa làm; file override local là đủ cho CLI).

## Rủi ro

- Apply làm captions không đơn điệu → render hoặc QA `caption_gap`. Test phải chặn trước render.
- Quên tách hash props khỏi WAV cache → render cũ không có timing mới. Phải đổi input props.
- Nhầm scope sang sửa chữ → lệch audio. Cấm trong task này.
