# Giấy phép thư viện âm thanh

Mọi file trong `assets/` (nhạc nền `music_*.wav` và hiệu ứng `sfx_*.wav`) được tạo hoàn toàn bằng code trong
`src/synth.ts` của repo này, theo yêu cầu của Director ngày 2026-11-11 (ADR-019).

- Không dùng mẫu thu âm, loop, preset hay bản nhạc nào của bên thứ ba.
- Giai điệu, hợp âm và nhịp là vòng hợp âm phổ thông (I–V–vi–IV và tương tự). Vòng hợp âm không được bảo hộ
  bản quyền riêng.
- Chủ dự án AI Content Studio là chủ sở hữu. Được dùng trong video của kênh, kể cả video bật kiếm tiền, không
  cần ghi công.

Vì nhạc không có trong thư viện của YouTube hay Content ID của bên thứ ba, video dùng nhạc này không bị khiếu
nại Content ID do nhạc nền. Nếu sau này đăng ký nhạc này với một dịch vụ Content ID, các video cũ của chính kênh
có thể bị khớp. Không nên đăng ký.

Tạo lại file: `pnpm --dir packages/audio-kit generate`. Kết quả tất định; `assets/manifest.json` ghi sha256.
