# P2-02 — Kế hoạch session (chưa code)

Ngày: 2026-10-30. Vai trò: rà kiến trúc và bảo mật trước khi Composer triển khai.

Nguồn đã đọc: `docs/11-TASKS.md` (khối P2-02), `docs/12-MODEL-HANDOFF.md`, `docs/03-DATABASE-DESIGN.md`, `docs/04-AGENT-ORCHESTRATION.md`, `docs/07-API-CONTRACTS.md`, `docs/08-SECURITY.md`, `docs/09-TEST-STRATEGY.md`, `docs/10-IMPLEMENTATION-PLAN.md`, `docs/02-SYSTEM-ARCHITECTURE.md`, `docs/01-PRD.md`, ADR-001, ADR-003, ADR-010, `reports/P2-phase-planning.md`, `reports/P2-01.md`, `packages/db/src/schema/index.ts`, `packages/config/src/env.ts`, `apps/api/package.json`, `.env.example`, `docker-compose.yml`.

**Không triển khai trong phiên này.** P2-02 vẫn `pending`. Không sửa schema, volume Postgres, `data/`, TTS, Whisper, Gemini, Remotion.

Composer chỉ bắt đầu sau khi Director chấp nhận báo cáo này (kể cả TTL, định dạng cookie, và danh sách file mở rộng ở mục E).

## A. Requirements and source references

### Task

`docs/11-TASKS.md` — **P2-02 — Session**

| Mục | Giá trị |
|---|---|
| Trạng thái | `pending` |
| Phụ thuộc | `P2-01` (`done`, Director verify 2026-10-30) |
| Skill | `implement-task` |
| File task ghi | `apps/api/src/**`, test, `reports/P2-02.md`, khối task trong `docs/11-TASKS.md` |
| Mục tiêu | Login, logout, cookie HMAC, `401` khi chưa đăng nhập |
| Nghiệm thu | Test sai mật khẩu không nhận cookie; response và log không echo mật khẩu |
| Kiểm tra | Vitest với Fastify `inject` |

Task không gắn ADR riêng. Ràng buộc lấy từ hợp đồng và bảo mật đã duyệt.

### Hợp đồng đã chốt (không được đổi trong lúc code)

`docs/07-API-CONTRACTS.md` mục Session:

- Một Director. Không thư viện auth riêng ở MVP.
- Cookie tên `studio_session`: `HttpOnly`, `SameSite=Lax`, ký HMAC bằng `STUDIO_SESSION_SECRET`.
- `POST /api/session/login` — body `{ password }`. SHA-256 mật khẩu gửi lên và SHA-256 của `STUDIO_PASSWORD`, rồi `timingSafeEqual`.
- `POST /api/session/logout` — xóa cookie.
- `GET /api/session` — `{ authenticated: boolean }`.
- Mọi route còn lại: `401`, code `unauthorized`, khi thiếu session.
- Lỗi dạng `{ error: { code, message, details } }`. `unauthorized` là 401, `validation_error` là 400.
- API Fastify, prefix `/api`, JSON UTF-8, Zod từ `packages/contracts` qua `@fastify/type-provider-zod` (ADR-010).

`docs/08-SECURITY.md`:

- Secret chỉ từ environment. Không commit `.env`. `.env.example` giữ secret trống.
- Log không chứa API key, cookie, nguyên văn `Authorization`, và không ghi hash mật khẩu.
- API lắng nghe `127.0.0.1`.
- So khớp mật khẩu bằng SHA-256 hai đầu vào rồi `timingSafeEqual`. Không so sánh chuỗi thường.

`docs/02-SYSTEM-ARCHITECTURE.md`: `apps/api` là Fastify 5, làm session/CRUD/approval/SSE, không render. `packages/config` đọc environment một lần ở biên process và dừng nếu thiếu biến bắt buộc của process đó.

`docs/03-DATABASE-DESIGN.md` và schema P2-01: 12 bảng (`projects`, `briefs`, `references`, `workflow_runs`, `agent_runs`, `jobs`, `artifacts`, `artifact_dependencies`, `approvals`, `events`, `usage_records`, `voice_profiles`). Không có bảng user, role, hay session.

