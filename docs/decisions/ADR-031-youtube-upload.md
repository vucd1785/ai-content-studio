# ADR-031: Đăng video lên YouTube bằng một nút, sau khi Director xác nhận

- Trạng thái: **Accepted**. Director duyệt 2026-11-16 ("Duyệt, làm đi").
- Ngày: 2026-11-16
- Liên quan:
  - [ADR-004](ADR-004-human-approval.md): duyệt của con người;
  - [ADR-018](ADR-018-publish-kit.md): bộ đăng bài. ADR này sửa câu "Agent không tự đăng lên mạng xã hội; Director đăng tay" thành "Director đăng bằng một nút có bước xác nhận riêng";
  - [ADR-021](ADR-021-cards-redo-and-export.md): ảnh bìa;
  - [ADR-027](ADR-027-unlimited-assets-and-download-name.md): tên file theo chủ đề;
  - [ADR-030](ADR-030-real-images.md): ghi công ảnh;
  - [08-SECURITY](../08-SECURITY.md) mục "Xuất bản" và "Secret".

## Bối cảnh

Director yêu cầu (2026-11-16): bấm một nút thì video cuối được đăng lên YouTube, kèm tiêu đề, mô tả, thẻ và ảnh bìa, thay cho việc tải file rồi dán từng ô từ bộ đăng bài.

[08-SECURITY](../08-SECURITY.md) mục "Xuất bản" ghi rằng muốn thêm đường đăng bài thì cần một ADR mới và một hành động xác nhận riêng của Director, không gắn vào export. ADR này là bản đó.

Thông tin YouTube Data API v3, đọc ngày 2026-11-16 ở trang tham chiếu và lịch sử thay đổi của Google:

| Điểm | Thông tin |
|---|---|
| Đăng video | `videos.insert`: video tối đa 256 GB; đặt được `privacyStatus`, `publishAt`, `selfDeclaredMadeForKids`, `containsSyntheticMedia` |
| Hạn mức đăng | Từ 2026-06-01, `videos.insert` có hạn mức riêng: 100 lần mỗi ngày mỗi dự án Google Cloud |
| Chế độ hiển thị | Từ 2026-11-02, video đăng từ dự án API chưa qua audit **không còn** bị khóa ở chế độ riêng tư (bỏ luật ngày 2020-07-28). Một số tài khoản vẫn có thể mặc định riêng tư theo cài đặt của kênh, nên phải đọc lại `privacyStatus` trong phản hồi |
| Ảnh bìa | `thumbnails.set`: JPEG hoặc PNG tối đa 50 MB, tốn khoảng 50 đơn vị trong hạn mức chung 10.000 mỗi ngày. Với Shorts thì chỉ gọi sau khi `processingStatus` là `succeeded`. Tài khoản không đủ quyền đặt ảnh bìa tùy chỉnh thì nhận lỗi 403 |
| Văn bản | Tiêu đề tối đa 100 ký tự; mô tả tối đa **5.000 byte**; cả hai không chứa `<` hoặc `>`. Thẻ tổng cộng tối đa 500 ký tự, tính cả dấu phẩy, và thẻ có khoảng trắng tính thêm hai dấu ngoặc kép |
| OAuth | Dự án ở trạng thái "Testing" chỉ nhận refresh token sống 7 ngày, khi xin scope ngoài tên, email và hồ sơ |

## Quyết định

### 1. Kết nối kênh YouTube (OAuth, một lần)

- **Dự án Google Cloud của Director.** Director tự tạo dự án, bật YouTube Data API v3 và tạo OAuth client loại "Desktop app". Studio không dùng dự án chung nào.
  - Client ID và client secret đặt trong `.env`: `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`. `.env.example` chỉ ghi tên biến.
  - Google ghi rằng với ứng dụng desktop, client secret không thật sự là bí mật. Studio vẫn không ghi nó vào log.
