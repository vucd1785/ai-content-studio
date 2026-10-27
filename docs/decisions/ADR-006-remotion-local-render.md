# ADR-006: Render Remotion tại máy local

- Trạng thái: Accepted
- Ngày: 2026-10-27

## Bối cảnh

Cần MP4 dọc lặp lại từ dữ liệu, trên một máy, trước khi có tài khoản render cloud. Studio 3D và composition video đều có thể đụng `three`.

## Quyết định

`apps/video` gọi `renderMedia()` local, H.264, 1080×1920, 30 fps. Template MVP là 2D, dữ liệu vào qua `render_props`. Package video không import React Three Fiber. Preview và export dùng cùng composition, khác CRF.

`P0-05` pin version Remotion và ghi rõ Free License một người có cần `licenseKey` cho render local hay không. Editor Starter và Remotion Lambda không dùng.

## Hệ quả

Image render có Chrome. Máy Director chịu thời gian render. Đưa R3F vào một cảnh Remotion cần ADR mới.

Xem [../05-VIDEO-PIPELINE.md](../05-VIDEO-PIPELINE.md).
