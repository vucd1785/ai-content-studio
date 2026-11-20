/**
 * Seed 13 brief (tên lửa tái sử dụng, NVIDIA, Anthropic/Claude, điện năng AI) rồi bắt đầu run khổ dọc 9:16, `creative`.
 * Chạy: node --env-file=../../.env --import tsx scripts/seed-topics-2026-11-19.ts   (cwd: packages/db)
 * Dự án trùng tiêu đề thì không tạo lại; dự án đã có run thì không bắt đầu run mới.
 */
import { DEFAULT_FORMAT } from "../../contracts/src/formats/packs.ts";
import { createDbConnection } from "../src/db.ts";
import { createProject, getLatestWorkflowRun, insertBrief, listProjects } from "../src/projects.ts";

type Seed = { title: string; goal: string; tone: string; visualStyle: string; notes: string };

const AUDIENCE =
  "Học sinh từ 13 tuổi trở lên, sinh viên và người đi làm tò mò về công nghệ, không cần kiến thức kỹ thuật.";
const DURATION_SEC = 90;
const CHECK_FACTS =
  "- Số liệu phải kiểm lại theo nguồn mới nhất; số nào chưa chắc thì nói khoảng hoặc bỏ, không bịa.";

const SPACE_TONE =
  "Hào hứng, kỳ diệu, kể chuyện như một cuộc phiêu lưu. Giải thích bằng so sánh đời thường, không công thức.";
const SPACE_STYLE =
  "Hoạt hình que. Bãi phóng, bệ hạ cánh giữa biển, bầu trời đêm và vũ trụ. Tên lửa trắng, lửa cam, khói trắng. Màu sáng, tương phản mạnh.";
const AI_TONE =
  "Tò mò, cân bằng, dễ hiểu. Không thần tượng hóa hay bôi xấu ai, không đưa lời khuyên đầu tư. Dùng ví dụ đời thường.";
const AI_STYLE =
  "Hoạt hình que. Chip phát sáng, phòng máy chủ, biểu đồ đơn giản, văn phòng công ty công nghệ. Tông xanh lá và xanh dương, nền tối có điểm sáng.";
const ENERGY_STYLE =
  "Hoạt hình que. Phòng máy chủ dài hun hút, quạt quay, ống nước làm mát, nhà máy điện, bóng đèn và ấm nước để so sánh. Tông xanh dương mát và cam nóng.";

