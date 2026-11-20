/**
 * Nội dung trang "Hướng dẫn đăng bài" (ADR-018): quy trình chung cho mọi video, không theo từng video.
 * Chính sách nền tảng đổi thường xuyên: chỉ ghi điều đã kiểm với nguồn chính thức hoặc nhiều nguồn khớp nhau
 * (tra ngày 2026-11-11); con số ngưỡng kiếm tiền không ghi vì khác theo khu vực và hay đổi.
 */
export type GuideSection = {
  id: string;
  title: string;
  steps: string[];
  links?: { label: string; href: string }[];
};

export const GUIDE_UPDATED = "Cập nhật 11/2026";

export const GUIDE_INTRO =
  "Quy trình chung cho mọi video của studio. Nội dung riêng của từng video (tiêu đề, mô tả, hashtag) nằm ở tab Bản cuối, mục Bộ đăng bài.";

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "before",
    title: "1. Trước khi đăng (cả ba nền tảng)",
    steps: [
      "Tải MP4 ở tab Bản cuối (nút “Tải bản xuất”).",
      "Mở Bộ đăng bài, đọc lại tiêu đề và mô tả: đúng nội dung video, không hứa điều video không có. Sửa trực tiếp khi dán nếu cần.",
      "Điền “Liên hệ bản quyền” ở Bộ nhận diện kênh một lần. Nếu mô tả còn dòng [CHƯA CÓ LIÊN HỆ…], điền xong rồi bấm “Tạo lại” trước khi đăng.",
      "Có thể đăng cùng một video lên ba nền tảng, nhưng dùng đúng nội dung của từng tab vì mỗi nơi có cách đọc khác nhau.",
      "Tránh đăng nhiều video na ná nhau theo một khuôn: cả ba nền tảng đều hạn chế kiếm tiền với nội dung lặp lại hoặc sản xuất hàng loạt, dù có dùng AI hay không. Mỗi video nên có câu chuyện và góc nhìn riêng.",
    ],
  },
  {
    id: "youtube",
    title: "2. YouTube (Shorts)",
    steps: [
      "YouTube Studio → Tạo → Tải video lên. Video dọc dài tối đa 3 phút được xếp vào Shorts; mô tả đã có #Shorts.",
      "Dán “Tiêu đề” và “Mô tả”. Bấm “Hiện thêm” → ô Thẻ, dán “Thẻ (tags)”.",
      "Mục “Đối tượng người xem”: chọn theo người xem chính của video. Nếu video nhắm tới trẻ em thì phải chọn “Có, nội dung dành cho trẻ em” (YouTube tắt bình luận và quảng cáo cá nhân hóa).",
      "Mục “Nội dung bị thay đổi hoặc nội dung tổng hợp”: YouTube yêu cầu khai báo khi video có cảnh trông như thật mà người xem có thể nhầm là thật. Hoạt hình người que của kênh rõ ràng không phải cảnh thật nên thường không bắt buộc; mô tả đã ghi rõ có hỗ trợ AI. Khai báo không làm giảm lượt xem hay khả năng kiếm tiền.",
      "Kiếm tiền (Chương trình Đối tác YouTube): YouTube không cấm video làm với AI, nhưng không trả tiền cho nội dung “không chân thực” (lặp lại, theo khuôn, sản xuất hàng loạt). Xem điều kiện và ngưỡng tham gia trong YouTube Studio → Kiếm tiền.",
    ],
    links: [
      {
        label: "Chính sách kiếm tiền trên YouTube",
        href: "https://support.google.com/youtube/answer/1311392",
      },
      {
        label: "Khai báo nội dung bị thay đổi hoặc tổng hợp",
        href: "https://support.google.com/youtube/answer/14328491",
      },
    ],
  },
  {
    id: "facebook",
    title: "3. Facebook (Reels)",
    steps: [
      "Trên Trang của kênh hoặc Meta Business Suite → Tạo thước phim (Reel) → tải MP4.",
      "Dán “Tiêu đề” (nếu có ô) và “Mô tả”. Mô tả đã có hashtag và phần bản quyền.",
      "Nhãn AI: Meta có thể tự gắn “Thông tin về AI” cho nội dung AI trông như thật. Với hoạt hình của kênh, nếu Meta hỏi thì khai báo đúng; nhãn này không tự làm mất quyền kiếm tiền.",
      "Kiếm tiền: Meta xét tính nguyên gốc của nội dung, hạn chế nội dung đăng lại hoặc lặp lại. Điều kiện và lời mời khác theo khu vực: xem trong Meta Business Suite → Kiếm tiền.",
    ],
  },
  {
    id: "tiktok",
    title: "4. TikTok",
    steps: [
      "Ứng dụng TikTok hoặc TikTok Studio trên web → Tải lên → chọn MP4.",
      "Dán “Chú thích” (đã gồm hashtag và dòng bản quyền ngắn).",
      "Bật “Nội dung do AI tạo” trong phần cài đặt khi đăng: video có giọng đọc và hình làm bằng AI. TikTok bắt buộc nhãn này với nội dung AI trông như thật và cho biết nhãn không làm giảm phân phối khi nội dung hợp lệ.",
      "Kiếm tiền (Creator Rewards Program): chỉ mở ở một số quốc gia và có điều kiện về số người theo dõi, lượt xem và độ dài video. Kiểm tra trong TikTok Studio → Kiếm tiền trước khi nhắm tới.",
    ],
    links: [
      {
        label: "TikTok: nội dung do AI tạo",
        href: "https://support.tiktok.com/en/using-tiktok/creating-videos/ai-generated-content",
      },
    ],
  },
  {
    id: "copyright",
    title: "5. Bản quyền và AI",
    steps: [
      "Mô tả mọi video đã ghi: video gốc của kênh, làm với hỗ trợ AI và có người duyệt; nguồn tham khảo; liên hệ khi có khiếu nại bản quyền.",
      "Nhân vật, hình động và giọng đọc của studio là tài sản của kênh. Không chèn thêm nhạc, hình hay đoạn phim của người khác khi chưa có quyền.",
      "Câu “fair use” trong mô tả không tạo ra quyền sử dụng. Fair use là nguyên tắc của luật Mỹ, do tòa xét theo từng trường hợp, và không tự áp dụng ở Việt Nam. Vì vậy mô tả ghi rõ nội dung gốc thay vì câu fair use.",
      "Khi nhận khiếu nại: đọc kỹ, kiểm tra phần bị nêu, rồi gỡ hoặc phản hồi qua công cụ của nền tảng. Giữ email liên hệ luôn hoạt động.",
    ],
  },
  {
    id: "youtube-connect",
    title: "6. Kết nối YouTube để đăng bằng một nút",
    steps: [
      "Làm một lần, khoảng 15 phút. Sau đó tab Bản cuối có nút “Đăng lên YouTube”; vẫn đăng tay được như mục 2.",
      "Vào Google Cloud Console bằng tài khoản Google sở hữu kênh, tạo một dự án mới (ví dụ “AI Content Studio”).",
      "APIs & Services → Library → tìm “YouTube Data API v3” → Enable.",
      "APIs & Services → OAuth consent screen (Google Auth Platform): User type “External”, điền tên ứng dụng và email. Ở mục Audience thêm chính email của bạn vào Test users, rồi bấm “Publish app” để chuyển sang “In production”. Nếu để “Testing”, Google chỉ cho dùng 7 ngày rồi phải kết nối lại.",
      "APIs & Services → Credentials → Create credentials → OAuth client ID → loại “Desktop app”. Sao chép Client ID và Client secret.",
      "Mở file .env của Studio, điền YOUTUBE_CLIENT_ID và YOUTUBE_CLIENT_SECRET. Tạo khóa STUDIO_TOKEN_KEY bằng lệnh ghi trong .env.example rồi dán vào. Không chia sẻ file .env.",
      "Khởi động lại API và worker. Vào Bộ nhận diện kênh → “Kết nối YouTube”, đăng nhập Google ở tab mới và chọn đúng kênh. Google báo “ứng dụng chưa được xác minh” vì đây là dự án của chính bạn: bấm Nâng cao → Tiếp tục.",
      "Muốn đặt ảnh bìa tùy chỉnh, kênh cần xác minh bằng số điện thoại trong YouTube Studio. Chưa xác minh thì video vẫn đăng, chỉ ảnh bìa báo chưa đặt được.",
      "Mỗi lần đăng có hộp xác nhận: kiểm tên kênh, chế độ hiển thị (mặc định Riêng tư) và bắt buộc chọn “Dành cho trẻ em”. Hạn mức của YouTube là 100 video mỗi ngày cho mỗi dự án.",
    ],
    links: [
      { label: "Google Cloud Console", href: "https://console.cloud.google.com/" },
      {
        label: "Tài liệu YouTube Data API: tải video lên",
        href: "https://developers.google.com/youtube/v3/docs/videos/insert",
      },
    ],
  },
];

export const GUIDE_DISCLAIMER =
  "Chính sách của YouTube, Facebook và TikTok thay đổi thường xuyên. Đây không phải tư vấn pháp lý; trước khi bật kiếm tiền, hãy đọc trang trợ giúp chính thức của từng nền tảng.";