`packages/config/src/env.ts` chỉ khai báo tên `STUDIO_PASSWORD` và `STUDIO_SESSION_SECRET`. Comment trong file: đọc giá trị và validate ở task sau. `.env.example` đã có hai tên này, giá trị trống.

`apps/api` hiện chỉ có `package.json` placeholder (`typecheck` trỏ `tsconfig.base.json`). Chưa có `src/`, Fastify, Vitest.

### Điều tài liệu không ghi — phải chốt ở báo cáo này

Nếu Composer tự chọn khác mục B–D, đó là lệch kiến trúc. Các chỗ tài liệu im:

- Thuật toán HMAC, encoding, và nội dung payload cookie.
- `Secure`, `Path`, `Max-Age`, thời hạn session.
- Mã HTTP và body khi sai mật khẩu, khi login đúng, khi logout, khi cookie hỏng.
- `GET /api/session` có nằm trong nhóm “route còn lại” hay không.
- Thu hồi session phía server.
- CSRF token, rate limit, khóa tài khoản.

Khuyến nghị bên dưới bám đúng câu đã viết trong hợp đồng. Phần chưa viết được điền ở mức nhỏ nhất để cookie HMAC hoạt động trên HTTP loopback, và được đánh dấu là quyết định của bản kế hoạch này.

## B. Proposed session architecture

### Mô hình

Một mật khẩu local, một Director, cookie stateless ký HMAC. Postgres không tham gia đăng nhập. Redis không giữ session.

Lý do bám ADR hiện hành:

- ADR-003: Postgres là trạng thái cần khôi phục của project/workflow; Redis là queue. Session trình duyệt không nằm trong danh sách đó.
- Schema P2-01 không có bảng session. Thêm bảng là đổi `docs/03-DATABASE-DESIGN.md` và mở `packages/db/**`, ngoài file P2-02.
- Hợp đồng nói logout là xóa cookie, không nói xóa hàng DB.
- “Không dùng thư viện auth riêng” loại passport, Lucia, NextAuth, và thư viện JWT. Ký bằng `node:crypto` (`createHmac`, `createHash`, `timingSafeEqual`). Không thêm `@fastify/cookie`, `@fastify/jwt`, `@fastify/cors`.

`STUDIO_PASSWORD` là mật khẩu gốc trong environment, không phải hash lưu sẵn. `STUDIO_SESSION_SECRET` là khóa HMAC, tách khỏi mật khẩu.

### Định dạng cookie (đề xuất để duyệt)

Không phải JWT: không header `alg`, không chuỗi ba đoạn, không thuật toán `none`.

Giá trị cookie:

```text
base64url(utf8(json)).base64url(hmacSha256(STUDIO_SESSION_SECRET, phần_trước_dấu_chấm))
```

- Đúng một dấu `.`. Base64url không padding (RFC 4648).
- JSON đúng hai khóa, không thêm khóa: `{"v":1,"exp":<unix giây>}`.
- `exp` là thời điểm hết hạn tuyệt đối, tính lúc login: `now + 604800` (7 ngày).
- HMAC-SHA256, khóa là UTF-8 của `STUDIO_SESSION_SECRET` (không băm khóa thêm một lần).
- Verify: tách đúng 2 phần; MAC so bằng `timingSafeEqual` trên buffer cùng độ dài; nếu độ dài MAC lệch thì so với buffer 32 byte toàn 0 rồi trả fail (không để `timingSafeEqual` ném exception thành HTTP 500); sau đó mới parse JSON; `v === 1`; `exp` là số; `now < exp`.
- Cookie hết hạn hoặc sai chữ ký bị coi là không có session.

Thuộc tính khi đặt cookie thành công:

```text
studio_session=<giá trị>; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800
```

Không `Domain` (host-only). Không `Secure`: API là HTTP trên `127.0.0.1` (`docs/08-SECURITY.md`). `Secure` trên HTTP làm trình duyệt bỏ cookie dù login đúng.

