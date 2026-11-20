# Hướng dẫn cho coding agent

Đọc file này trước khi sửa repository. Nguồn sự thật là tài liệu trong `docs/`, không phải lịch sử chat.

## Đang ở đâu

Mã ứng dụng đã có cho Phase 0–5 (`apps/`, `packages/`). Tiến độ thật lấy từ trường `Trạng thái` trong [docs/11-TASKS.md](docs/11-TASKS.md) và các file `reports/<task-id>.md`, không lấy từ mục này.

Ảnh chụp ngày 2026-11-02 (nhánh `feat/phase2-5-workflow-studio`, nhiều thay đổi chưa commit):

- Đã viết report, chờ Director nghiệm thu: P2-11, P2-12, P3-12, P3-13, P3-14, P3-15, P3-16, P3-17, P4-05, P5-04. Không tự đổi sang `done`.
- P3-17 còn phải chạy lại integration test của worker (`asset-jobs.integration.test.ts`) và bộ test API khi Docker/Postgres ổn định, rồi cập nhật report.
- Chưa làm: P2-13 (Playwright, cần Director cho phép tải browser), P2-14.
- Bảo mật mục C để sau.

Ảnh chụp ngày 2026-11-10:
- Chờ Director nghiệm thu: P6-19, P6-20, P6-21, P7-01 đến P7-10. Không tự đổi sang `done`.
- Tài sản tự tạo theo [ADR-017](docs/decisions/ADR-017-auto-asset-generation.md) nằm trong `packages/motion-kit/src/assets/generated.ts` và thư mục tài sản. Chỉ worker ghi file đó.
- Playwright đã được cho phép (P7-10): `pnpm --dir apps/web e2e`.

Ảnh chụp ngày 2026-11-12:
- Chờ Director nghiệm thu: P7-11 đến P7-17. Không tự đổi sang `done`.
- Nhạc nền và SFX tự tạo trong `packages/audio-kit` ([ADR-019](docs/decisions/ADR-019-audio-library.md)). Sửa `src/synth.ts` thì chạy `pnpm --dir packages/audio-kit generate` và tăng `STICK_STORY_BASE_VERSION`.
- Chờ Director nghiệm thu thêm: P7-18 đến P7-21 ([ADR-021](docs/decisions/ADR-021-cards-redo-and-export.md)). Report: `reports/P7-18-to-P7-21.md`.
- Thẻ tiêu đề và thẻ kênh là ngoại lệ duy nhất của "không chữ trên màn hình".
- Làm lại một phần ở Cổng 2 đi qua `POST /api/workflow-runs/:runId/redo`, không ghi approval.
- Chờ Director nghiệm thu thêm: tiêu chí chất lượng hình và khung ngang 16:9 ([ADR-022](docs/decisions/ADR-022-asset-quality-and-wide-frame.md)), bối cảnh ba lớp và tông ánh sáng `mood` ([ADR-023](docs/decisions/ADR-023-depth-layers-and-scene-lighting.md)). Report: mục 8 đến 11 của `reports/P7-18-to-P7-21.md`.
- Bối cảnh mới phải có ba lớp `Far`, `Component`, `Near`; mẫu là `bg_meadow`.
- Chờ Director nghiệm thu thêm: nhịp dựng ([ADR-024](docs/decisions/ADR-024-editing-rhythm.md)), report mục 12 và 13. Brief mới dùng gói `story` v3.
- Chờ Director nghiệm thu thêm: hành động, hiệu ứng, góc máy mới ([ADR-025](docs/decisions/ADR-025-acting-effects-camera.md)), report mục 14 và 15. Hành động mới phải qua kiểm tay và khuỷu của `kit.test.tsx` với cả ba nhân vật.
- Chờ Director nghiệm thu thêm: mở đầu đọc tiêu đề và cảnh kết mời theo dõi ([ADR-026](docs/decisions/ADR-026-title-and-follow-outro.md)), report mục 16 và 17. Brief mới dùng gói `story` v4; cảnh `outro` do code dựng hình (`stageOutroScenes`).
- Chờ Director nghiệm thu thêm: bỏ trần hình tự tạo, prompt tạo hình nêu đúng API kit, tên file tải về theo chủ đề ([ADR-027](docs/decisions/ADR-027-unlimited-assets-and-download-name.md)), report mục 18.
- Chờ Director nghiệm thu thêm: avatar kênh trên thẻ kết ([ADR-028](docs/decisions/ADR-028-channel-avatar-end-card.md)), report mục 19. Avatar đặt ở `data/brand/<slug>/avatar.*`.
- Chờ Director nghiệm thu thêm: bố cục khung ngang, khung minh họa, cờ quốc gia, thẻ kết mới ([ADR-029](docs/decisions/ADR-029-wide-layout-boards-flags.md)), report mục 20. Hình phức tạp (cờ…) lấy từ nguồn có sẵn, không để AI vẽ; cờ sinh bằng `packages/motion-kit/scripts/import-flags.mts`.
- Chờ Director nghiệm thu thêm: ảnh thật trong video ([ADR-030](docs/decisions/ADR-030-real-images.md)), report mục 21. Worker là nơi duy nhất ghi tài sản ảnh (`writeImageAsset`).
- Chờ Director nghiệm thu thêm: ảnh từ mọi nguồn trên web, chân dung người nổi tiếng, khung ảnh bỏ giá vẽ, hiệu ứng `question`, trang phục `outfit`, thẻ tiêu đề dưới đáy ([ADR-032](docs/decisions/ADR-032-web-images-question-outfits.md)), report mục 22. Ảnh web đi qua `safeFetchBytes` (chặn SSRF, mọi host công khai); Claude Code chỉ bật `WebSearch` ở lần gọi tìm ảnh.

