# Mục lục quyết định

| ADR | Quyết định |
|---|---|
| [ADR-001](ADR-001-monorepo-processes.md) | Monorepo, Compose, Node 24 |
| [ADR-002](ADR-002-logical-agents.md) | Vai trò logic, ba queue |
| [ADR-003](ADR-003-postgres-and-redis.md) | PostgreSQL là nguồn sự thật, Redis là queue |
| [ADR-004](ADR-004-human-approval.md) | Hai cổng duyệt, không tự approved |
| [ADR-005](ADR-005-tts-alignment.md) | VieNeu v3 CPU và forced alignment |
| [ADR-006](ADR-006-remotion-local-render.md) | Remotion local, template 2D |
| [ADR-007](ADR-007-llm-adapter.md) | Adapter Gemini, Zod sau response; `diagramJson` trước Zod; bổ sung 2026-11-02: client Claude Code (gói thuê bao) |
| [ADR-008](ADR-008-local-storage.md) | Đĩa local, key tương đối |
| [ADR-009](ADR-009-3d-monitoring.md) | 3D giám sát, fiber 9 |
| [ADR-010](ADR-010-zod-contracts.md) | Zod 4 trong `packages/contracts` |
| [ADR-011](ADR-011-whisper-alignment-default.md) | Whisper + stable-ts alignment mặc định MVP |
| [ADR-012](ADR-012-alignment-trailing-silence-gate.md) | Ngoại lệ im lặng đuôi TTS trong cổng alignment (≤400 ms, PCM); bổ sung 2026-11-02: sửa từ độ dài 0 |
| [ADR-013](ADR-013-brand-kit-and-formats.md) | Bộ nhận diện kênh, dàn ba nhân vật, gói thể loại ngoài giáo dục; bổ sung 2026-11-03: Đậu có lời thoại, ba nhân vật trong khung `wide`/`high`; bổ sung (2): một đường hoạt hình, bỏ script `1` và chọn thể loại |
| [ADR-014](ADR-014-motion-kit-and-shot-list.md) | Motion kit nhân vật SVG, shot list dữ liệu, template `StickStory`, storyboard trước cổng script; bổ sung 2026-11-03: chỉ hoạt hình, bỏ `onScreenText` và `board` khỏi script `2` |
| [ADR-015](ADR-015-multi-speaker-voice.md) | Lời thoại theo câu có người nói, giọng theo nhân vật; bổ sung 2026-11-02: căn chữ theo cảnh |
| [ADR-016](ADR-016-creative-mode-motion-assets.md) | Chế độ sáng tạo qua Claude Code, kho tài sản hình động; Claude API để ADR sau |