Logout xóa cookie, cùng tên và `Path=/`:

```text
studio_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0
```

Đổi `STUDIO_SESSION_SECRET` làm mọi cookie cũ mất hiệu lực. Chưa có `kid` hay hai khóa song song.

### Biên process

Hàm ký, kiểm tra, và so mật khẩu là hàm thuần: nhận secret/password qua đối số, không đọc `process.env`.

`packages/config` thêm hàm đọc một lần, chỉ gọi từ entry `apps/api`:

- Thiếu `STUDIO_PASSWORD`, hoặc chuỗi rỗng sau khi lấy từ env: không listen, thoát mã khác 0.
- Thiếu `STUDIO_SESSION_SECRET`, hoặc ngắn hơn 32 ký tự UTF-8: không listen, thoát mã khác 0.
- Không trim mật khẩu.
- Không yêu cầu `DATABASE_URL`, `REDIS_URL`, `GEMINI_API_KEY` để boot API session. Worker và CLI không gọi hàm này.

Nghe `127.0.0.1` và một cổng cấu hình trong code (đề xuất `3001` nếu chưa có cổng API trong tài liệu). `trustProxy` tắt. P2-02 không thêm service `api` vào `docker-compose.yml` (comment Compose nói service app thêm ở task sau; task này kiểm tra bằng `inject`).

### Schema Zod (ADR-010)

Request/response công khai nằm trong `packages/contracts`, import `zod/v4`:

- Login body: `{ password: string }` độ dài 1–1024. Trần 1024 là giới hạn từ chối body lớn, không phải luật sản phẩm mới.
- Response session: `{ authenticated: boolean }`.
- Error envelope đúng mục Lỗi của `docs/07-API-CONTRACTS.md`.

`details` và `message` không được nhúng giá trị `password`, hash, hay cookie. Zod issue mặc định có thể echo input — mapper lỗi phải bỏ `received` / input thô và trả `details: {}` hoặc `{ field: "password" }`.

### Hook 401

Một `onRequest` cho mọi route `/api/*`, trừ đúng ba path:

| Method | Path | Khi không có session hợp lệ |
|---|---|---|
| `POST` | `/api/session/login` | Vẫn xử lý login |
| `POST` | `/api/session/logout` | Vẫn xóa cookie |
| `GET` | `/api/session` | `200` và `{ authenticated: false }` |

Route khác thiếu cookie hợp lệ: `401` và

```json
{ "error": { "code": "unauthorized", "message": "Chưa đăng nhập.", "details": {} } }
```

Cookie sai chữ ký trên route được bảo vệ cùng mã đó, không `500`.

P2-02 chưa có route project. Test đăng ký `GET /api/session-probe` chỉ khi `buildApp({ probe: true })`. Bản listen production không đăng ký probe. Hook mặc định để P2-03 thêm route là đã bị chặn.

### HTTP login / logout

| Tình huống | HTTP | Body | Cookie |
|---|---|---|---|
| Login đúng | 200 | `{ authenticated: true }` | Set `studio_session` như mục trên |
| Login sai mật khẩu | 401 | `unauthorized`, message `Mật khẩu không đúng.` | Không `Set-Cookie` session mới. Cookie cũ giữ nguyên |
| Body không phải `{ password: string }` hoặc rỗng / dài hơn 1024 | 400 | `validation_error` | Không set cookie |
| Logout, có hoặc không cookie | 200 | `{ authenticated: false }` | `Max-Age=0` |
| `GET /api/session` cookie hợp lệ, chưa hết hạn | 200 | `{ authenticated: true }` | Không đổi |
| `GET /api/session` thiếu, sai, hoặc hết hạn | 200 | `{ authenticated: false }` | Không đổi |

Login đúng luôn ghi cookie mới do server ký. Không nâng cấp cookie client gửi sẵn thành session.

So mật khẩu:

```text
timingSafeEqual(SHA-256(utf8(submitted)), SHA-256(utf8(STUDIO_PASSWORD)))
```

