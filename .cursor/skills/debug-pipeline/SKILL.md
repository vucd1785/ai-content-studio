---
name: debug-pipeline
description: Chẩn đoán lỗi TTS, alignment, render, job kẹt hoặc approval không khớp artifact. Dùng khi người dùng gọi debug-pipeline hoặc một task media thất bại giữa chừng.
disable-model-invocation: true
---

# debug-pipeline

## Mục đích và cách gọi

Dùng khi một lệnh pipeline, spike, hoặc job thất bại và cần khoanh đúng tầng trước khi sửa. Sửa vẫn phải nằm trong file task cho phép.

## Đầu vào và tài liệu bắt buộc

- Report hoặc log của lệnh vừa chạy
- `docs/05-VIDEO-PIPELINE.md`
- `docs/04-AGENT-ORCHESTRATION.md` nếu lỗi là trạng thái job
- Artifact ID hoặc đường dẫn WAV/MP4 liên quan

## Quy trình

1. Phân loại: schema, TTS, alignment, props, render, queue, approval.
2. Đọc artifact cha và hash. Xác định bước đã `completed` để không gọi lại.
3. Với media, đo lại duration bằng ffprobe trước khi đổi timestamp.
4. Với caption, so số từ transcript với số token alignment.
5. Sửa đúng tầng đó trong phạm vi task. Thêm một test tái hiện lỗi nếu tầng đó có unit test.
6. Ghi nguyên nhân và lệnh tái hiện trong report.

## Lệnh được phép

Lệnh kiểm tra của task, ffprobe, log container, test nhắm đúng file. Không xóa volume Postgres.

## Đầu ra

Nguyên nhân một câu, file đã sửa, lệnh chứng minh lỗi cũ không còn, hoặc lý do `blocked`.

## Cách kiểm tra

Chạy lại đúng lệnh đã thất bại. Với alignment, không chấp nhận bản sửa bằng cách chia đều thời gian.

## Định nghĩa xong

Lệnh thất bại trước đó đã qua, hoặc report `blocked` nói rõ tầng và dữ liệu đo được.

## Dừng và leo thang

Dừng sau hai lần sửa cùng một triệu chứng mà số đo không đổi. Leo thang bằng `review-architecture` nếu cần đổi VieNeu, Remotion, hoặc cách alignment khỏi ADR.
