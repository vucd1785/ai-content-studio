# AI Content Studio

Studio local-first để một Director sản xuất video giáo dục dọc, 1080×1920, 30 fps, khoảng 30–90 giây. Agent chuẩn bị nghiên cứu, kịch bản, giọng đọc và video. Director duyệt kịch bản và video cuối.

Mốc chức năng đầu tiên là pipeline thật:

**Script JSON → VieNeu-TTS → forced alignment → template Remotion → MP4.**

Web, cổng duyệt, orchestration và studio 3D nằm sau mốc đó. Xem [docs/01-PRD.md](docs/01-PRD.md).

## Trạng thái repository

Skeleton monorepo (`P0-01`) đã có: workspace pnpm, TypeScript strict, Biome, Compose PostgreSQL 17 và Redis 7. Chưa có route API, TTS hay Remotion.

Đọc [AGENTS.md](AGENTS.md) trước khi giao việc cho model. Task tiếp theo thường là `P0-02`, `P0-03`, hoặc `P0-05` (cùng phụ thuộc `P0-01`).

## Bản đồ thư mục

| Đường dẫn | Việc |
|---|---|
| `docs/` | Đặc tả. Mỗi file một chủ đề. |
| `docs/decisions/` | ADR đã chấp nhận. |
| `docs/11-TASKS.md` | Backlog có ID ổn định. |
| `docs/12-MODEL-HANDOFF.md` | Cách Grok 4.7 và Composer 2.5 bàn giao qua Git và report. |
| `reports/` | Báo cáo từng task. Hiện chỉ có hướng dẫn. |
| `.cursor/rules/` | Rule. Chỉ `core.mdc` áp dụng mọi phiên. |
| `.cursor/skills/` | Quy trình gọi tay: triển khai, review, workflow, video, 3D, debug, nghiệm thu phase. |

## Đọc theo thứ tự

1. [docs/00-VISION.md](docs/00-VISION.md)
2. [docs/02-SYSTEM-ARCHITECTURE.md](docs/02-SYSTEM-ARCHITECTURE.md)
3. [docs/10-IMPLEMENTATION-PLAN.md](docs/10-IMPLEMENTATION-PLAN.md)
4. [docs/11-TASKS.md](docs/11-TASKS.md)

Các file còn lại được mở khi task trỏ tới chúng. Quyết định chưa chốt (model ID, license alignment, license Remotion, tag image) nằm trong [docs/10-IMPLEMENTATION-PLAN.md](docs/10-IMPLEMENTATION-PLAN.md).

## Stack đã chốt

pnpm, React 19, Vite, Tailwind CSS v4, shadcn/ui, Zustand, TanStack Query, React Three Fiber 9, Drei 10, Fastify 5, Zod 4.2, Drizzle, PostgreSQL, Redis, BullMQ, SSE, Remotion local, FastAPI, VieNeu-TTS v3 Turbo trên CPU. Node image Phase 0 là `node:24`. Gemini là provider LLM đầu tiên.

Chi tiết process: [docs/02-SYSTEM-ARCHITECTURE.md](docs/02-SYSTEM-ARCHITECTURE.md).

## Cài đặt

Yêu cầu: Node.js 24+, pnpm 9+, Docker Compose (cho Postgres và Redis).

```bash
cp .env.example .env
# Điền STUDIO_PASSWORD, STUDIO_SESSION_SECRET, GEMINI_API_KEY khi cần task LLM.

pnpm install
pnpm run typecheck
pnpm -r run typecheck
docker compose config
docker compose up -d postgres redis
```

Runtime Node cho container app TypeScript: `node:24` (ghi trong `package.json` engines và comment `docker-compose.yml`). `services/tts` là Python và không nằm trong pnpm workspace.

Task và báo cáo: [docs/11-TASKS.md](docs/11-TASKS.md), [reports/P0-01.md](reports/P0-01.md).

`P0-04` phải kết thúc bằng `Decision: go` thì Phase 1 mới được mở. Pipeline MP4 từ fixture là task `P1-06`.