Luôn băm cả hai phía. Digest là 32 byte nhị phân, không hex trong log. Không `===` trên chuỗi mật khẩu.

## C. Authentication lifecycle

1. **Boot.** Entry API gọi config. Secret hoặc mật khẩu không đạt ngưỡng thì process dừng trước `listen`. Không tạo hàng DB.
2. **Chưa đăng nhập.** `GET /api/session` trả `authenticated: false`. Route probe hoặc route tương lai trả 401.
3. **Login.** Đọc body JSON. Sai schema thì 400. Đúng schema thì so hash. Sai thì 401, không cookie mới, không ghi mật khẩu/hash. Đúng thì ký payload `v` + `exp`, `Set-Cookie`, body `authenticated: true`.
4. **Request sau đó.** Hook đọc header `Cookie`, lấy đúng tên `studio_session`, verify HMAC rồi `exp`. Hợp lệ thì đi tiếp. Không hợp lệ thì 401 trên route được bảo vệ, hoặc `authenticated: false` trên `GET /api/session`.
5. **Hết hạn.** Sau `exp`, cookie còn trên trình duyệt vẫn bị từ chối. Client thấy `authenticated: false` và phải login lại.
6. **Logout.** Xóa cookie ở browser. Bản copy cookie đã bị đánh cắp vẫn hợp lệ đến `exp` vì không có denylist. Đây là giới hạn đã chấp nhận nếu Director duyệt mục D.
7. **Đổi secret hoặc mật khẩu ở env.** Restart process. Secret mới làm cookie cũ fail. Mật khẩu mới chỉ ảnh hưởng lần login sau; cookie đã ký vẫn dùng đến `exp`.

Không có bước tạo user, gán role, refresh token, hay ghi `approvals`.

## D. Security considerations and decisions needed

### Đã có trong tài liệu — làm đúng, không “cải tiến”

| Kiểm soát | Cách làm ở P2-02 |
|---|---|
| Một Director, một mật khẩu | Không bảng user, không role |
| HMAC + `STUDIO_SESSION_SECRET` | `node:crypto` HMAC-SHA256 |
| `HttpOnly`, `SameSite=Lax` | Đúng thuộc tính đó |
| SHA-256 hai đầu vào + `timingSafeEqual` | Hàm so mật khẩu đúng câu trong `docs/08-SECURITY.md` |
| Không echo mật khẩu / hash / cookie trong log | Redact `req.body.password`, `req.headers.cookie`, `res.headers["set-cookie"]`; test bắt chuỗi mật khẩu |
| Bind loopback | `listen` chỉ `127.0.0.1` |
| Lỗi `unauthorized` | Đúng envelope mục Lỗi |

SHA-256 không phải bộ nhớ mật khẩu chậm (scrypt/argon2). Hợp đồng đã chọn SHA-256 để hai digest cùng độ dài trước `timingSafeEqual`. Không đổi sang bcrypt trong task này. Muốn đổi thuật toán là ADR mới.

### Rủi ro và cách xử lý trong MVP

| Rủi ro | Trong P2-02 | Để sau |
|---|---|---|
| CSRF | `SameSite=Lax` là kiểm soát đã ghi. Cross-site POST không gửi cookie. Login CSRF không có ý nghĩa nếu kẻ tấn công chưa biết mật khẩu. Không thêm CSRF token | Token CSRF, `SameSite=Strict` |
| Session fixation | Login không chấp nhận session id từ client; chỉ phát hành giá trị server ký. Cookie giả không trở thành hợp lệ sau khi nạn nhân đăng nhập | Kho session server |
| Replay | Cookie là bearer đến `exp`. Chấp nhận vì bind `127.0.0.1` và HttpOnly | Denylist, rotation bắt buộc mỗi request |
| Timing | So mật khẩu và so MAC bằng `timingSafeEqual`. Verify MAC trước khi xét `exp`. Sai độ dài MAC không thành 500 | Padding thời gian nhân tạo (không có trong tài liệu) |
| Brute force mật khẩu | Chấp nhận trên loopback, một người dùng | Rate limit, khóa tài khoản |
| Thu hồi tức thì | Logout chỉ xóa cookie trình duyệt. Cookie đã copy còn dùng đến `exp` | Bảng session hoặc denylist Redis — cần sửa schema/ADR, không làm trong P2-02 |
| XSS đọc cookie | `HttpOnly` | CSP ở task web |
| Cookie trên HTTP | Không `Secure`, vì `Secure` phá login local | `Secure` khi có TLS và ADR |

