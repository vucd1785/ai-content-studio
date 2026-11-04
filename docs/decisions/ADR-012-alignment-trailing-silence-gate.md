# ADR-012: Cổng alignment — ngoại lệ im lặng đuôi TTS có giới hạn

- Trạng thái: Accepted
- Ngày: 2026-10-28
- Liên quan: [ADR-011](ADR-011-whisper-alignment-default.md), [ADR-005](ADR-005-tts-alignment.md)

## Bối cảnh

Cổng MVP đo `durationDeltaMs = durationMs − lastWord.endMs` với ngưỡng **250 ms** (Phase 0 / P1-02). Trên WAV VieNeu-TTS, vùng sau từ căn chỉnh cuối thường là **im lặng hoặc năng lượng rất thấp** do synthesis/export, không phải lời thoại chưa map.

P1-06 bị chặn ở cảnh `intro-title`: `durationDeltaMs = 260`, `validation.ok = true`, 19/19 token — PCM đuôi im lặng đã xác minh trên artifact thật.

## Quyết định

1. **Giữ** `durationDeltaMs` là hiệu số thô; không nới ngưỡng 250 ms toàn cục.
2. **`passesGate`** khi `validation.ok`, tỷ lệ từ ≥ 90%, và một trong hai:
   - **A.** `|durationDeltaMs| ≤ 250` → `coverageAcceptanceReason = within_250ms`
   - **B.** `250 < durationDeltaMs ≤ 400` **và** PCM từ `lastWord.endMs` đến hết file là im lặng liên tục (cửa sổ 50 ms, peak **&lt; −40 dBFS**) → `verified_trailing_silence`
3. **`durationDeltaMs > 400`**: không áp dụng ngoại lệ, dù im lặng.
4. Thiếu WAV, PCM hỏng, hoặc năng lượng không chứng minh im lặng → **fail closed**.
5. Không ngoại lệ theo `sceneId`; không sửa timestamp Whisper; không tin metadata client.
6. **`gatePolicyVersion`**: `2.0.0-silence-aware` trên response gate.
7. **`POST /align/revalidate-gate`**: tái đánh giá gate từ JSON + WAV đã lưu, không gọi Whisper.

## Hạn chế

- Ngưỡng −40 dBFS / 50 ms là heuristic MVP; không thay QA nghe.
- Leading silence (ví dụ ~380 ms trước từ đầu) **không** nằm trong cổng này.
- Cache Whisper load mỗi lần align vẫn là tối ưu hiệu năng riêng.

## Hệ quả

- Cập nhật `packages/contracts` gate schema và worker reuse/revalidate.
- `docs/05-VIDEO-PIPELINE.md` mô tả hai lối pass cổng.

## Bổ sung 2026-11-02 — sửa từ có độ dài 0

Director duyệt sau run `ba4dc84c` (2026-11-02). Cảnh s3 trượt cổng chỉ vì Whisper gán độ dài 0 ms cho hai từ ("code", "về"). Tỷ lệ từ đạt 24/26, độ lệch cuối 240 ms. Spike P6-02 cũng gặp lỗi này ở từ đầu câu ngắn.

**Quyết định.**

- **Sửa trong service, trước khi validate.** Từ có `endMs <= startMs` được cho một khoảng ngắn (hằng số trong code):
  - lấy từ khoảng lặng sát bên nếu đủ;
  - không thì lấy từ từ bên cạnh dài hơn.
  - Sửa chỉ khi vẫn giữ thứ tự thời gian và không vượt độ dài file.
- **Ghi rõ đã sửa.** Validation có `repairedWordCount` và một warning cho mỗi từ được sửa.
- **Tỷ lệ từ của cổng không được nâng nhờ sửa.** `alignedWordRatio` tính trên số từ **trước khi** sửa. Từ được sửa vẫn bị coi là chưa căn được, nên ngưỡng 90% giữ nguyên ý nghĩa.
- **Revalidate** (`POST /align/revalidate-gate`) áp dụng cùng phép sửa lên kết quả đã lưu và tính lại validation. Run đã lỗi bấm Tiếp tục là dùng được, không phải chạy lại Whisper.
- `GATE_POLICY_VERSION` lên `2.1.0-repair-zero-length` ở service và worker.

**Hệ quả.** Phụ đề của từ được sửa là ước lượng (dài khoảng 120 ms), không phải thời điểm đo được. Cổng ADR-011/012 về độ lệch cuối và im lặng đuôi không đổi.
