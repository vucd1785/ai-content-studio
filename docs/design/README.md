# Thiết kế: mục lục

Thư mục này chứa tài liệu và tài nguyên thiết kế. Nguồn sự thật về hành vi vẫn là `docs/00`–`13` và ADR. Khi tài liệu ở đây khác các file đó, theo ADR và ghi điểm lệch vào [kế hoạch 14](../14-ASSET-REUSE-AND-UI-PLAN.md).

| Đường dẫn | Nội dung | Dùng thế nào |
|---|---|---|
| [characters/sheet.html](characters/sheet.html) | Bảng nhân vật kênh (Tí, Bit, Đậu) của motion kit | Nguồn hình nhân vật **trong video** |
| [prompts/claude-code-ui-master-prompt.md](prompts/claude-code-ui-master-prompt.md) | Prompt Director viết cho việc làm lại UI/UX (2026-11-10) | Yêu cầu đầu vào của kế hoạch 14 |
| [prompts/cursor-ui-master-prompt.superseded.md](prompts/cursor-ui-master-prompt.superseded.md) | Bản Cursor cũ của prompt trên, gần như trùng | Chỉ để tra; không dùng |
| [ui-kit/](ui-kit/00_START_HERE/README.md) | Bộ thiết kế UI v1: token, minh họa, robot vai trò, ảnh mẫu, demo HTML | Tài nguyên **giao diện web** |

## Bộ `ui-kit`

| Thư mục | Nội dung | Vào app? |
|---|---|---|
| `00_START_HERE` | README, `ASSET_MANIFEST.json`, ghi chú font | Không |
| `01_CHARACTERS` | Tí, Bit, Đậu dạng minh họa UI, mỗi nhân vật 4 tư thế, kèm hình bộ ba (SVG, PNG) | Có, dùng SVG: lời chào, trạng thái trống, đăng nhập |
| `02_AGENT_ROBOTS` | 7 robot vai trò | Có, dùng SVG: danh sách vai trò 2D, bảng chi tiết |
| `03_STUDIO_3D` | Ảnh isometric xưởng, sáng và tối | Chỉ làm placeholder có nhãn, không phải canvas 3D |
| `04_UI_ILLUSTRATIONS` | Đăng nhập, trống, chờ duyệt, worker tắt, mất kết nối, xuất xong, nền | Có, dùng SVG |
| `05_STORYBOARD_SAMPLES` | 5 ảnh storyboard mẫu | Chỉ cho dữ liệu mẫu có nhãn ở dev và test; không bao giờ coi là artifact thật |
| `06_PROPS_AND_BRANDING` | Logo, favicon, 8 đồ vật minh họa | Logo và favicon vào app. Đồ vật chỉ minh họa UI, không phải tài sản video |
| `07_DESIGN_TOKENS` | `design-tokens.json`, `theme.css` | Nguồn token cho theme mới |
| `08_HIFI_REFERENCES` | 3 mockup do AI tạo (7 MB), chữ có thể sai dấu | Chỉ moodboard |
| `09_LIVE_HTML_DEMO` | Demo HTML dữ liệu giả và 7 ảnh chụp | Mẫu tham chiếu bố cục |

## Lưu ý khi dùng

- **Hai bộ hình nhân vật khác nhau.**
  - Video dùng nhân vật vẽ bằng code trong `packages/motion-kit`, có rig và hành động.
  - `ui-kit/01_CHARACTERS` là minh họa tĩnh cho giao diện, nét gần giống nhưng không cùng hình (ví dụ Đậu).
  - Không đưa SVG của `ui-kit` vào video, và không coi chúng là tài sản của "Kho hình động".
- **Đồ vật `ui-kit/06_PROPS_AND_BRANDING` không phải đồ vật video.** Đồ vật video là component `prop_*` trong motion kit (P6-19).
- **Font:** app web và phụ đề video dùng Be Vietnam Pro (SIL OFL 1.1). Từ P6-21, file font nằm trong `apps/video/src/fonts`; web sẽ dùng chung bản đó.
- **Ảnh mockup** (`08`, `09/screenshots`) không được nhúng làm UI. Mọi chữ trên giao diện render bằng code tiếng Việt.
- **Điểm prompt khác tài liệu đã duyệt.** Kế hoạch 14 mục 1.3 liệt kê từng điểm và cách xử lý. Ví dụ: prompt gộp duyệt tài sản vào Cổng 1, còn [06](../06-3D-UI-DESIGN.md) và ADR-016 để việc này ở màn "Kho hình động".