### CSRF và origin lúc P2-05

P2-02 không bật CORS. `SameSite=Lax` chỉ gửi cookie cho request same-site. `http://127.0.0.1` và `http://localhost` là hai site khác nhau. P2-05 phải gọi API cùng origin (proxy Vite tới API), nếu không trình duyệt sẽ không gửi `studio_session`. Ghi vào report P2-02 như ràng buộc cho task sau, không triển khai proxy ở task này.

### Quyết định Director chốt bằng cách duyệt báo cáo

1. **TTL 7 ngày (604800 giây)** trong `exp` và `Max-Age`. Đổi số này trước khi Composer code nếu muốn cửa sổ khác. Không có TTL thì cookie bị đánh cắp không bao giờ hết hạn, vì logout không xóa được bản copy.
2. **Định dạng cookie mục B** (HMAC-SHA256, payload `{v, exp}`, không JWT).
3. **Không thu hồi server-side ở P2-02.** Nếu Director muốn logout vô hiệu hóa cookie đã copy ngay lập tức, dừng: cần bảng hoặc Redis denylist, sửa database design, và ADR. Không nhét bảng đó vào P2-02.
4. **Mở file ngoài câu chữ task**, vì nếu không thì Composer phải viết Zod trong `apps/api` (lệch ADR-010) hoặc không thêm được Fastify vào package rỗng. Danh sách ở mục E.
5. **Sai mật khẩu là 401 `unauthorized`**, không set cookie. Đúng mật khẩu là 200 `{ authenticated: true }`. `GET /api/session` không bao giờ 401; nó trả boolean.
6. **Ngưỡng boot:** mật khẩu tối thiểu 1 ký tự; session secret tối thiểu 32 ký tự. Dưới ngưỡng thì không listen.

Không còn câu hỏi mở nào khác để Composer tự điền. Mục I chỉ còn các hướng cố ý không làm, và điều kiện dừng nếu Director từ chối các mục 1–4.

## E. Exact implementation scope

### Làm

- Fastify 5.5+ và `@fastify/type-provider-zod` tương thích Zod 4.2 đã có trong workspace. Vitest 3 theo `apps/worker`.
- App factory nhận config `{ password, sessionSecret, now }` để test không đọc `.env` thật.
- Ba route session, hook 401, ký/verify cookie, so mật khẩu.
- Probe chỉ trong test.
- Logger redact các field mục D.
- Listen `127.0.0.1` ở entry; test dùng `inject`, không cần cổng mở.
- Schema Zod session và error envelope trong `packages/contracts`.
- Hàm load env session trong `packages/config`, gọi từ entry API.
- `reports/P2-02.md` và chuyển P2-02 sang `done` chỉ khi tiêu chí có bằng chứng. Đó là việc của phiên Composer, không phải phiên này.

### File được sửa sau khi duyệt (mở rộng có chủ đích)

Task gốc chỉ ghi `apps/api/src/**`. Các đường dẫn sau là phần tối thiểu để khớp ADR-010 và package còn trống:

- `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/vitest.config.ts`, `apps/api/src/**`
- `packages/contracts/src/api/session.ts`, `packages/contracts/src/api/error.ts`, export thêm trong `packages/contracts/src/index.ts`, test schema nếu thêm
- `packages/config/src/session-env.ts`, export trong `packages/config/package.json`
- `pnpm-lock.yaml` chỉ qua `pnpm install`
- `reports/P2-02.md`, trạng thái P2-02 trong `docs/11-TASKS.md`

