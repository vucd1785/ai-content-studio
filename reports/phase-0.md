# Phase 0 — Nghiệm thu và đóng phase

- Kết luận: **PASS — Phase 0 đóng; Phase 1 được phép mở**
- Ngày rà ban đầu: 2026-10-28
- Ngày closeout: 2026-10-28
- Quyết định Director: chấp nhận mẫu WAV **44.000 s** (Phase 0 spike); **ADR-011 Accepted** (Whisper `base` + `stable-ts` mặc định MVP)

## 1. Tóm tắt

Whisper `base` qua `stable-ts` đạt cổng số trên artifact VieNeu. CTC `nguyenvulebinh/wav2vec2-base-vietnamese-250h` không đạt cổng phủ. **ADR-011** ghi engine mặc định MVP; **ADR-005** vẫn mô tả facade TTS và `caption_override`.

Cổng trên artifact 44 giây: 143/143 interval dương, 0 overlap, `durationDeltaMs` 120 — **khả thi cấu trúc timestamp**, không chứng minh độ khớp nghe production.

Pipeline Script → MP4 chưa nối; các spike đứng riêng. Phase 1 bắt đầu tại **P1-01** (đồ thị task).

## 2. Ma trận nghiệm thu

| Task | Trạng thái | Kết quả |
|---|---|---|
| P0-01 | done | Đạt — monorepo, Compose, Node 24 trong tài liệu |
| P0-02 | done | Đạt — Zod schema + fixture |
| P0-03 | done | Đạt — TTS host; Compose TTS tùy daemon |
| P0-04 | done | `Decision: go` — Whisper artifact + tests |
| P0-05 | done | MP4 spike + Remotion 4.0.539 |

## 3. Chấp thuận Director (closeout)

| ID | Nội dung |
|---|---|
| **A — Mẫu 44 s** | Chấp nhận WAV ffprobe 44.000 s (`5bf561a3048346639aabb497df357d33.wav`) đủ cho yêu cầu Phase 0 “khoảng 45–60 giây”. Không synthesize lại. Ghi trong [05-VIDEO-PIPELINE.md](../docs/05-VIDEO-PIPELINE.md) và spike P0-04. |
| **B — ADR-011** | Whisper `base` + `stable-ts`, language `vi`, known transcript = default MVP. CTC = tùy chọn thử nghiệm. File: [ADR-011-whisper-alignment-default.md](../docs/decisions/ADR-011-whisper-alignment-default.md), trạng thái **Accepted**. |

## 4. Alignment (tóm tắt kỹ thuật)

- Engine spike đạt cổng: `whisper` / `base` trên `data/alignment/5bf561a3048346639aabb497df357d33.json`.
- CTC: không đạt cổng trên cùng loại audio VieNeu (test tích hợp ghi nhận).
- Ranh giới: `services/tts`, không service riêng.

## 5. Hạn chế đã biết (theo dõi Phase 1)

| # | Vấn đề | Task gợi ý |
|---|---|---|
| 1 | Tên/meaning `nonMonotonicWordRatio` | P1-02 |
| 2 | `passesGate` chưa yêu cầu `validation.ok` / ordering đầy đủ | P1-02 |
| 3 | Code default engine vẫn `ctc` (ADR-011 = kiến trúc; đổi runtime P1-02) | P1-02 |
| 4 | Chưa có `POST /align` | P1-02 |
| 5 | Chưa QA nghe perceptual | Director / P1-03+ |
| 6 | Compose publish port, secret mẫu, lộ lỗi 503 | Phase 2+ / hardening |
| 7 | Whisper cache trên ổ C (`%USERPROFILE%\.cache\whisper`) | P1-02 / vận hành |

## 6. Môi trường Node (closeout)

- fnm **1.39.0**, store **`E:\NodeVersions`**, Node **v24.22.1**.
- **`D:\nodejs` v22.23.4** giữ nguyên.
- Terminal: profile **AI Studio Node 24** + `scripts/dev/enter-node24.ps1`.
- Agent: **`scripts/with-node24.ps1`** hoặc `fnm exec` + `corepack pnpm` (xem `docs/12-MODEL-HANDOFF.md`).

## 7. Phase 1

- **READY WITH WARNINGS** — bắt đầu **P1-01**, sau đó **P1-02** (metric, default whisper, `/align`).
- Không bắt buộc sửa đồ thị task.

## 8. Bàn giao Composer 2.5

```text
Làm đúng task P1-01 trong docs/11-TASKS.md.
Đọc AGENTS.md, task đó, và các ADR mà task nêu.
Skill: implement-task.
Shell Agent: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/with-node24.ps1 pnpm run typecheck
Chỉ sửa File được phép.
Không sửa docs/decisions/.
Chạy mục Kiểm tra.
Viết reports/P1-01.md theo docs/12-MODEL-HANDOFF.md.
Dừng sau task này.
```

## 9. Lịch sử rà soát

Chi tiết phát hiện ban đầu (APPROVE WITH CONDITIONS) nằm trong commit closeout và ADR-011; các mục blocking Director (44 s, ADR-011, Node workspace, commit P0-04) đã xử lý trong closeout **2026-10-28**.