- **Luồng đăng nhập:**
  - Authorization code kèm PKCE (S256) và `state` ngẫu nhiên, sống 10 phút, dùng một lần.
  - Redirect loopback về API local: `http://127.0.0.1:3001/api/youtube/oauth/callback`.
  - Callback chỉ nhận đúng `state` đã tạo trong phiên Director đang đăng nhập.
- **Scope, ít nhất có thể:**
  - `youtube.upload`: đăng video và đặt ảnh bìa.
  - `youtube.readonly`: hiện đúng tên và avatar kênh đã kết nối, để không đăng nhầm kênh khi tài khoản Google có nhiều kênh thương hiệu; đọc trạng thái xử lý video trước khi đặt ảnh bìa Shorts.
  - Không xin scope quản lý hay xóa video.
- **Gắn với Bộ nhận diện kênh:** mỗi `brand_profile` kết nối tối đa một kênh YouTube. Giao diện ở Bộ nhận diện kênh có:
  - nút "Kết nối YouTube";
  - tên và avatar kênh đã kết nối;
  - nút "Ngắt kết nối": xóa token và gọi endpoint thu hồi của Google.
- **Token hết hạn 7 ngày ở chế độ Testing.** Hướng dẫn cài đặt khuyên chuyển OAuth consent screen sang "In production". Director là người dùng duy nhất nên không cần Google xác minh ứng dụng; lúc đăng nhập Google hiện cảnh báo "ứng dụng chưa được xác minh" và Director bấm tiếp tục. Nếu giữ Testing thì giao diện báo "Cần kết nối lại" khi Google từ chối refresh token.

### 2. Lưu token

- **Bảng mới `youtube_connections`:**
  - `brand_profile_id` (unique);
  - `channel_id`, `channel_title`;
  - `refresh_token_enc`, `scopes`;
  - `connected_at`, `last_error`.
- **Mã hóa:** refresh token mã hóa AES-256-GCM, khóa lấy từ biến môi trường mới `STUDIO_TOKEN_KEY` (32 byte, base64). Thiếu khóa thì nút kết nối báo cấu hình thiếu, không lưu token dạng thô.
- **Access token** chỉ giữ trong bộ nhớ worker, không lưu.
- **Log:** không bao giờ chứa token, code, `state`, verifier hay header `Authorization`. Thêm test kiểm log.
- **Để sau, cùng mục C:** xoay khóa, keychain của hệ điều hành, tách quyền đọc bảng.

### 3. Nút "Đăng lên YouTube" và bước xác nhận

- **Điều kiện:** nút chỉ hiện ở tab Bản cuối khi run `exported`, có `publish_kit` và kênh đã kết nối. Không tự đăng sau export, không gắn vào route approval, không ghi `approved`.
- **Hộp xác nhận** điền sẵn từ phần YouTube của bộ đăng bài; Director sửa được mọi ô:

  | Ô | Mặc định | Ghi chú |
  |---|---|---|
  | Tiêu đề | từ bộ đăng bài | đếm ký tự, tối đa 100 |
  | Mô tả | từ bộ đăng bài | đếm byte, tối đa 5.000 |
  | Thẻ | từ bộ đăng bài | đếm theo cách tính của YouTube, tối đa 500 |
  | Chế độ hiển thị | **Riêng tư** | Riêng tư, Không công khai, Công khai, Hẹn giờ (chọn ngày giờ; gửi `private` kèm `publishAt`) |
  | Dành cho trẻ em | không chọn sẵn | bắt buộc chọn Có hoặc Không mỗi lần đăng, vì đây là khai báo pháp lý của chủ kênh |
  | Nội dung tổng hợp trông như thật | Không | video hoạt hình không thuộc loại này; nếu có cảnh trông như thật thì Director bật |
  | Danh mục | Giáo dục (`27`) | |
  | Ngôn ngữ | `vi` | cả `defaultLanguage` và `defaultAudioLanguage` |
  | Ảnh bìa | ảnh bìa của bản xuất | xem trước; bỏ chọn được |

  - Hộp xác nhận ghi rõ tên kênh sẽ đăng lên, rồi nút "Đăng".
  - Không đăng khi còn dòng nhắc `[CHƯA CÓ LIÊN HỆ…]` trong mô tả.