### Không làm

- Sửa `docs/decisions/`, `docs/03-DATABASE-DESIGN.md`, `packages/db/**`, migration.
- Bảng user, role, session; OAuth; JWT; nhà cung cấp danh tính; `@fastify/cookie` / `@fastify/jwt`.
- Hash mật khẩu kiểu scrypt/argon2/bcrypt.
- CSRF token, rate limit, CORS, service Compose `api`, TLS, cờ `Secure`.
- Route project, brief, approval, SSE (`P2-03`, `P2-04`).
- UI login (`P2-05`).
- Đọc hoặc ghi Postgres/Redis; `docker compose down -v`; xóa `data/tts`, `data/alignment`, `data/pipeline`, volume `postgres_data`.
- Sửa TTS, Whisper, Gemini, Remotion, worker.
- Ghi giá trị thật vào `.env.example`. Không commit `.env`.
- Không `approved` trên approval. Không bắt đầu `P2-03` hay `P3-01`.

## F. Unit and integration test plan

Công cụ: Vitest, Fastify `inject`, môi trường Node. Không Compose, không Gemini, không TTS. Mật khẩu và secret trong test là chuỗi giả, không đọc `.env`.

Logger test: destination thu chuỗi log. Sentinel mật khẩu ví dụ `sentinal-password-9f3a` (và một chuỗi hash hex của nó) không được xuất hiện trong body, header `set-cookie`, và log.

### Đơn vị

| ID | Việc | Kỳ vọng |
|---|---|---|
| U1 | So mật khẩu đúng | `true` |
| U2 | So mật khẩu sai, khác độ dài | `false`; vẫn đi qua hai SHA-256 rồi `timingSafeEqual` |
| U3 | Ký rồi verify với cùng secret và `now` trước `exp` | hợp lệ |
| U4 | Đổi 1 bit payload hoặc MAC | không hợp lệ |
| U5 | Secret khác | không hợp lệ |
| U6 | `now >= exp` | không hợp lệ |
| U7 | Chuỗi một đoạn, ba đoạn (dạng JWT), JSON thêm khóa, `v !== 1` | không hợp lệ |
| U8 | MAC sai độ dài | `false`, không ném exception |
| U9 | `loadSessionEnv` thiếu password, password rỗng, secret dưới 32 ký tự | lỗi, không trả secret rỗng |
| U10 | Schema login từ chối thiếu field, không phải string, chuỗi rỗng, chuỗi 1025 | fail; message/issue xuất ra ngoài không chứa sentinel |

### Tích hợp `inject`

| ID | Việc | Kỳ vọng |
|---|---|---|
| I1 | `POST /api/session/login` sai mật khẩu | 401, `error.code = unauthorized`, không `Set-Cookie` `studio_session` có chữ ký, body và log không chứa sentinel hay hash |
| I2 | Login đúng | 200, `{ authenticated: true }`, `Set-Cookie` có tên `studio_session`, `HttpOnly`, `SameSite=Lax`, không có `Secure`, không chứa mật khẩu |
| I3 | `GET /api/session` không cookie | 200, `{ authenticated: false }` |
| I4 | `GET /api/session` với cookie I2 | 200, `{ authenticated: true }` |
| I5 | `GET /api/session` cookie sửa MAC hoặc hết hạn | 200, `{ authenticated: false }` |
| I6 | Probe không cookie, cookie sai, cookie hết hạn | 401, `unauthorized`, message không chứa sentinel |
| I7 | Probe với cookie I2 | 200 |
| I8 | Logout rồi probe với cookie cũ còn client giữ | Logout 200 và `Max-Age=0`. Probe gửi lại giá trị cũ vẫn 200 đến khi `exp` — ghi rõ giới hạn stateless trong report. Probe sau khi client bỏ cookie thì 401 |
| I9 | Logout không cookie | 200, vẫn `Max-Age=0` |
| I10 | Login body `{}` | 400, `validation_error`, không set cookie, không echo |
| I11 | Production builder (`probe` tắt) | không có `GET /api/session-probe` |
| I12 | Cookie gửi sẵn trước login sai | login sai không ký lại cookie đó; probe với cookie giả vẫn 401 |

