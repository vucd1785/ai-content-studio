# ADR-001: Monorepo và các process

- Trạng thái: Accepted
- Ngày: 2026-10-27

## Bối cảnh

Một developer vận hành studio local. Video, TTS và API có vòng đời phụ thuộc khác nhau. Tách microservice hoặc Kubernetes làm tăng vận hành trước khi có MP4 đầu tiên.

## Quyết định

pnpm workspace cho phần TypeScript. Process chạy bằng Docker Compose: `web`, `api`, `worker`, `tts`, PostgreSQL, Redis. `api` và `worker` dùng chung package. `services/tts` là Python, ngoài workspace. Node image Phase 0 là `node:24`.

## Hệ quả

Một repository, ít hop mạng. Image worker mang Chrome của Remotion, image API thì không. Đổi sang Node 26 chỉ sau khi dòng đó vào LTS và một task được phép cập nhật image.

Xem [../02-SYSTEM-ARCHITECTURE.md](../02-SYSTEM-ARCHITECTURE.md).