const SEEDS: Seed[] = [
  {
    title: "Vì sao tên lửa của SpaceX bay lên rồi quay về đúng chỗ lại là bước tiến lịch sử?",
    goal: "Giúp người xem hiểu trước đây tầng đẩy tên lửa bị vứt bỏ sau mỗi lần phóng, vì sao cho nó tự bay về và hạ cánh đứng là rất khó, và vì sao việc đó làm giá phóng giảm mạnh, mở ra thời kỳ bay vào vũ trụ thường xuyên hơn.",
    tone: SPACE_TONE,
    visualStyle: SPACE_STYLE,
    notes: [
      '- Mở đầu: "Hãy tưởng tượng mỗi chuyến bay xong, người ta vứt luôn chiếc máy bay."',
      "- Tầng đẩy là phần đắt nhất; trước đây rơi xuống biển hoặc cháy.",
      "- Cái khó: rơi từ rất cao, quay đầu, đốt động cơ lại, hạ cánh đứng như dựng cây bút chì trên tay.",
      "- Mốc: tầng đẩy Falcon 9 lần đầu hạ cánh thành công trên mặt đất vào tháng 12/2015.",
      "- Kết: tái sử dụng làm giá phóng giảm, nhiều vệ tinh và chuyến bay hơn.",
      CHECK_FACTS,
    ].join("\n"),
  },
  {
    title: "Elon Musk đã thay đổi cách con người phóng tên lửa như thế nào?",
    goal: "Giúp người xem hiểu cách SpaceX làm khác ngành vũ trụ truyền thống: tái sử dụng tầng đẩy, tự sản xuất phần lớn linh kiện, thử nghiệm nhanh và chấp nhận thất bại để học, và tác động lên giá phóng và số lần phóng mỗi năm.",
    tone: SPACE_TONE,
    visualStyle: SPACE_STYLE,
    notes: [
      '- Mở đầu: "Trước đây phóng một tên lửa đắt như xây cả một tòa nhà, rồi vứt đi."',
      "- SpaceX thành lập năm 2002; vài lần phóng đầu của Falcon 1 thất bại trước khi thành công năm 2008.",
      "- Ba cách làm khác: tái sử dụng, tự làm linh kiện, thử nhanh sửa nhanh.",
      "- Công bằng: thành quả là của cả đội kỹ sư và NASA hợp tác, không chỉ một người.",
      "- Kết: phóng tên lửa dần trở thành việc thường ngày.",
      CHECK_FACTS,
    ].join("\n"),
  },
  {
    title: "Tên lửa có thể tái sử dụng như máy bay không?",
    goal: "Giúp người xem so sánh tên lửa với máy bay: máy bay bay hàng chục nghìn chuyến, tên lửa thì sao. Hiểu phần nào đã tái sử dụng được (tầng đẩy, nắp mũi), phần nào chưa (tầng trên), vì sao khó (nhiệt, rung, kiểm tra giữa các chuyến), và mục tiêu tên lửa tái sử dụng hoàn toàn như Starship.",
    tone: SPACE_TONE,
    visualStyle: SPACE_STYLE,
    notes: [
      '- Mở đầu: "Máy bay hạ cánh, đổ xăng rồi bay tiếp. Tên lửa làm được vậy chưa?"',
      "- So sánh cạnh nhau: máy bay và tên lửa qua từng bước: cất cánh, hạ cánh, kiểm tra, bay lại.",
      "- Đã làm được: tầng đẩy và nắp mũi được dùng lại nhiều lần.",
      "- Chưa làm được: tầng trên bay quỹ đạo, quay về phải chịu nhiệt rất cao.",
      "- Kết: đang tiến gần, nhưng chưa nhanh và rẻ như máy bay.",
      CHECK_FACTS,
    ].join("\n"),
  },
  {
    title: "Vì sao bắt được tên lửa giữa không trung lại khó đến vậy?",
    goal: "Giúp người xem hiểu việc tháp phóng dùng hai cánh tay khổng lồ kẹp lấy tầng đẩy Super Heavy khi nó hạ xuống: vì sao làm vậy (bỏ chân hạ cánh cho nhẹ, dùng lại nhanh hơn) và vì sao cực khó (tầng đẩy cao như tòa nhà, nặng, rơi nhanh, sai lệch nhỏ cũng hỏng).",
    tone: SPACE_TONE,
    visualStyle: SPACE_STYLE,
    notes: [
      '- Mở đầu: "Thử bắt một cây bút rơi từ trên cao bằng đôi đũa. Giờ thay cây bút bằng một tòa nhà."',
      "- Lần bắt đầu tiên thành công: tháng 10/2024.",
      "- Cái khó: dừng chính xác trong vài mét, gió, tốc độ, động cơ phải bật lại đúng lúc.",
      "- Lợi ích: bỏ chân hạ cánh, đặt lại lên bệ phóng nhanh.",
      "- Kết: như bắt bóng chày, nhưng với vật to như tòa nhà.",
      CHECK_FACTS,
    ].join("\n"),
  },
  {
    title: "Một tên lửa có thể bay lên vũ trụ bao nhiêu lần?",
    goal: "Giúp người xem hiểu kỷ lục tái sử dụng tầng đẩy Falcon 9, cái gì giới hạn số lần bay (mòn động cơ, nhiệt, rung, kiểm tra), và ngành vũ trụ đang nhắm tới bao nhiêu lần.",
    tone: SPACE_TONE,
    visualStyle: SPACE_STYLE,
    notes: [
      '- Mở đầu: "Một chiếc xe chạy được hàng trăm nghìn km. Còn một tên lửa thì bay được mấy chuyến?"',
      "- Kỷ lục: một tầng đẩy Falcon 9 đã bay hơn 20 lần; nói con số mới nhất nếu kiểm được.",
      "- Sau mỗi chuyến: kiểm tra, thay phần mòn, sơn lại, bay tiếp.",
      "- Giới hạn: động cơ mòn, nhiệt khi quay về, kim loại mỏi dần.",
      "- Kết: số lần còn tăng, mỗi chuyến lại rẻ hơn.",
      CHECK_FACTS,
    ].join("\n"),
  },
  {
    title: "NVIDIA có thể tiếp tục thống trị AI khi không còn Jensen Huang?",
    goal: "Giúp người xem suy nghĩ cân bằng về câu hỏi giả định: NVIDIA mạnh nhờ những gì ngoài người sáng lập (chip GPU, phần mềm CUDA, cộng đồng lập trình viên, đối tác), rủi ro khi một công ty phụ thuộc nhiều vào lãnh đạo, và các đối thủ đang đuổi theo. Kết luận mở, không dự đoán chắc chắn.",
    tone: AI_TONE,
    visualStyle: AI_STYLE,
    notes: [
      '- Mở đầu: "Nếu một ngày người dẫn dắt NVIDIA hơn 30 năm rời đi, chuyện gì xảy ra?"',
      "- Nói rõ đây là câu hỏi giả định; không nói Jensen Huang sắp rời đi.",
      "- Lợi thế khó sao chép: CUDA và hệ sinh thái phần mềm, không chỉ là con chip.",
      "- Rủi ro: văn hóa phụ thuộc người sáng lập, đối thủ tự làm chip.",
      "- Ví dụ công ty sống tốt sau khi người sáng lập rời đi, nói chung chung.",
      "- Không đưa lời khuyên đầu tư.",
      CHECK_FACTS,
    ].join("\n"),
  },
  {
    title: "Jensen Huang đã xây dựng NVIDIA thành gã khổng lồ như thế nào?",
    goal: "Giúp người xem hiểu hành trình của NVIDIA: khởi đầu từ chip đồ họa cho trò chơi, đặt cược vào CUDA để GPU làm tính toán chung, rồi GPU trở thành động cơ của AI. Thấy được vai trò của tầm nhìn dài hạn và những lần suýt thất bại.",
    tone: AI_TONE,
    visualStyle: AI_STYLE,
    notes: [
      '- Mở đầu: "Một công ty bắt đầu từ cuộc trò chuyện ở quán ăn, nay là một trong những công ty giá trị nhất thế giới."',
      "- NVIDIA thành lập năm 1993; ban đầu làm chip đồ họa cho trò chơi.",
      "- Bước ngoặt: CUDA (2006) cho phép GPU tính toán việc khác ngoài đồ họa.",
      "- AI cần làm rất nhiều phép tính song song, đúng việc GPU giỏi.",
      "- Kết: đặt cược sớm, kiên trì nhiều năm trước khi thành công.",
      CHECK_FACTS,
    ].join("\n"),
  },
  {
    title: "Công ty tạo ra Claude AI có giá trị lớn đến mức nào?",
    goal: "Giúp người xem hiểu Anthropic là ai, được định giá bao nhiêu qua các vòng gọi vốn gần đây, định giá nghĩa là gì (kỳ vọng tương lai, không phải tiền mặt trong két), và vì sao nhà đầu tư trả giá cao cho công ty AI.",
    tone: AI_TONE,
    visualStyle: AI_STYLE,
    notes: [
      '- Mở đầu: "Một công ty mới vài năm tuổi được định giá hơn nhiều tập đoàn trăm năm. Vì sao?"',
      "- Anthropic thành lập năm 2021, làm ra trợ lý AI Claude.",
      "- Định giá: dùng con số từ vòng gọi vốn mới nhất đã công bố, ghi rõ thời điểm.",
      "- Giải thích định giá bằng ví dụ: chia bánh, mỗi miếng giá bao nhiêu.",
      "- Không đưa lời khuyên đầu tư.",
      CHECK_FACTS,
    ].join("\n"),
  },
  {
    title: "Vì sao một công ty AI có thể huy động hơn 81 tỷ USD?",
    goal: "Giúp người xem hiểu vì sao làm AI tốn rất nhiều tiền (chip, trung tâm dữ liệu, điện, kỹ sư), ai bỏ tiền vào (quỹ đầu tư, hãng công nghệ lớn, nhà cung cấp đám mây) và họ kỳ vọng nhận lại gì, cùng rủi ro nếu kỳ vọng không thành.",
    tone: AI_TONE,
    visualStyle: AI_STYLE,
    notes: [
      '- Mở đầu: "81 tỷ USD: đủ xây nhiều cây cầu lớn. Vì sao lại đổ vào một công ty AI?"',
      "- Con số 81 tỷ USD theo đề bài là tổng vốn huy động; kiểm lại nguồn và nói rõ là của công ty nào, đến thời điểm nào.",
      "- Tiền đi đâu: mua chip, thuê trung tâm dữ liệu, trả điện, trả lương.",
      "- Ai bỏ tiền và vì sao: cược vào thị trường AI rất lớn.",
      "- Rủi ro: chi nhiều trước, chưa chắc thu lại.",
      "- Không đưa lời khuyên đầu tư.",
      CHECK_FACTS,
    ].join("\n"),
  },
  {
    title: "Claude và ChatGPT đang cạnh tranh với nhau ra sao?",
    goal: "Giúp người xem hiểu cuộc cạnh tranh giữa Anthropic (Claude) và OpenAI (ChatGPT) một cách công bằng: hai công ty đến từ đâu, mỗi bên mạnh ở đâu (người dùng phổ thông, doanh nghiệp, lập trình), cạnh tranh về model, giá và an toàn, và người dùng được lợi gì.",
    tone: AI_TONE,
    visualStyle: AI_STYLE,
    notes: [
      '- Mở đầu: "Hai trợ lý AI, hai công ty, một cuộc đua."',
      "- Bối cảnh: ChatGPT ra mắt cuối 2022; Anthropic do một nhóm từng làm ở OpenAI lập năm 2021.",
      "- So sánh trung lập, không kết luận bên nào thắng.",
      "- Người dùng được lợi: model tốt hơn, giá rẻ hơn, nhiều lựa chọn.",
      CHECK_FACTS,
    ].join("\n"),
  },
  {
    title: "Vì sao AI tiêu thụ nhiều điện?",
    goal: "Giúp người xem hiểu AI dùng điện ở hai giai đoạn (huấn luyện và trả lời), vì sao chip AI ngốn điện và tỏa nhiệt, trung tâm dữ liệu cần thêm điện để làm mát, và các hướng giảm (chip hiệu quả hơn, năng lượng sạch).",
    tone: "Tò mò, cân bằng, không gây hoang mang. So sánh với đồ điện trong nhà để dễ hình dung.",
    visualStyle: ENERGY_STYLE,
    notes: [
      '- Mở đầu: "Mỗi câu bạn hỏi AI, ở đâu đó có hàng nghìn con chip đang nóng lên."',
      "- Huấn luyện: chạy hàng nghìn chip trong nhiều tuần.",
      "- Trả lời: mỗi câu ít điện, nhưng nhân với hàng trăm triệu người dùng.",
      "- Làm mát cũng tốn điện.",
      "- Kết: ngành đang tìm cách tiết kiệm.",
      CHECK_FACTS,
    ].join("\n"),
  },
  {
    title: "Một câu hỏi ChatGPT tốn bao nhiêu điện?",
    goal: "Giúp người xem có cảm nhận đúng về điện năng của một câu hỏi AI: con số ước tính (vài phần mười đến vài watt-giờ tùy nguồn và thời điểm), so sánh với bóng đèn, sạc điện thoại, tìm kiếm web, và vì sao tổng cộng vẫn lớn khi nhân với số người dùng.",
    tone: "Tò mò, cân bằng, không gây hoang mang. So sánh với đồ điện trong nhà để dễ hình dung.",
    visualStyle: ENERGY_STYLE,
    notes: [
      '- Mở đầu: "Hỏi ChatGPT một câu tốn điện bằng bật bóng đèn bao lâu?"',
      "- Các ước tính khác nhau theo nguồn và năm; nói rõ đây là ước tính, nêu nguồn.",
      "- So sánh với: bóng đèn LED vài phút, một lần sạc điện thoại.",
      "- Câu hỏi dài, tạo ảnh, tạo video tốn hơn nhiều.",
      "- Kết: một câu rất ít, nhưng hàng tỷ câu mỗi ngày thì lớn.",
      CHECK_FACTS,
    ].join("\n"),
  },
  {
    title: "Trung tâm dữ liệu làm mát như thế nào?",
    goal: "Giúp người xem hiểu vì sao máy chủ nóng, và các cách làm mát trung tâm dữ liệu: quạt và điều hòa với lối nóng, lối lạnh; tháp giải nhiệt dùng nước bay hơi; làm mát bằng chất lỏng sát chip; ngâm máy chủ trong chất lỏng; đặt trung tâm ở nơi lạnh. Biết thêm chuyện tốn nước.",
    tone: "Tò mò, dễ hiểu, như tham quan hậu trường. So sánh với quạt máy tính, tủ lạnh, mồ hôi.",
    visualStyle: ENERGY_STYLE,
    notes: [
      '- Mở đầu: "Một phòng đầy máy chủ có thể nóng như cái lò. Làm sao giữ chúng mát?"',
      "- Lối nóng, lối lạnh: hút gió mát vào trước, đẩy gió nóng ra sau.",
      "- Bay hơi nước giống mồ hôi làm mát cơ thể, nên tốn nước.",
      "- Chất lỏng chạy sát chip, hoặc ngâm cả máy chủ.",
      "- Kết: làm mát tốt hơn thì tốn ít điện và nước hơn.",
      CHECK_FACTS,
    ].join("\n"),
  },
];