- **Đã đăng rồi:** một bản xuất đã có video trên YouTube thì nút đổi thành link "Xem trên YouTube". Muốn đăng thêm lần nữa thì Director bấm "Đăng bản mới" và xác nhận lần hai. Việc này tạo một video riêng trên YouTube; Studio không sửa hay xóa video đã đăng.

### 4. Job `youtube_upload`

- **Hàng đợi:**
  - BullMQ queue mới `upload`, concurrency 1;
  - vai agent `publish`;
  - khóa job: `youtube:<exportArtifactId>:<lần>`.
  - Run giữ `exported`. Lỗi không đổi trạng thái run, giống job `publish` ở ADR-018.
- **Upload resumable, không đăng trùng:**
  1. Tạo phiên upload resumable rồi lưu URI phiên vào bảng `youtube_uploads` (một hàng cho mỗi lần bấm "Đăng", giữ các ô đã xác nhận) trước khi gửi byte nào.
  2. Gửi file MP4 theo từng khúc 8 MB. Lỗi mạng hoặc 5xx thì hỏi phiên đang ở byte nào (`Content-Range: bytes */<size>`) rồi gửi tiếp. Không tạo phiên mới khi phiên cũ còn sống.
  3. Có `videoId` thì lưu ngay. Từ đó mọi lần thử lại bỏ qua bước upload.
- **Ảnh bìa:**
  - Có `videoId` thì đọc `processingDetails` (tối đa 10 phút, mỗi lần cách 20 giây), rồi gọi `thumbnails.set` với file JPEG của bản xuất.
  - Lỗi 403 (kênh chưa đủ quyền ảnh bìa tùy chỉnh) hoặc hết thời gian thì video vẫn coi là đã đăng. Ảnh bìa ghi trạng thái lỗi kèm lý do, và giao diện có nút "Đặt lại ảnh bìa".
- **Kết quả:** artifact mới `youtube_upload` (schema v1), gồm:
  - `videoId`, `url`;
  - `privacyStatus` **đọc lại từ phản hồi**;
  - `publishAt`;
  - `thumbnail: "set" | "failed" | "skipped"` và lý do;
  - `channelId`, `exportArtifactId`, `uploadedAt`.
- **Lỗi có mã:**

  | Mã | Khi nào | Giao diện |
  |---|---|---|
  | `youtube_quota` | 403 `quotaExceeded` hoặc `uploadLimitExceeded` | báo hết hạn mức; hạn mức đặt lại lúc 0 giờ giờ Thái Bình Dương, tức 14 giờ (mùa hè) hoặc 15 giờ giờ Việt Nam |
  | `youtube_auth` | refresh token bị từ chối | báo "Cần kết nối lại" |
  | `youtube_rejected` | 400 kèm lý do của YouTube | hiện lý do |
  | `youtube_network` | lỗi mạng | thử lại có trần |

- **Mạng:**
  - Worker chỉ gọi `oauth2.googleapis.com`, `www.googleapis.com` và `youtube.googleapis.com`, không theo redirect sang host khác.
  - User-Agent chung của công cụ.

### 5. Văn bản đúng giới hạn của YouTube

Sửa ở bộ đăng bài, áp dụng cho cả việc dán tay:

- Mô tả cắt theo **5.000 byte UTF-8**, không theo 5.000 ký tự, vì chữ tiếng Việt có dấu tốn 2–3 byte mỗi ký tự. Chỗ cắt nằm ở ranh giới dòng hoặc từ, và phần chân bản quyền cùng mục "Nguồn hình ảnh" luôn còn.
- Thay `<` và `>` trong tiêu đề và mô tả bằng `‹` và `›`.
- Thẻ cắt theo cách tính của YouTube (dấu phẩy và ngoặc kép đều tính).

### 6. API mới