Test hết hạn dùng `now` tiêm vào app, không `setTimeout` dài.

`pnpm --filter @studio/api test` và `typecheck` phải chạy qua `scripts/with-node24.ps1`. Không `it.skip` để cho xanh.

## G. Director verification steps with PASS/FAIL criteria

Không cần Postgres, Redis, TTS, render. Không đọc `.env` trong lệnh (tránh in secret thật). Không `docker compose down -v`.

```powershell
Set-Location E:\Docker\ai-content-studio
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\with-node24.ps1 pnpm --filter @studio/api test
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\with-node24.ps1 pnpm --filter @studio/api typecheck
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\with-node24.ps1 pnpm --filter @studio/contracts typecheck
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\with-node24.ps1 pnpm --filter @studio/config typecheck
```

Tên script có thể khác nếu `reports/P2-02.md` ghi rõ — dùng đúng lệnh trong report đó.

| # | PASS | FAIL |
|---|---|---|
| 1 | `@studio/api` test thoát 0; I1 có trong output đã chạy | Test skip, hoặc sai mật khẩu vẫn có `Set-Cookie` session |
| 2 | Log và JSON của case sai mật khẩu không chứa sentinel mật khẩu test, không chứa hash | Mật khẩu hoặc hash xuất hiện trong body hoặc log |
| 3 | Login đúng đặt `studio_session` với `HttpOnly` và `SameSite=Lax` | Thiếu cờ, hoặc dùng JWT thư viện, hoặc set `Secure` làm cookie HTTP không lưu được |
| 4 | Probe không cookie trả 401 và `error.code = unauthorized` | 200, hoặc 500 khi cookie hỏng |
| 5 | `GET /api/session` không cookie trả 200 `{ authenticated: false }` | 401 trên chính route này |
| 6 | Typecheck api, contracts, config thoát 0 trên Node 24 (`E:\NodeVersions`) | Typecheck bằng `D:\nodejs` v22, hoặc lỗi strict |
| 7 | `reports/P2-02.md` có lệnh và kết quả; `docs/11-TASKS.md` P2-02 là `done` | Thiếu bằng chứng hoặc vẫn `pending` dù đã code xong không report |
| 8 | `packages/db` và volume/media không đổi trong diff task | Migration mới, `docker volume rm`, mất `data/tts` hoặc `data/alignment` |
| 9 | Diff không đụng `docs/decisions/`, worker LLM, TTS, Remotion | Sửa ADR hoặc pipeline media |

Kiểm tra tay tùy chọn, chỉ với secret giả trong process, không in `.env`:

```powershell
$env:STUDIO_PASSWORD = "director-local-test"
$env:STUDIO_SESSION_SECRET = "0123456789abcdef0123456789abcdef"
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\with-node24.ps1 pnpm --filter @studio/api exec tsx src/main.ts
```

Ở terminal khác: login sai không có `Set-Cookie` chứa dấu chấm của MAC; login đúng có `HttpOnly`. Tắt process sau khi xem. Không đưa mật khẩu máy Director vào lệnh này.

## H. Ready-to-use Composer 2.5 implementation prompt

Dán khối này chỉ sau khi Director đã duyệt `reports/P2-02-planning.md`.