const apiBase = process.env.STUDIO_API_URL ?? "http://localhost:3001";
const { db, close } = createDbConnection(process.env.DATABASE_URL ?? "");

try {
  const existing = new Map((await listProjects(db)).map((p) => [p.title, p.id]));
  const projectIds: { id: string; title: string }[] = [];
  for (const seed of SEEDS) {
    let id = existing.get(seed.title);
    if (id === undefined) {
      const project = await createProject(db, seed.title);
      id = project.id;
      await insertBrief(db, id, {
        topic: seed.title,
        audience: AUDIENCE,
        goal: seed.goal,
        durationSec: DURATION_SEC,
        language: "vi",
        tone: seed.tone,
        visualStyle: seed.visualStyle,
        notes: seed.notes,
        formatId: DEFAULT_FORMAT.id,
        formatVersion: DEFAULT_FORMAT.version,
      });
      console.log(`seed  ${id}  ${seed.title}`);
    } else {
      console.log(`có sẵn ${id}  ${seed.title}`);
    }
    projectIds.push({ id, title: seed.title });
  }

  const login = await fetch(`${apiBase}/api/session/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: process.env.STUDIO_PASSWORD ?? "" }),
  });
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  if (!login.ok || cookie === undefined) {
    throw new Error(`Đăng nhập API lỗi ${login.status}`);
  }

  for (const { id, title } of projectIds) {
    if ((await getLatestWorkflowRun(db, id)) !== null) {
      console.log(`đã có run, bỏ qua  ${title}`);
      continue;
    }
    const res = await fetch(`${apiBase}/api/projects/${id}/workflow-runs`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ aspectRatio: "9:16", creativeMode: "creative", llmModel: "claude-code" }),
    });
    const body = (await res.json()) as { workflowRun?: { id: string; status: string } };
    console.log(`run ${res.status}  ${body.workflowRun?.id ?? "-"}  ${body.workflowRun?.status ?? JSON.stringify(body)}  ${title}`);
  }
} finally {
  await close();
}