| Method | Path | Ý nghĩa |
|---|---|---|
| `GET` | `/api/youtube/connection` | Trạng thái kết nối của kênh hiện tại: tên kênh, avatar, lỗi gần nhất. Không trả token |
| `POST` | `/api/youtube/oauth/start` | Trả URL đăng nhập Google (có PKCE và `state`). Cần phiên Director và Origin hợp lệ |
| `GET` | `/api/youtube/oauth/callback` | Google redirect về. Kiểm `state`, đổi code, lưu token mã hóa, đóng tab bằng trang báo xong |
| `DELETE` | `/api/youtube/connection` | Ngắt kết nối, thu hồi token |
| `POST` | `/api/workflow-runs/:runId/youtube-uploads` | Body là các ô của hộp xác nhận, kiểm bằng Zod. `202 { status: "queued" }`. `409` khi run chưa `exported`, chưa kết nối, đang có job upload, hoặc bản xuất đã đăng mà thiếu `confirmRepeat: true` |
| `POST` | `/api/youtube-uploads/:artifactId/thumbnail` | Đặt lại ảnh bìa cho video đã đăng |

## Phương án đã cân nhắc

- **Tự đăng ngay sau export:** nhanh hơn, nhưng trái mục "Xuất bản" của 08-SECURITY. Đăng là việc công khai, khó rút lại, nên cần một bước xác nhận riêng.
- **Một dự án Google Cloud dùng chung, Studio giữ sẵn client:** Director không phải cài đặt gì, nhưng một client chung phải qua thẩm định của Google và gom hạn mức của mọi người dùng. Studio là công cụ local một người dùng.
- **Lưu refresh token dạng thô trong `data/`:** đơn giản hơn, nhưng ai đọc được ổ đĩa là đăng được lên kênh. Mã hóa bằng khóa trong `.env` không thay được bảo mật mục C, nhưng ít nhất token không lộ khi chỉ sao chép `data/`.
- **Chỉ xin `youtube.upload`:** ít quyền hơn, nhưng không biết được kênh nào đang kết nối và không đọc được trạng thái xử lý để đặt ảnh bìa Shorts.
- **Facebook, TikTok cùng lúc:** mỗi nền tảng có quy trình duyệt app riêng (TikTok Content Posting API cần audit mới đăng công khai được). Làm sau, mỗi nền tảng một ADR.

## Hệ quả

- Director làm một lần khoảng 15 phút: tạo dự án Google Cloud, OAuth client, thêm ba biến vào `.env`, kết nối kênh. Có trang hướng dẫn từng bước trong Studio.
- Studio lần đầu gửi dữ liệu ra ngoài thay mặt Director. Mọi lần đăng đều qua hộp xác nhận, ghi job và artifact để tra lại.
- Mặc định "Riêng tư" nên video không công khai ngay; Director chọn khác ngay trong hộp xác nhận.
- Hạn mức đủ dư: 100 video mỗi ngày; ảnh bìa và đọc trạng thái tốn khoảng 60 đơn vị mỗi video trong 10.000.
- Chính sách YouTube có thể đổi (luật riêng tư vừa đổi 2026-11-02). Trang hướng dẫn ghi ngày kiểm tra, và job luôn đọc lại `privacyStatus` thật.
- Sửa video sau khi đăng, playlist, xóa video: không làm, Director dùng YouTube Studio.

## Kế hoạch triển khai

Khi ADR được duyệt, các task dưới đây vào [11-TASKS.md](../11-TASKS.md) thành Phase 8. Mỗi task có report riêng và chờ Director nghiệm thu.