```text
Làm đúng task P2-02 trong docs/11-TASKS.md.
Đọc AGENTS.md, khối P2-02, docs/07-API-CONTRACTS.md mục Session và mục Lỗi, docs/08-SECURITY.md, docs/02-SYSTEM-ARCHITECTURE.md, ADR-010, docs/12-MODEL-HANDOFF.md, reports/P2-02-planning.md.
Skill: implement-task.
Shell: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/with-node24.ps1 <pnpm...>
Bám reports/P2-02-planning.md mục B, C, E, F. Director đã duyệt các quyết định đó.

Làm: login, logout, GET /api/session, cookie studio_session HMAC-SHA256 bằng node:crypto, HttpOnly, SameSite=Lax, Path=/, không Secure, Max-Age và exp = 604800 giây, payload JSON chỉ {v:1, exp}. So mật khẩu bằng SHA-256 hai đầu vào rồi timingSafeEqual. Sai mật khẩu là 401 unauthorized và không Set-Cookie. GET /api/session thiếu cookie hợp lệ trả 200 { authenticated: false }. Mọi route /api khác thiếu session hợp lệ trả 401 unauthorized. Hook này là mặc định cho route sau.

File được sửa: apps/api/package.json, apps/api/tsconfig.json, apps/api/vitest.config.ts, apps/api/src/**, packages/contracts/src/api/session.ts, packages/contracts/src/api/error.ts, packages/contracts/src/index.ts, test schema contracts nếu cần, packages/config/src/session-env.ts, packages/config/package.json (export), pnpm-lock.yaml qua pnpm install, reports/P2-02.md, trạng thái P2-02 trong docs/11-TASKS.md.

Không sửa docs/decisions/, packages/db/**, docker-compose.yml, .env, .env.example.
Không thêm bảng session, user, OAuth, JWT, @fastify/cookie, @fastify/jwt, CORS, CSRF token, bcrypt/scrypt/argon2.
Không nối Postgres hay Redis. Không xóa Docker volume, data/tts, data/alignment, data/pipeline.
Không gọi TTS, Whisper, Gemini, không render.
Không bắt đầu P2-03 hay P2-05.

Boot: STUDIO_PASSWORD rỗng hoặc thiếu, hoặc STUDIO_SESSION_SECRET ngắn hơn 32 ký tự, thì không listen. Hàm ký và so mật khẩu không đọc process.env. Listen 127.0.0.1. Log redact password, cookie, set-cookie. Response không echo mật khẩu hay hash.

Kiểm tra: Vitest Fastify inject theo bảng U1–U10 và I1–I12 trong reports/P2-02-planning.md. Không skip.
Viết reports/P2-02.md theo docs/12-MODEL-HANDOFF.md.
Đổi P2-02 thành done chỉ khi tiêu chí có bằng chứng. Dừng.
```

## I. Blockers and unresolved questions

P2-02 không bị chặn bởi P2-01. Schema và migration đã `done`. Không cần database cho session.

Chưa code vì phiên này là planning. Các mục sau là điều kiện dừng của phiên Composer, không phải việc phải làm thêm trước khi duyệt:

| Nếu Director muốn | Thì |
|---|---|
| Giữ nguyên file task chỉ `apps/api/src/**`, không mở contracts/config/package.json | Task `blocked`: package API không có Fastify và ADR-010 cấm Zod request nằm ngoài `packages/contracts` |
| Logout làm cookie đã copy chết ngay | Dừng, không thêm bảng trong P2-02. Cần Grok sửa database design và ADR trước |
| TLS và `Secure` ngay | Dừng. Bind hiện tại là HTTP `127.0.0.1`. `Secure` trên HTTP làm mất cookie |
| Đổi SHA-256 mật khẩu sang argon2, hoặc thêm user/role/OAuth | ADR mới, ngoài MVP đã ghi ở `docs/01-PRD.md` và `docs/10-IMPLEMENTATION-PLAN.md` |

Không có quyết định thuật toán còn bỏ trống sau mục D.1–D.6. TTL mặc định trong bản duyệt là 7 ngày. Director đổi con số đó bằng một dòng trả lời trước khi dán prompt mục H; Composer không tự chọn TTL khác.

Việc kế tiếp sau khi P2-02 `done`: `P2-03` (API project) và `P2-05` (vỏ web) cùng phụ thuộc P2-02. `P2-05` phải same-origin với API thì `SameSite=Lax` mới gửi cookie. `P3-01` vẫn chỉ cần P2-01; khuyến nghị giữ một luồng web trước queue, như `docs/12-MODEL-HANDOFF.md`.
