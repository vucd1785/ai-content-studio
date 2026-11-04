# Spike P6-02: căn chữ câu ngắn theo người nói

Ngày: 2026-11-02. Người làm: Claude Opus 5.5. Task: [P6-02](../11-TASKS.md). ADR: [ADR-015](../decisions/ADR-015-multi-speaker-voice.md), [ADR-011](../decisions/ADR-011-whisper-alignment-default.md), [ADR-012](../decisions/ADR-012-alignment-trailing-silence-gate.md).

## Câu hỏi

ADR-015 định căn chữ **theo từng câu**. Với Whisper `base`, câu rất ngắn (dưới 1 giây, kiểu "Tua lại.") có qua được cổng alignment hiện hành không? Nếu không thì xử lý thế nào?

## Cách đo

- **Môi trường:** script [`services/tts/scripts/spike_p6_02.py`](../../services/tts/scripts/spike_p6_02.py) chạy trong một container tạm, dùng cùng image `tts`. Container chính được tạm dừng để chỉ có một bản model trong RAM (VM Docker có 3,8 GB), và bật lại sau khi đo. Script gọi thẳng engine VieNeu v3 Turbo, `align_transcript_to_wav` (Whisper `base`) và `evaluate_go_gate`, tức là đúng code, đúng model và đúng cổng của service. Đầu ra chỉ ghi vào `data/spikes/p6-02/`, không đụng `data/tts` hay `data/alignment`.
- **Hai giọng thử:** "Mai Anh" (giọng mặc định của compose) và "Hải Đăng" (giọng mặc định của engine). Đây chỉ là giọng để đo, không phải giọng của nhân vật; Director chọn giọng ở P6-08.
- **20 câu:** 10 câu ngắn (1–2 từ, 480–800 ms) và 10 câu vừa (3–11 từ, 960–3040 ms). Có một câu chứa từ vay mượn ("Redis").
- **Ba thí nghiệm:**
  - **A. Căn từng câu.**
  - **B. Câu ngắn đệm 300 ms im lặng ở hai đầu,** rồi căn.
  - **C. Ghép cảnh hội thoại:** 4 cảnh, mỗi cảnh 5 câu, hai giọng xen nhau, nghỉ 250 ms giữa các câu. Căn **một lần** cho cả cảnh với toàn bộ transcript. Sau đó kiểm từng từ của mỗi câu có nằm trong đoạn của chính câu đó không, dung sai ±120 ms. Ranh giới câu biết chính xác vì do code ghép.

Lệnh chạy lại, từ gốc repo:

```powershell
docker compose stop tts
docker compose --profile cpu run --rm --no-deps -T tts python - < services/tts/scripts/spike_p6_02.py
docker compose --profile cpu up -d tts
```

Kết quả nằm ở `data/spikes/p6-02/results.json` (WAV, alignment JSON, `run.log`). Lần chạy này exit 0.

## Kết quả

### A. Căn từng câu

| Giọng | Loại câu | Qua cổng | Lỗi |
|---|---|---|---|
| Mai Anh | ngắn | 8/10 | "Sai rồi.", "Bit ơi!": từ đầu bị Whisper cho độ dài 0 (`invalid interval at index 0`) |
| Mai Anh | vừa | 10/10 | |
| Hải Đăng | ngắn | 8/10 | "Tua lại.", "Thật à?": từ cuối kết thúc sớm 260 ms trước hết file, vượt ngưỡng 250 ms, phần đuôi không đủ im lặng để được miễn |
| Hải Đăng | vừa | 10/10 | |

**Tổng:** câu ngắn đạt 16/20 (80%), câu vừa đạt 20/20.

Mỗi lần căn mất **6,4–8,2 giây**, gần như không phụ thuộc độ dài câu, vì chi phí cố định của Whisper chiếm phần lớn.

### B. Câu ngắn đệm im lặng

Chỉ đạt **2/20**. Đệm làm tình hình **tệ hơn**: cổng đo khoảng cách từ từ cuối tới hết file, nên 300 ms im lặng thêm vào đẩy độ lệch lên 400–1060 ms. Lỗi "từ đầu dài 0" của Mai Anh vẫn còn. Cách này bị loại.

### C. Căn cả cảnh hai giọng một lần

| Cảnh | Qua cổng | Độ lệch cuối | Từ nằm đúng đoạn câu |
|---|---|---|---|
| c1 | có | 120 ms | 100% |
| c2 | có | 160 ms | 95,5% (một từ của "Bit ơi!" lệch quá 120 ms) |
| c3 | có | 200 ms | 100% |
| c4 | có | 100 ms | 100% |

Cả 4 cảnh qua cổng, kể cả các câu ngắn từng trượt ở thí nghiệm A ("Sai rồi.", "Tua lại.", "Thật à?", "Bit ơi!"). Đổi giọng giữa cảnh không làm Whisper lạc. Mỗi cảnh căn mất **6,4–6,8 giây**, bằng thời gian căn một câu lẻ.

### Thời gian đọc lời

40 câu (52,4 giây audio) đọc mất 305,5 giây, RTF khoảng 5,8. Câu ngắn có chi phí cố định cao so với độ dài.

## Kết luận

1. Căn **từng câu** không đủ tin cậy với câu ngắn: 20% trượt cổng, do hai lỗi khác nhau của Whisper trên đoạn audio rất ngắn.
2. Đệm im lặng không giúp, và còn xung đột với quy tắc độ lệch đuôi của cổng (ADR-012).
3. **Căn cả cảnh** (audio đã ghép từ các câu đọc riêng) qua cổng 4/4. Từ rơi đúng câu 98,9% (88/89). Nhanh hơn khoảng 5 lần so với căn từng câu, vì 5 câu chỉ cần một lần gọi Whisper.

## Đề xuất (Director duyệt 2026-11-02, ghi ở mục Bổ sung của ADR-015)

ADR-015 ghi "Mỗi câu được căn riêng". Spike cho thấy nên đổi như sau:

- **Đọc lời theo câu** như ADR-015: giọng theo người nói, cache theo câu.
- **Căn chữ theo cảnh:** ghép các câu của cảnh, giữa các câu nghỉ một khoảng hằng số, rồi căn một lần với transcript của cả cảnh. Cổng áp dụng cho cả cảnh như hiện nay, không đổi ADR-011/012.
- **Chia từ về câu** theo thứ tự token. Ranh giới câu lấy từ vị trí ghép do code biết chính xác. Từ nào nằm ngoài đoạn câu quá dung sai thì kẹp về trong đoạn và ghi warning QA.
- **Dự phòng:** cảnh trượt cổng thì căn lại từng câu vừa, rồi gộp các câu ngắn liền nhau.
- **Sửa một câu:** chỉ đọc lại câu đó (cache), nhưng phải căn lại cả cảnh. Mất khoảng 7 giây, chấp nhận được.

Đổi này cần một mục **Bổ sung** trong ADR-015 (như ADR-007 có bổ sung `diagramJson`), Director duyệt trước P6-08.

## Giới hạn

- Mỗi câu đo một lần, không lặp nhiều lần. Chỉ 2 trong 25 giọng.
- Kiểm "từ nằm đúng đoạn câu" chỉ kiểm vị trí, không có timestamp chuẩn để đo độ chính xác tuyệt đối của từng từ.
- Ánh xạ từ về câu dựa trên số token khớp với tách từ của pipeline. Lần chạy này khớp; transcript có số, ngày tháng (được chuẩn hóa sang dạng nói) thì phải đếm theo token sau chuẩn hóa.