| Task | Việc | Phụ thuộc | Kiểm tra |
|---|---|---|---|
| P8-01 | Bộ đăng bài theo giới hạn YouTube: mô tả 5.000 byte, bỏ `<` `>`, thẻ 500 ký tự (mục 5) | — | unit test với mô tả tiếng Việt dài, thẻ có khoảng trắng |
| P8-02 | Migration `0008`: bảng `youtube_connections`, artifact `youtube_upload`, queue `upload`; contracts Zod cho hộp xác nhận và artifact | — | test migration, test schema |
| P8-03 | Mã hóa token (`STUDIO_TOKEN_KEY`, AES-256-GCM); route OAuth start, callback, connection, delete; PKCE, `state` một lần | P8-02 | integration test với Google giả: sai `state`, `state` hết hạn, dùng lại, thiếu khóa; log không chứa token |
| P8-04 | Client YouTube trong worker: refresh token, upload resumable có resume, đọc trạng thái xử lý, `thumbnails.set`; allowlist host | P8-02 | unit test với server giả: đứt giữa chừng rồi resume, lỗi sau khúc cuối không đăng trùng, 403 quota, 403 ảnh bìa |
| P8-05 | Job `youtube_upload`, route `youtube-uploads`, đặt lại ảnh bìa; khóa job, 409 | P8-03, P8-04 | integration test API và worker |
| P8-06 | Giao diện: kết nối ở Bộ nhận diện kênh; nút và hộp xác nhận ở Bản cuối; link "Xem trên YouTube"; trang hướng dẫn cài đặt | P8-05 | test component, Playwright với API giả |
| P8-07 | Thử thật với kênh của Director: đăng một video riêng tư, kiểm tiêu đề, mô tả, ảnh bìa | P8-06, Director kết nối kênh | report có link video và ảnh chụp |

Cần Director làm:
- duyệt ADR này;
- ở P8-07, tạo dự án Google Cloud theo trang hướng dẫn và tự đăng nhập Google. Agent không nhập mật khẩu Google.

08-SECURITY mục "Secret" và "Xuất bản", 07-API-CONTRACTS và 03-DATABASE-DESIGN được cập nhật trong các task trên.

## Bổ sung 2026-11-16: nhập Client ID và secret trên giao diện

Director yêu cầu (2026-11-16): nhập Client ID, Client secret ngay trên màn hình rồi lưu vào `.env`, thay cho việc tự sửa file.

- **Form "Cấu hình OAuth của Google"** nằm trong khối Kênh YouTube ở Bộ nhận diện kênh.
  - Hiện khi chưa cấu hình, hoặc khi bấm "Đổi Client ID / secret".
  - Ô secret là ô mật khẩu; secret không bao giờ hiện lại.
  - Đã có secret thì bỏ trống ô secret để giữ secret cũ.
- **`PUT /api/youtube/config`** (cần phiên Director và Origin hợp lệ, như mọi route ghi):
  - Kiểm định dạng: Client ID khớp `…apps.googleusercontent.com`; secret chỉ gồm chữ, số, `-`, `_`. Không có khoảng trắng hay xuống dòng, nên không chèn được dòng lạ vào `.env`.
  - Ghi đúng `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` vào `.env` ở gốc repo (`updateEnvFile`):
    - thay dòng có sẵn, thêm dòng thiếu;
    - giữ mọi dòng khác, chú thích và kiểu xuống dòng;
    - ghi file tạm rồi đổi tên.
  - `STUDIO_TOKEN_KEY` chỉ tạo khi `.env` chưa có. Không bao giờ ghi đè khóa đã có, vì token cũ sẽ không giải mã được.
  - API dùng cấu hình mới ngay, không cần khởi động lại.
  - Đổi Client ID khi kênh đang kết nối thì kết nối ghi "Cần kết nối lại".
  - Phản hồi không chứa secret. Log che `req.body.clientSecret`.
- **Worker** đọc lại `.env` mỗi lần chạy job đăng (`loadYoutubeEnvFresh`), nên không cần khởi động lại sau khi lưu.
- **`GET /api/youtube/connection`** thêm `clientIdHint` (che phần giữa) và `hasClientSecret`.
- **Rủi ro chấp nhận:** API có quyền ghi `.env` cho ba biến này. Studio chỉ nghe `127.0.0.1` và mọi route ghi cần phiên Director. Chuyển secret sang kho bí mật của hệ điều hành thuộc mục C, để sau.