Chỉ commit khi Director yêu cầu.

## Cách làm một task

1. Chọn một task `pending` có mọi phụ thuộc `done`.
2. Đọc khối task đó, các ADR nó nêu, và tài liệu chuyên trách nó trỏ tới.
3. Gọi skill ghi trong task. Skill nằm ở `.cursor/skills/<tên>/SKILL.md`.
4. Chỉ sửa **File được phép**.
5. Chạy mục **Kiểm tra**.
6. Viết `reports/<task-id>.md` theo [docs/12-MODEL-HANDOFF.md](docs/12-MODEL-HANDOFF.md).
7. Đổi trạng thái task thành `done` hoặc `blocked`. Dừng.

Định nghĩa xong là toàn bộ tiêu chí nghiệm thu của task đó đã có bằng chứng trong report.

Phiên agent tự hành làm nhiều task liên tiếp theo [docs/13-AUTONOMOUS-AGENT-WORKFLOW.md](docs/13-AUTONOMOUS-AGENT-WORKFLOW.md) (chọn task, cổng Director, checkpoint). File đó không nới ràng buộc nào ở đây.

## Tài liệu

| Việc | File |
|---|---|
| Tầm nhìn | [docs/00-VISION.md](docs/00-VISION.md) |
| Hành vi Director | [docs/01-PRD.md](docs/01-PRD.md) |
| Process | [docs/02-SYSTEM-ARCHITECTURE.md](docs/02-SYSTEM-ARCHITECTURE.md) |
| Bảng | [docs/03-DATABASE-DESIGN.md](docs/03-DATABASE-DESIGN.md) |
| Workflow | [docs/04-AGENT-ORCHESTRATION.md](docs/04-AGENT-ORCHESTRATION.md) |
| Video | [docs/05-VIDEO-PIPELINE.md](docs/05-VIDEO-PIPELINE.md) |
| Studio 3D | [docs/06-3D-UI-DESIGN.md](docs/06-3D-UI-DESIGN.md) |
| API | [docs/07-API-CONTRACTS.md](docs/07-API-CONTRACTS.md) |
| Bảo mật | [docs/08-SECURITY.md](docs/08-SECURITY.md) |
| Test | [docs/09-TEST-STRATEGY.md](docs/09-TEST-STRATEGY.md) |
| Phase | [docs/10-IMPLEMENTATION-PLAN.md](docs/10-IMPLEMENTATION-PLAN.md) |
| Task | [docs/11-TASKS.md](docs/11-TASKS.md) |
| Đổi model | [docs/12-MODEL-HANDOFF.md](docs/12-MODEL-HANDOFF.md) |
| ADR | [docs/decisions/README.md](docs/decisions/README.md) |
| Spike Phase 6 | [docs/spikes/](docs/spikes/) (P6-01 shot list, P6-02 căn chữ, P6-03 render, P6-14 Claude Code) |
| Nhân vật kênh | [docs/design/characters/sheet.html](docs/design/characters/sheet.html) |
| Thiết kế UI (`ui-kit`, prompt) | [docs/design/README.md](docs/design/README.md) |
| Tái dùng tài sản, làm lại UI | [docs/14-ASSET-REUSE-AND-UI-PLAN.md](docs/14-ASSET-REUSE-AND-UI-PLAN.md) |
| Tài sản hình động | skill `create-motion-asset` ([.cursor](.cursor/skills/create-motion-asset/SKILL.md), [.claude](.claude/skills/create-motion-asset/SKILL.md)) |

Quyết định chưa chốt nằm ở mục tương ứng trong kế hoạch triển khai. Không tự điền model ID, license alignment, hay `licenseKey` của Remotion.

## Ranh giới

- UI và tài liệu viết tiếng Việt. Identifier, tên file, API và tên công nghệ giữ English.
- Không ghi `approved` ngoài route approval.
- Không sửa `docs/decisions/` trong task triển khai. Cần đổi ADR thì report `blocked` và gọi `review-architecture`.
- Avatar 3D chỉ vẽ trạng thái đã lưu.
- Provider LLM của ứng dụng tách khỏi model đang viết code trong Cursor.
