# Spike P0-05 — Remotion render trong container

## Mục tiêu

Render MP4 ngắn **1080×1920**, **30 fps**, **H.264**, từ composition 2D và props cố định.

## Phiên bản

| Thành phần | Version |
|------------|---------|
| Remotion | **4.0.539** (`remotion`, `@remotion/bundler`, `@remotion/renderer`, `@remotion/cli`) |
| Node (image Docker) | **24** (`node:24-bookworm-slim`) |
| Composition ID | `P0Spike` |

## License (Free License — một người, render local)

- Remotion **4.x** (dưới 5.0): `licenseKey` trên `renderMedia()` là **tùy chọn** — không truyền key vẫn render được ([licensing](https://www.remotion.dev/docs/licensing)).
- Từ Remotion **5.0**, telemetry qua `licenseKey` sẽ bắt buộc cho Automators; studio đang pin **4.0.539**.
- Không dùng Lambda / Cloud Run / Editor Starter trong spike này.

## Lệnh tái hiện

### Trên host (Node 24, sau `pnpm install`)

```powershell
fnm env --shell powershell | Invoke-Expression
fnm use 24
cd E:\Docker\ai-content-studio
$env:DATA_DIR="E:\Docker\ai-content-studio\data"
pnpm --filter @studio/video test
pnpm --filter @studio/video render:spike
ffprobe -v error -show_entries stream=width,height,r_frame_rate,codec_name -show_entries format=duration -of default=noprint_wrappers=1 E:\Docker\ai-content-studio\data\render\P0-05-spike.mp4
```

### Trong Docker (khuyến nghị task)

```powershell
cd E:\Docker\ai-content-studio
docker compose --profile render run --rm video-render
ffprobe -v error -show_entries stream=width,height,r_frame_rate,codec_name -show_entries format=duration -of default=noprint_wrappers=1 data\render\P0-05-spike.mp4
```

Output: `data/render/P0-05-spike.mp4` (volume `./data` trên ổ E:).

## Kiểm tra nghiệm thu

- ffprobe: width=1080, height=1920, fps≈30, codec h264
- `pnpm --filter @studio/video test` — không import `three` / `@react-three/fiber`
- MP4 phát được trong trình phát hệ thống

## Kết quả đo (2026-10-27, Docker)

| Chỉ số | Giá trị |
|--------|---------|
| `duration` | 3.000 s |
| `r_frame_rate` | 30/1 |
| `codec_name` | h264 |
| Kích thước file | 103 091 bytes |
| Bundle (container) | 129.62 s |
| `renderMedia` | 95.05 s |
