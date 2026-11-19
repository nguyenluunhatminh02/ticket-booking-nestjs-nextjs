# 📋 INTERVIEW Q&A + SCHEMA EXPLANATION GUIDE
## Ticket Booking Platform — NestJS + Next.js + FastAPI ML

> Tài liệu này giúp bạn trả lời phỏng vấn về dự án và hiểu rõ từng field trong schema.
> Cập nhật: 23/03/2026

---

## MỤC LỤC

1. [Câu hỏi phỏng vấn & Trả lời](#1-câu-hỏi-phỏng-vấn--trả-lời)
   - 1.1 Câu hỏi tổng quan kiến trúc
   - 1.2 Câu hỏi về NestJS / Backend
   - 1.3 Câu hỏi về Database & Prisma
   - 1.4 Câu hỏi về Concurrency & Race Condition
   - 1.5 Câu hỏi về Authentication & Security
   - 1.6 Câu hỏi về Payment & Stripe
   - 1.7 Câu hỏi về Real-time / WebSocket
   - 1.8 Câu hỏi về ML Service (Python FastAPI)
   - 1.9 Câu hỏi về Performance & Scaling
   - 1.10 Câu hỏi bẫy / nâng cao
2. [Giải thích Schema — Từng field](#2-giải-thích-schema--từng-field)

---

# 1. CÂU HỎI PHỎNG VẤN & TRẢ LỜI

---

## 1.1 Câu hỏi Tổng quan Kiến trúc

---

### Q: Bạn mô tả kiến trúc tổng thể của hệ thống này không?

**Trả lời:**
Hệ thống gồm 4 lớp chính:

1. **Frontend (Next.js 15, port 3000)**: React với TypeScript. Dùng Zustand cho auth state, TanStack React Query cho data fetching, Socket.IO client cho real-time seat locking, Stripe Elements cho thanh toán, Mapbox GL cho bản đồ venue.

2. **Backend (NestJS, port 3001)**: RESTful API + WebSocket gateway. Chia 3 module chính: `AuthModule` (JWT, MFA, OAuth), `BookingModule` (16 services), `MlModule` (HTTP proxy đến Python + local fallback). Dùng Prisma ORM với PostgreSQL.

3. **Database (PostgreSQL)**: 26 models trong 2 domain (Auth: 10 models, Booking: 16 models). Redis được dùng cho JWT blacklist, refresh token JTI, seat locks tạm thời, và login attempt counters.

4. **ML Service (FastAPI, port 8000)**: Python microservice. Kết nối trực tiếp DB qua SQLAlchemy để đọc data. Train 3 model: `IsolationForest` cho fraud detection, `GradientBoostingRegressor` cho demand forecast + pricing. Retrain tự động mỗi 6 giờ bằng APScheduler.

> **Điểm đáng chú ý**: NestJS có `MlClientService` đóng vai trò HTTP proxy đến Python. Nếu Python service down, NestJS fallback sang local heuristic model viết bằng TypeScript — đảm bảo không bị single point of failure.

---

### Q: Tại sao dùng NestJS thay vì Express thuần?

**Trả lời:**
NestJS cung cấp:
- **Dependency Injection** built-in → code có cấu trúc, dễ test và maintain
- **Decorator-based** routing (`@Controller`, `@Get`, `@Post`) → code clean hơn
- **Module system** → tách biệt `AuthModule`, `BookingModule`, `MlModule` rõ ràng
- **Guards** (`JwtAuthGuard`, `RolesGuard`) áp dụng global — không cần middleware riêng ở từng route
- **Pipes** (`ValidationPipe` với `class-validator`) — validate DTO tự động
- **WebSocket support** built-in qua `@WebSocketGateway`
- **Schedule** (`@Cron`) built-in cho cleanup expired reservations

---

### Q: Tại sao tách ML ra thành service riêng (Python FastAPI)?

**Trả lời:**
3 lý do chính:

1. **Ecosystem**: Python có scikit-learn, scipy, pandas, joblib — ecosystem ML tốt hơn Node.js nhiều. Các model `IsolationForest`, `GradientBoostingRegressor` rất khó implement từ đầu trong TypeScript.

2. **Resource isolation**: ML training (đặc biệt `GBR` với `n_estimators=150`) tốn nhiều CPU. Chạy riêng tránh block event loop của NestJS.

3. **Retrain schedule**: APScheduler Python chạy độc lập, train lại mỗi 6 giờ mà không block API backend.

Nhược điểm: thêm network hop, thêm infrastructure. Giải quyết bằng local fallback trong NestJS khi Python service down.

---

## 1.2 Câu hỏi về NestJS / Backend

---

### Q: Bạn implement Module hóa như thế nào? Tại sao chia như vậy?

**Trả lời:**
3 module chính:

- **AuthModule**: Tất cả liên quan auth — login, register, JWT, refresh token, MFA, OAuth (Google/GitHub/Microsoft), device management, password history, email verification. Module này export `JwtStrategy` và apply `JwtAuthGuard` + `RolesGuard` làm global guard thông qua `APP_GUARD`. Nghĩa là **tất cả routes đều bị bảo vệ mặc định**, muốn public phải thêm decorator `@Public()`.

- **BookingModule**: 16 services bao gồm event, reservation, payment, ticket, seat, queue, coupon, comment, resale, check-in, smart seat, livestream, event media, organizer, venue, dashboard. Import `MlModule` để dùng ML trong booking logic.

- **MlModule**: Wrapper quanh Python FastAPI. Export `FraudDetectionService` và `DemandForecastService` cho `BookingModule` dùng.

Chia như vậy theo **Domain-Driven Design** — mỗi module đóng gói một bounded context.

---

### Q: Global Exception Filter là gì và bạn dùng nó như thế nào?

**Trả lời:**
`GlobalExceptionFilter` implement interface `ExceptionFilter`. Nó catch **tất cả** exceptions chưa được handle, format lại response thống nhất:

```json
{
  "statusCode": 400,
  "message": "...",
  "error": "Bad Request",
  "timestamp": "2026-03-23T...",
  "path": "/api/v1/bookings/reserve"
}
```

Apply global trong `main.ts` qua `app.useGlobalFilters(new GlobalExceptionFilter())`. Nhờ đó frontend luôn nhận được cùng format JSON dù lỗi xảy ra ở đâu trong hệ thống.

---

### Q: ValidationPipe với `whitelist: true` và `forbidNonWhitelisted: true` có tác dụng gì?

**Trả lời:**
- `whitelist: true`: Tự động **strip** những property không được khai báo trong DTO class. Ví dụ user gửi `{ "isAdmin": true }` thêm vào body — field đó bị xóa trước khi vào controller.
- `forbidNonWhitelisted: true`: Thay vì strip thì **throw 400 error** nếu có property lạ. Bảo vệ mạnh hơn.
- `transform: true`: Tự động convert type. Ví dụ `"5"` (string từ query param) → `5` (number) nếu DTO khai báo `@IsNumber()`.

Đây là cách phòng Mass Assignment attack.

---

### Q: `@Cron()` cleanup expired reservations hoạt động như thế nào?

**Trả lời:**
Sử dụng `@nestjs/schedule`. Trong `ReservationService` có method được decorate `@Cron(CronExpression.EVERY_MINUTE)`. Mỗi phút chạy một lần:

1. Query tất cả `Reservation` có `status = PENDING` và `expiresAt < now()`
2. Với mỗi reservation tìm được, gọi `releaseReservation()` trong transaction:
   - Update reservation status → `EXPIRED`
   - Restore seats từ `RESERVED` → `AVAILABLE`
   - Increment lại `available_quantity` của TicketTier và `availableTickets` của Event
   - Nếu Event đang `SOLD_OUT` nhưng có vé lại → revert về `ON_SALE`
3. Release Redis seat locks nếu còn

Điều này đảm bảo vé không bị "treo" mãi mãi khi user không hoàn thành payment.

---

### Q: Rate limiting được implement như thế nào?

**Trả lời:**
Dùng `@nestjs/throttler`. Config trong `AppModule` với TTL và LIMIT lấy từ env variables. `ThrottlerGuard` apply global — giới hạn số request mỗi IP trong khoảng thời gian nhất định.

Ngoài ra trong `LoginAttemptService` còn có rate limiting tầng application:
- Redis counter `login_attempts:{email}` → sau `MAX_LOGIN_ATTEMPTS` (mặc định 5) lần thất bại → lock account
- Redis counter `ip_attempts:{ip}` → sau 50 lần/giờ → block IP hoàn toàn

---

## 1.3 Câu hỏi về Database & Prisma

---

### Q: Tại sao dùng Prisma thay vì TypeORM hay raw SQL?

**Trả lời:**
- **Type safety**: Prisma generate TypeScript types từ schema. Compiler báo lỗi ngay nếu dùng sai field.
- **Schema-first**: Viết schema một nơi (`.prisma` file), Prisma generate migration và client tự động.
- **Better DX**: Query API rõ ràng hơn TypeORM (không cần `QueryBuilder` phức tạp).
- **Prisma Studio**: GUI inspect data nhanh trong development.

Nhược điểm: Prisma không hỗ trợ `SELECT ... FOR UPDATE` native, phải dùng `$queryRaw`. Đây là điểm quan trọng trong project này vì cần pessimistic locking.

---

### Q: Bạn giải thích `@@map("users")` và `@map("user_id")` trong Prisma là gì?

**Trả lời:**
- `@@map("users")` ở cấp model: Map tên model Prisma (`User`) sang tên table thực trong PostgreSQL (`users`). Prisma theo convention camelCase, DB theo snake_case.
- `@map("user_id")` ở cấp field: Map tên field Prisma (`userId`) sang tên column thực (`user_id`).

Nhờ vậy code TypeScript dùng `camelCase` (chuẩn JS), còn DB dùng `snake_case` (chuẩn SQL), không cần compromise một bên.

---

### Q: `version: Int @default(0)` xuất hiện ở nhiều model là để làm gì?

**Trả lời:**
Đây là **Optimistic Locking** pattern. Khi 2 request đồng thời cùng đọc cùng 1 row (ví dụ `Seat` với `version = 5`), rồi cả 2 cùng muốn update:

```sql
UPDATE seats SET status = 'RESERVED', version = 6 
WHERE id = '...' AND version = 5
```

Chỉ một request thành công (`version = 5` match). Request kia sẽ update 0 rows → detect conflict → retry hoặc throw error.

Trong project này, `Seat`, `TicketTier`, và `ResaleListing` dùng `version` để prevent lost updates khi có nhiều concurrent booking.

---

### Q: Tại sao `Ticket` lại có `tierName`, `seatLabel`, `price` mặc dù đã có foreign key đến `TicketTier` và `Seat`?

**Trả lời:**
Đây là **data snapshot** pattern. Khi ticket được phát hành, giá trị đó được "freeze" tại thời điểm mua:

- `tierName`: Tier sau này có thể đổi tên (e.g., "Economy" → "Standard"), nhưng ticket đã issued vẫn hiển thị tên cũ
- `price`: Dynamic pricing làm giá thay đổi liên tục. Snapshot price = giá bạn **thực sự trả**
- `seatLabel`: Format hiển thị "Row1-5" — tiện cho QR code và check-in mà không cần join thêm bảng

Đây là best practice trong hệ thống e-commerce/ticketing: **không bao giờ join để lấy giá lịch sử**, vì giá có thể thay đổi.

---

## 1.4 Câu hỏi về Concurrency & Race Condition

---

### Q: Bạn xử lý race condition khi 2 người cùng đặt ghế cuối cùng như thế nào?

**Trả lời:**
Hệ thống dùng **3 tầng bảo vệ**:

**Tầng 1 — Redis NX Lock** (trước transaction):
Trước khi vào DB transaction, frontend đã lock ghế bằng WebSocket `lock-seat`. `SeatLockService.lockSeat()` dùng Redis `SET NX` (only if not exists). Chỉ người lock đầu tiên thành công, người sau nhận `seat-error`.

**Tầng 2 — Serializable Transaction + FOR UPDATE**:
Trong `reserveTickets()`:
```typescript
return prisma.$transaction(async (tx) => {
  // Lock event row
  await tx.$queryRaw`SELECT id FROM events WHERE id = ${eventId} FOR UPDATE`
  // Lock tier row
  await tx.$queryRaw`SELECT id FROM ticket_tiers WHERE id = ${tierId} FOR UPDATE`
  // Lock specific seat rows
  await tx.$queryRaw`SELECT id FROM seats WHERE id IN (...) FOR UPDATE`
  // Now safely decrement
  await tx.ticketTier.update({ data: { availableQuantity: { decrement: qty } } })
}, { isolationLevel: 'Serializable' })
```

`FOR UPDATE` lock rows ở DB level. Isolation level `Serializable` ngăn phantom reads (đọc rows mới xuất hiện giữa chừng trong transaction).

**Tầng 3 — Optimistic Lock** (version field):
Nếu 2 transaction vẫn slip qua (edge case), `version` mismatch sẽ detect conflict.

> **Kết quả**: Không bao giờ oversell. Worst case: một user thấy ghế available (vì read trước lock), vào transaction thì bị block, chờ transaction kia commit, rồi thấy ghế đã RESERVED → rollback.

---

### Q: Tại sao dùng `Serializable` isolation thay vì `Read Committed` (default)?

**Trả lời:**
`Read Committed` (default PostgreSQL) cho phép **Non-repeatable reads** và **Phantom reads**:

- Transaction A đọc: `availableQuantity = 1`
- Transaction B đọc: `availableQuantity = 1` (vì A chưa commit)
- Transaction A update → commit: `availableQuantity = 0`
- Transaction B cũng update → commit: `availableQuantity = -1` ← **OVERSELL!**

`Serializable` đảm bảo 2 concurrent transactions chạy như thể tuần tự. PostgreSQL dùng SSI (Serializable Snapshot Isolation) — không blocking reads nhưng detect conflicts và abort transaction vi phạm.

Chi phí: Serializable cao hơn về overhead, nhưng chỉ dùng cho critical paths (reserve, payment confirm, webhook) — không ảnh hưởng đến read-heavy operations như `listEvents()`.

---

### Q: Stripe webhook idempotency được handle như thế nào?

**Trả lời:**
Stripe có thể gửi cùng 1 webhook **nhiều lần** (retry khi timeout). `handleStripeWebhook()` phòng tránh xử lý trùng:

```typescript
// Trong Serializable transaction:
const payment = await tx.$queryRaw`
  SELECT * FROM payments 
  WHERE provider_payment_id = ${piId} 
  AND status = 'PENDING'
  FOR UPDATE
`
// Nếu payment không tồn tại hoặc status != PENDING → đã xử lý rồi → skip
if (!payment) return
// Xử lý...
```

`FOR UPDATE` + check status = `PENDING` đảm bảo:
1. Chỉ xử lý 1 lần (sau khi xử lý xong, status = `COMPLETED`, không match `PENDING` nữa)
2. Nếu 2 webhooks đến đồng thời, cái sau chờ cái trước unlock, rồi thấy không còn `PENDING` → skip

---

### Q: Redis seat lock TTL 5 phút có đủ không? Có thể xảy ra vấn đề gì?

**Trả lời:**
**5 phút đủ** cho flow: chọn ghế → điền form → submit reserve (thường < 2 phút).

**Vấn đề tiềm ẩn**:
1. **Clock skew**: Nếu Redis server clock lệch. Giải quyết bằng `pool_pre_ping` và consistent clock source.
2. **Lock expire mid-transaction**: User lock ghế 4:58, Redis expire lúc 5:00, transaction chưa xong. Giải quyết: Transaction Serializable + FOR UPDATE ở DB level vẫn đảm bảo, Redis lock chỉ là tầng UX (hiển thị realtime cho users khác).
3. **User disconnect**: `SeatGateway.handleDisconnect()` tự release tất cả locks khi socket ngắt kết nối.
4. **Max 10 locks per user**: Giới hạn `MAX_LOCKS_PER_USER = 10` trong Redis set, tránh user lock hết ghế rồi không mua.

---

## 1.5 Câu hỏi về Authentication & Security

---

### Q: JWT flow với Access Token và Refresh Token hoạt động thế nào?

**Trả lời:**
```
Login → Access Token (15 phút) + Refresh Token (7 ngày, 28 ngày nếu Remember Me)
                                                ↓
                                     Lưu Redis: refresh:{userId}:{deviceId} = JTI
                                                ↓
                             Access Token expire → Call /auth/refresh-token
                                                ↓
                             Verify Refresh Token bằng JTI trong Redis
                             Blacklist JTI cũ → Issue cặp token mới (Token Rotation)
```

**Token Blacklist**: Mỗi access token có JTI (JWT ID) — UUID unique. Khi logout, JTI được lưu vào Redis `blacklist:{jti}` với TTL = thời gian còn lại của token. `JwtStrategy.validate()` check Redis blacklist trước khi accept.

**Device tracking**: Mỗi device có `deviceId`. Refresh token được gắn với `deviceId` — logout khỏi device cụ thể chỉ xóa Redis key của device đó.

---

### Q: TOTP MFA được implement như thế nào?

**Trả lời:**
Dùng thư viện `otplib`:

1. **Setup**: Generate TOTP secret (base32 string) → Encrypt bằng AES-256-GCM (key derive từ `JWT_SECRET` qua SHA-256) → Lưu `secretEncrypted` vào `MfaSecret` table
2. **Verify setup**: User input OTP từ authenticator app → `totp.verify({ token, secret })` → Nếu đúng, `verified = true`
3. **Login với MFA**: Login thành công nhưng MFA enabled → Issue `MFA_PENDING` JWT (5 phút TTL) → User gửi OTP code → `verifyMfa()` verify TOTP → Issue Access + Refresh token thực sự
4. **Backup codes**: 10 codes random → hash bằng SHA-256 → lưu JSON array → khi dùng thì mark đã dùng (remove khỏi array)

**Dynamic QR cho ticket**: Implement tương tự nhưng không phải TOTP chuẩn. Dùng HMAC-SHA256(`ticketCode`, `timeSlot`) → Base36 encode → rotate mỗi 30 giây. Mục đích: prevent screenshot sharing ticket.

---

### Q: Bạn xử lý OWASP Top 10 như thế nào trong dự án này?

**Trả lời:**

| OWASP | Cách xử lý |
|-------|-----------|
| **Injection** | Prisma ORM parameterized queries, ValidationPipe whitelist/forbidNonWhitelisted |
| **Broken Auth** | JWT + Redis blacklist, MFA, device tracking, brute-force lock |
| **Sensitive Data Exposure** | bcrypt password hash (không reversible), AES-256-GCM cho MFA secret, không log sensitive data |
| **Broken Access Control** | `@Roles('ROLE_ADMIN')` guard, ownership checks (reservation.userId === user.id) |
| **Security Misconfiguration** | Global `ValidationPipe` strip unknown fields, CORS whitelist từ env |
| **SSRF** | ML client chỉ call `ML_SERVICE_URL` từ env, không dùng user input làm URL |
| **Mass Assignment** | `whitelist: true` ở ValidationPipe |
| **Stripe Webhook** | Signature verification bằng `webhooks.constructEvent()` |
| **Anti-scalping** | Resale max 150% original price hardcode, per-user ticket limit |

---

### Q: `PasswordHistory` dùng để làm gì?

**Trả lời:**
Ngăn user tái sử dụng mật khẩu cũ. Khi đổi mật khẩu, `PasswordService` check 5 mật khẩu gần nhất bằng `bcrypt.compare()`. Nếu newPassword match bất kỳ cái nào → throw error "Không được dùng mật khẩu cũ".

Sau khi đổi thành công, hash mới được append vào `password_history`, giữ tối đa 5 entries (xóa entries cũ nhất).

---

## 1.6 Câu hỏi về Payment & Stripe

---

### Q: Luồng Stripe Payment flow hoạt động thế nào?

**Trả lời:**
```
1. Frontend → POST /payments/initiate { reservationId, provider: "STRIPE" }
2. Backend → stripe.paymentIntents.create({ amount, currency, metadata: { reservationId } })
           → Lưu Payment record với providerPaymentId = pi_xxx, providerClientSecret = pi_xxx_secret_yyy
           → Return { clientSecret: "pi_xxx_secret_yyy" }

3. Frontend → Stripe Elements SDK dùng clientSecret render form nhập thẻ
4. User điền info → stripe.confirmPayment({ redirect: "if_required" })
   → Stripe xử lý trên server của họ

5a. SUCCESS → Stripe redirect về /payments/callback?status=succeeded&...
             → Frontend gọi POST /payments/confirm-stripe { paymentIntentId, reservationId }
             → Backend verify qua stripe.paymentIntents.retrieve() → Confirm reservation + Issue tickets

5b. WEBHOOK: Stripe cũng gửi POST /payments/webhook/stripe (ngay cả khi redirect fail)
             → Verify signature → Process payment (idempotent)
```

> Dual confirmation: redirect callback + webhook đảm bảo không bao giờ miss payment kể cả khi user đóng tab.

---

### Q: Tại sao cần extend reservation expiry khi initiate payment?

**Trả lời:**
Reservation mặc định expire sau 15 phút. Nhưng quá trình thanh toán Stripe (đặc biệt 3D Secure authentication) có thể mất thêm thời gian. Khi user click "Pay", `initiatePayment()` extend `expiresAt` thêm 30 phút — đủ thời gian hoàn thành 3DS flow mà không bị cron job xóa mất reservation.

---

### Q: Refund flow xử lý seats/tickets như thế nào?

**Trả lời:**
`refundPayment()` không chỉ update payment:
1. Payment status → `REFUNDED`
2. Gọi `releaseReservation()` → Reservation status → `CANCELLED`
3. Seats → `AVAILABLE` (có thể bán lại)
4. Tăng lại `available_quantity` của TicketTier
5. Tăng lại `availableTickets` của Event
6. Nếu Event đang `SOLD_OUT` → revert về `ON_SALE`
7. Tickets → `CANCELLED`

Stripe refund API call được để trong TODO comment cho production — cần `stripe.refunds.create({ payment_intent: piId })`.

---

## 1.7 Câu hỏi về Real-time / WebSocket

---

### Q: WebSocket seat locking hoạt động như thế nào về mặt kỹ thuật?

**Trả lời:**
`SeatGateway` là Socket.IO gateway (`@WebSocketGateway({ namespace: '/ws' })`):

```
User A connect → authenticate Bearer token → join room 'event:eventId'
               → receive current locked seats (snapshot từ Redis)

User A emit 'lock-seat' { eventId, seatId }
  → SeatLockService.lockSeat() → Redis SET seat:lock:eventId:seatId = userAId NX EX 300
  → SUCCESS: broadcast 'seat-update' { type: SEAT_LOCKED, seatId } đến room 'event:eventId'
  → User B nhận → update UI ghế đó thành màu đỏ (locked by another user)

User A disconnect
  → handleDisconnect() → SeatLockService.releaseAllUserLocks(userId)
  → Broadcast SEAT_UNLOCKED cho tất cả ghế user A đã lock
```

**Room-based broadcasting**: Dùng `server.to('event:eventId').emit(...)` — chỉ users đang xem cùng event nhận updates, không spam toàn bộ connected clients.

---

### Q: Redis `SET NX` là gì và tại sao dùng thay vì GET + SET?

**Trả lời:**
`SET NX` = SET only if Not eXists — **atomic operation** tại Redis server. Trong một round trip:
- Nếu key chưa tồn tại: SET + return OK
- Nếu key đã tồn tại: Không làm gì + return nil

Nếu dùng GET rồi SET riêng:
```
T1: GET seat:lock:... → nil (chưa có)
T2: GET seat:lock:... → nil (chưa có)  
T1: SET seat:lock:... = user1
T2: SET seat:lock:... = user2  ← RACE CONDITION! Ghi đè user1
```

`SET NX` tránh được race condition này hoàn toàn.

---

## 1.8 Câu hỏi về ML Service (Python FastAPI)

---

### Q: 3 ML model làm gì và thuật toán nào?

**Trả lời:**

**1. Fraud Detection — `IsolationForest`**:
- Unsupervised (không cần label) → phù hợp vì không có data labeled "fraud"
- Học pattern của phần lớn users (normal) → isolate anomalies
- 8 features: booking velocity (10 phút), cancel ratio, payment fail ratio, tổng vé 30 ngày, night booking ratio (2-5 AM), avg amount, unique events, days since first booking
- Score 0-100: < 50 ALLOW, 50-70 REVIEW, > 70 BLOCK
- Fallback khi chưa có model: weighted heuristic cùng 5 signals

**2. Demand Forecasting — `GradientBoostingRegressor` + `LogisticRegression`**:
- GBR predict `sold_in_24h` (regression)
- LR predict `sellout_probability` (binary classification)
- 12 features bao gồm fill_rate, velocity (1h/24h/7d), velocity_trend, cyclical encoding của giờ (sin/cos) và ngày trong tuần (sin/cos)
- Output: sold_24h, sold_72h, sellout probability, predicted sellout date, demand heatmap

**3. Dynamic Pricing — `GradientBoostingRegressor`**:
- 7 features: fill_rate, days_to_event, velocity_24h, base_price, tier_fill_rate, avg_event_price, competitor_ratio
- Output: multiplier (0.7 - 2.0) → dynamicPrice = base_price × multiplier
- Training data augmented với 6 synthetic scenarios per tier (vì data thực ít)

---

### Q: NestJS fallback khi Python service down hoạt động như thế nào?

**Trả lời:**
`MlClientService` có `isHealthy` flag. `onModuleInit()` gọi `GET /api/ml/health`:

```typescript
async callMlService(endpoint, fallback) {
  if (!this.isHealthy) return fallback()
  try {
    const res = await fetch(this.mlUrl + endpoint, { signal: AbortSignal.timeout(10000) })
    return await res.json()
  } catch (e) {
    this.isHealthy = false
    return fallback()  // ← fallback function được pass vào
  }
}
```

Fallback functions:
- `FraudDetectionService.analyzeUser()` — weighted heuristic trong TypeScript
- `DemandForecastService.forecastEvent()` — exponential smoothing đơn giản
- `SmartSeatService.getDynamicPrice()` — rule-based pricing (fill rate, time to event, category)

Periodic health check recover `isHealthy` flag khi Python service restart.

---

### Q: Tại sao IsolationForest được chọn cho fraud detection thay vì supervised model?

**Trả lời:**
3 lý do:
1. **No labeled data**: Không có dataset "đây là fraud, đây không phải" — IsolationForest là unsupervised, học pattern từ data unlabeled.
2. **Minority class problem**: Fraud rất hiếm (1-5% transactions). Supervised model bị class imbalance, khó train. IsolationForest không cần balanced data.
3. **Novel fraud detection**: IsolationForest detect anomalies mới mà chưa từng thấy, không chỉ match patterns đã biết.

Nhược điểm: Không có explicit "fraud/not fraud" label → score là relative. Giải quyết bằng cách kết hợp với rule-based signals (velocity, cancel pattern) cho interpretability.

---

### Q: `contamination` parameter trong IsolationForest được set như thế nào?

**Trả lời:**
```python
contamination = min(0.1, 2 / n_users)
```
`contamination` = tỉ lệ anomalies kỳ vọng trong dataset. Logic:
- Nếu có ít users (ví dụ 10 users) → 2/10 = 0.2 nhưng capped ở 0.1 → tối đa 10% bị coi là fraud
- Nếu có nhiều users (ví dụ 1000 users) → 2/1000 = 0.002, rất thấp → chỉ mark rất ít người là suspicious

Công thức này lean về phía false negative (miss fraud) thay vì false positive (block legit user) — phù hợp cho UX ticketing.

---

## 1.9 Câu hỏi về Performance & Scaling

---

### Q: Hệ thống có thể scale như thế nào?

**Trả lời:**

**Horizontal scaling NestJS**:
- Stateless (JWT, không session server-side) → dễ scale bằng load balancer
- Redis tập trung cho seat locks + JWT blacklist → multiple NestJS instances share state
- WebSocket Gateway cần sticky session hoặc Redis adapter (`socket.io-redis`) để broadcast cross-instances

**Database**:
- Serializable transactions là bottleneck — tăng PostgreSQL connections pool
- Read replicas cho `listEvents()`, `getEvent()` — heavy read operations
- Indexing: `email` (unique), `event_id + status` (seat queries), `reservation id + status` (cron jobs)

**ML Service**:
- Stateless API (models loaded in memory) → scale horizontally
- Models retrain mỗi 6h — dùng shared filesystem hoặc S3 để share `.joblib` files giữa instances

---

### Q: Cron job cleanup mỗi phút có ổn không nếu có nhiều expired reservations?

**Trả lời:**
**Potential issue**: Nếu có hàng nghìn expired reservations, query + release tất cả trong 1 phút có thể tạo DB spike.

**Cải thiện production**:
1. **Batch processing**: Xử lý theo batch (e.g., 100 reservations/lần) thay vì tất cả cùng lúc
2. **Staggered expiry**: Dùng Redis sorted set với score = expiry timestamp → pop và process theo thứ tự
3. **Database indexing**: Đảm bảo `(status, expires_at)` có composite index để query nhanh
4. **Dead letter queue**: Dùng Bull/BullMQ queue thay vì cron — scale tốt hơn, retry built-in

---

### Q: Dynamic QR code "dynamic" như thế nào và tại sao?

**Trả lời:**
`getDynamicQr()` tạo code mới mỗi 30 giây:

```typescript
const timeSlot = Math.floor(Date.now() / 30000)  // thay đổi mỗi 30 giây
const hmac = createHmac('sha256', ticketCode)
hmac.update(String(timeSlot))
const code = hmac.digest('base64').substring(0, 8)
```

Tại sao cần dynamic?
- **Static QR**: Chụp screenshot → có thể dùng nhiều lần → người không có vé thật vẫn check-in được
- **Dynamic QR**: Chụp screenshot lúc 10:15:00 → hết hạn lúc 10:15:30 → không dùng được

Check-in staff dùng camera scan → verify trong cùng 30-second window → so sánh HMAC. Yêu cầu clock đồng bộ giữa server và check-in device.

---

## 1.10 Câu hỏi bẫy / Nâng cao

---

### Q: Serializable isolation có thể gây DEADLOCK không? Xử lý thế nào?

**Trả lời:**
**Có**, nếu 2 transactions lock theo thứ tự ngược nhau:
- TX1: Lock seat A → chờ seat B
- TX2: Lock seat B → chờ seat A → **DEADLOCK**

PostgreSQL detect và auto-abort một trong hai transactions (throw `deadlock detected` error).

**Cách phòng tránh**:
1. **Consistent lock ordering**: Luôn sort IDs trước khi lock. `ORDER BY id` trong `SELECT ... FOR UPDATE` đảm bảo mọi transaction lock theo cùng thứ tự.
2. **Retry logic**: Catch `P2034` (Prisma prisma serialization error) hoặc deadlock → retry transaction 2-3 lần với exponential backoff.

Trong code hiện tại, lock event → lock tier → lock seats (consistent order), giảm thiểu deadlock risk.

---

### Q: `providerClientSecret` trong Payment table lưu, có vấn đề gì không?

**Trả lời:**
Đây là **Stripe client secret** — dùng một lần để confirm payment từ frontend. Về mặt security:
- Stripe client secret không thể dùng để charge thêm tiền hay refund — chỉ dùng để confirm intent đã tạo
- Hết hạn sau khi PaymentIntent hoàn thành hoặc cancelled
- **Improvement**: Không lưu vào DB production (chỉ return trong response). Sau khi payment confirmed, value này vô dụng. Lưu chỉ hữu ích cho retry (user quay lại trang checkout).

---

### Q: Tại sao `ReservationItem` có cả `seatId` (nullable) lẫn `tierId`?

**Trả lời:**
Hệ thống hỗ trợ **3 loại tier** (`TierType`):
- `ASSIGNED`: Ghế cụ thể được assign → `seatId` có giá trị (ví dụ: "Row A, Seat 1")
- `ZONE`: Ghế trong zone không cần số cụ thể → `seatId` nullable, chỉ cần `tierId` + `zoneName`
- `GA` (General Admission): Đứng, không ghế → `seatId` = null, chỉ cần `tierId`

`tierId` luôn required để biết tier nào, giá bao nhiêu, còn bao nhiêu vé. `seatId` chỉ required khi tier là `ASSIGNED`.

---

### Q: Resale listing "LOCKED" state là gì, tại sao cần?

**Trả lời:**
Khi buyer muốn mua vé resale, có race condition: 2 buyers cùng click "Buy" vào cùng 1 listing.

Solution: **Two-phase purchase**:
1. `lockForPurchase()` → SERIALIZABLE tx `FOR UPDATE` → Listing status: `LISTED` → `LOCKED`, `lockExpiresAt = now() + 10 min`
   - Only 1 buyer thành công lock, buyer kia nhận conflict error
2. Buyer có 10 phút complete payment
3. Nếu payment success → `completePurchase()` → `SOLD`
4. Nếu 10 phút hết mà chưa mua → cron/manual expire → `LISTED` lại (buyer khác có thể mua)

Tương tự pattern của `Reservation` (15 min) nhưng ở tầng resale marketplace.

---

# 2. GIẢI THÍCH SCHEMA — TỪNG FIELD

---

## AUTH DOMAIN

---

### Model `User` — Bảng `users`

```
id               — UUID primary key, tự sinh. Dùng UUID thay int/bigint để tránh
                   expose thứ tự record, khó đoán ID của user khác.

email            — Unique. Dùng để login và nhận email verification/reset password.
                   Lowercase được enforce ở application layer.

passwordHash     — Nullable vì user OAuth (Google/GitHub) không có password.
                   Lưu bcrypt hash ($2b$...), KHÔNG bao giờ lưu plain text.

username         — Optional display name, không dùng để login.

firstName        — Tên (first name). Optional vì OAuth user có thể không cung cấp.

lastName         — Họ (last name). Optional.

phoneNumber      — Optional. Dùng cho 2FA SMS (nếu implement sau).

profilePicture   — URL đến ảnh avatar. Lưu path trong uploads/ hoặc URL bên ngoài.

enabled          — Kill switch: false = account bị disable hoàn toàn,
                   không login được dù password đúng. Khác accountLocked ở chỗ
                   accountLocked là tạm thời (có lockedUntil), enabled=false là vĩnh viễn.

emailVerified    — Bắt buộc verify email trước khi sử dụng đầy đủ chức năng.
                   false sau khi register, true sau khi click link verify email.

accountLocked    — true khi vượt quá MAX_LOGIN_ATTEMPTS lần đăng nhập sai.
                   Tạm thời bị lock đến lockedUntil.

mfaEnabled       — true khi user đã setup và verify TOTP authenticator.
                   false = bỏ qua MFA khi login.

lockedUntil      — Thời điểm tài khoản được mở khóa tự động. null nếu không bị lock.
                   Ví dụ: lock 30 phút sau 5 lần nhập sai.

lastLoginAt      — Timestamp lần login gần nhất. Dùng cho security notifications
                   ("Phát hiện đăng nhập mới từ thiết bị lạ").

emailVerifiedAt  — Khi nào email được verify. Null = chưa verify.

passwordChangedAt — Khi nào đổi mật khẩu lần cuối. Dùng để invalidate
                   tất cả tokens cũ hơn thời điểm này (security feature).

maxDevices       — Tối đa bao nhiêu thiết bị được đăng nhập đồng thời. Default 3.
                   Nếu vượt, thiết bị cũ nhất bị revoke session.
```

---

### Model `Role` — Bảng `roles`

```
id           — UUID primary key.
name         — Unique role name, e.g. "ROLE_USER", "ROLE_ADMIN". Unique constraint.
description  — Mô tả role cho admin hiểu, e.g. "Standard user with booking access".
```

---

### Model `Permission` — Bảng `permissions`

```
id          — UUID primary key.
name        — Unique permission name, e.g. "events:create", "bookings:read".
resource    — Tài nguyên được phép, e.g. "events", "users", "payments".
action      — Action được phép, e.g. "create", "read", "update", "delete".
description — Mô tả: "Cho phép tạo events mới".
```

---

### Model `UserRole` — Bảng `user_roles`

```
userId   — FK đến users. CASCADE delete (xóa user → xóa tất cả roles của họ).
roleId   — FK đến roles. CASCADE delete (xóa role → xóa assignment khỏi tất cả users).

@@id([userId, roleId])  — Composite primary key: 1 user không thể có 2 dòng cùng role.
                           Đây là junction table cho quan hệ Many-to-Many User↔Role.
```

---

### Model `OAuthAccount` — Bảng `oauth_accounts`

```
userId         — FK đến user đang sở hữu account này.
provider       — Tên provider: "google", "github", "microsoft".
providerUserId — ID của user trong hệ thống của provider (Google sub, GitHub id...).
                 Dùng cùng provider để identify user khi callback OAuth.
email          — Email từ provider (có thể khác email chính của user).
name           — Tên hiển thị từ provider.
imageUrl       — Avatar URL từ provider.
accessToken    — OAuth access token để gọi API của provider (nếu cần).
refreshToken   — OAuth refresh token để renew access token.
expiresAt      — Khi nào access token hết hạn.
```

---

### Model `VerificationToken` — Bảng `verification_tokens`

```
tokenHash  — SHA-256 hash của token thực sự được gửi qua email.
             KHÔNG lưu plain token — nếu DB bị breach, token URL không bị lộ.
             Khi user click link verify?token=abc → server hash abc → so sánh.
type       — Loại token: "EMAIL_VERIFICATION", "PASSWORD_RESET", etc.
userId     — Ai sở hữu token này.
expiresAt  — Token hết hạn sau bao lâu (1h cho password reset, 24h cho email verify).
used       — Dùng rồi chưa. Token 1 lần chỉ được dùng 1 lần — sau khi used=true, không thể
             dùng lại dù chưa expire (prevent replay attacks).
```

---

### Model `MfaSecret` — Bảng `mfa_secrets`

```
userId          — FK unique: mỗi user chỉ có 1 MFA secret.
secretEncrypted — TOTP secret (base32) được mã hóa AES-256-GCM.
                  Không lưu plain text vì nếu lộ secret → attacker có thể generate OTP codes.
enabled         — User đã bật MFA hay chưa.
backupCodes     — JSON array 10 backup codes (đã hash SHA-256). Dùng khi mất điện thoại.
                  Format: ["hash1", "hash2", ...]. Khi dùng thì xóa code đó khỏi array.
verified        — User đã verify setup thành công chưa. Setup MFA cần verify 1 lần trước khi enable.
verifiedAt      — Khi nào verify.
```

---

### Model `UserDevice` — Bảng `user_devices`

```
userId          — Thiết bị này thuộc user nào.
deviceId        — Unique identifier cho device. Generate từ fingerprint (browser hash / device hash).
                  Unique constraint — không thể 2 record cùng deviceId.
deviceName      — Tên device tự đặt, e.g. "MacBook Pro của tôi" hoặc auto-detect.
deviceType      — "desktop", "mobile", "tablet".
browser         — "Chrome", "Firefox", "Safari".
browserVersion  — "121.0.6167.85".
operatingSystem — "Windows 10", "macOS 14.2", "iOS 17.1".
osVersion       — Version OS cụ thể.
ipAddress       — IP lúc đăng nhập lần cuối.
location        — Tên địa lý derive từ IP, e.g. "Hanoi, Vietnam".
userAgent       — Full User-Agent string gốc.
active          — false = device bị manually revoke hoặc session expired.
trusted         — Trusted device không cần MFA. User có thể mark device là trusted.
lastActiveAt    — Lần cuối device này được dùng.
```

---

### Model `PasswordHistory` — Bảng `password_history`

```
userId       — Lịch sử mật khẩu của user nào.
passwordHash — Bcrypt hash của mật khẩu cũ. Lưu 5 hash gần nhất.
               Khi đổi mật khẩu, so sánh mật khẩu mới với 5 hash này.
               Nếu match → báo lỗi "Không được dùng lại mật khẩu cũ".
```

---

### Model `LoginAttempt` — Bảng `login_attempts`

```
userId        — Nullable! Nếu email không tồn tại trong DB, userId = null
               (không biết user nào nhưng vẫn log attempt).
email         — Email người thử đăng nhập (dù fail hay success).
ipAddress     — IP của request. Dùng để detect IP-based brute force.
deviceInfo    — User-Agent / device info tóm tắt.
success       — true = đăng nhập thành công, false = sai password/locked/etc.
failureReason — Lý do thất bại: "WRONG_PASSWORD", "ACCOUNT_LOCKED", "EMAIL_NOT_VERIFIED", "MFA_REQUIRED".
attemptedAt   — Thời điểm thử. Lưu separate từ createdAt để phân biệt
               thời điểm thử (client) vs thời điểm ghi log (server).
```

---

### Model `AuditLog` — Bảng `audit_logs`

```
userId       — Nullable vì có thể là unauthenticated action (e.g., failed login).
action       — Hành động: "LOGIN", "LOGOUT", "PASSWORD_CHANGE", "MFA_ENABLED", "DEVICE_REVOKED".
resource     — Tên resource cụ thể, e.g. "reservation:abc-123".
resourceType — Loại resource: "Reservation", "Event", "User".
resourceId   — UUID của resource bị tác động.
details      — Mô tả text free-form.
detailsJson  — Structured JSON cho details phức tạp, e.g. old/new values khi edit.
ipAddress    — IP của request để audit security.
userAgent    — Browser/app identifier.
deviceId     — Thiết bị nào thực hiện action.
success      — Action thành công hay bị từ chối.
```

---

## BOOKING DOMAIN

---

### Model `Venue` — Bảng `venues`

```
name          — Tên địa điểm: "Mỹ Đình National Stadium", "Hà Nội Opera House".
address       — Địa chỉ đường phố. Nullable vì một số venue chỉ có tên + thành phố đủ.
city          — Thành phố: "Hanoi", "Ho Chi Minh City". Dùng để filter events theo city.
state         — Tỉnh/Bang. Nullable vì không phải quốc gia nào cũng dùng.
country       — Quốc gia: "Vietnam", "USA".
zipCode       — Mã bưu điện. Nullable.
capacity      — Sức chứa tối đa của venue. Dùng để validate tổng vé khi tạo event.
seatMapConfig — JSON config cho việc render seat map SVG/3D.
               Lưu layout thông tin: số hàng, số ghế/hàng, section names, shape.
imageUrl      — Ảnh venue dùng hiển thị trong event detail.
latitude      — Vĩ độ địa lý. Dùng Mapbox GL render marker trên bản đồ.
longitude     — Kinh độ địa lý. Cùng với latitude xác định vị trí venue.
```

---

### Model `Organizer` — Bảng `organizers`

```
userId        — FK đến User: người dùng nào là organizer này.
               Một user có thể có nhiều organizer (e.g., quản lý nhiều công ty).
name          — Tên ban tổ chức: "Live Nation Vietnam", "BigDreams Entertainment".
description   — Giới thiệu về organizer.
logoUrl       — Logo của ban tổ chức.
website       — Website chính thức.
contactEmail  — Email liên hệ công khai.
contactPhone  — Số điện thoại liên hệ.
followerCount — Đếm bao nhiêu user đang follow organizer này.
               Dùng denormalization (coun cached) thay vì COUNT(*) join mỗi lần
               để tránh slow query khi có hàng triệu followers.
verified      — Badge xác thực (như verified tick Twitter). Admin approve thủ công.
```

---

### Model `OrganizerFollower` — Bảng `organizer_followers`

```
userId        — User đang follow.
organizerId   — Organizer được follow.

@@unique([userId, organizerId])  — 1 user không thể follow cùng 1 organizer 2 lần.
                                   Constraint ở DB level, không chỉ application level.
                                   INSERT khi user click Follow, DELETE khi Unfollow.
```

---

### Model `Event` — Bảng `events`

```
venueId          — FK đến venue nơi tổ chức event.
createdById      — FK đến User tạo event (admin). Nullable vì data cũ có thể không có.
name             — Tên event: "Taylor Swift - The Eras Tour Hanoi".
description      — Mô tả chi tiết event. Text dài.
artistName       — Tên nghệ sĩ/đội thi đấu: "Taylor Swift", "Manchester City vs Chelsea".
category         — Enum loại event: CONCERT, SPORTS, THEATER, COMEDY, FESTIVAL, CONFERENCE, OTHER.
eventDate        — Ngày giờ chính thức của event. Nullable vì có thể tạo draft trước khi confirm.
doorsOpenAt      — Giờ mở cửa (thường trước eventDate 1-2 tiếng). Khán giả vào trước giờ này.
status           — Lifecycle của event:
                   DRAFT      → Admin đang soạn, chưa public
                   PUBLISHED  → Public nhưng chưa mở bán
                   ON_SALE    → Đang bán vé
                   PRESALE    → Presale cho nhóm ưu tiên (fan club, subscribers)
                   SOLD_OUT   → Hết vé
                   CANCELLED  → Event bị hủy
                   COMPLETED  → Event đã diễn ra xong
coverImageUrl    — Ảnh thumbnail hiển thị trong listing card.
totalTickets     — Tổng số vé tất cả tiers cộng lại. Tính lại khi thêm/sửa tier.
availableTickets — Số vé còn lại. Atomic decrement khi reserve, increment khi cancel.
                   Khi = 0 → tự động chuyển status sang SOLD_OUT.
onSaleAt         — Thời điểm bắt đầu bán vé chính thức. Null = không có lịch định trước.
presaleAt        — Thời điểm bắt đầu presale (sớm hơn onSaleAt). Null = không có presale.
maxTicketsPerUser — Giới hạn vé tối đa 1 user có thể mua. Chống scalper.
queueEnabled     — true = event phổ biến, bật hàng đợi (queue) thay vì first-come đơn thuần.
eventMode        — OFFLINE: tại venue vật lý
                   ONLINE: stream thuần
                   HYBRID: vừa offline vừa online
streamingUrl     — URL stream cho ONLINE/HYBRID events.
muxPlaybackId    — Mux.com playback ID cho HLS video stream.
                   Mux là dịch vụ video infrastructure. Không cần tự host media server.
muxAssetId       — Mux asset ID để manage video (start/stop stream, get status).
organizerId      — FK đến Organizer ban tổ chức event này.
endDate          — Ngày kết thúc (dùng cho multi-day festivals). Null = 1 ngày.
bannerUrl        — Ảnh banner lớn hiển thị ở đầu event detail page.
```

---

### Model `TicketTier` — Bảng `ticket_tiers`

```
eventId              — FK đến event chứa tier này. CASCADE delete.
name                 — Tên tier: "VIP", "Premium", "General Admission", "Economy".
description          — Mô tả quyền lợi: "VIP includes backstage access, meet & greet".
price                — Giá gốc. Decimal(10,2) = tối đa $99,999,999.99.
currency             — Tiền tệ: "USD", "VND". Default "USD".
totalQuantity        — Tổng số ghế/vé của tier này.
availableQuantity    — Còn bao nhiêu vé. Atomic decrement khi reserve, increment khi cancel.
maxPerUser           — Max vé của tier này 1 user có thể mua. Có thể khác maxTicketsPerUser của event.
sortOrder            — Thứ tự hiển thị tier. Tier VIP sort_order=1, Economy sort_order=4.
pricingPhase         — Phase giá hiện tại:
                       EARLY_BIRD   → Giảm giá cho người mua sớm
                       REGULAR      → Giá thông thường
                       LAST_MINUTE  → Tăng giá gần ngày diễn
earlyBirdPrice       — Giá early bird (thường thấp hơn price). Null = không có early bird.
lastMinutePrice      — Giá last minute (thường cao hơn price). Null = không có last minute.
earlyBirdEndDate     — Hết thời hạn early bird. Sau mốc này, giá tự động về price (REGULAR).
lastMinuteStartDate  — Bắt đầu last minute pricing. Từ mốc này, giá lên lastMinutePrice.
groupMinQuantity     — Mua tối thiểu bao nhiêu vé để nhận group discount. e.g. 5 vé.
groupDiscountPercent — Phần trăm giảm khi mua nhóm: 10.00 = 10% off.
tierType             — ASSIGNED: ghế được gán số cụ thể (A1, A2...)
                       ZONE: khu vực nhưng không số ghế (standing zone, GA floor)
                       GA: General Admission, không ghế, đứng tự do
zoneName             — Tên zone nếu tierType=ZONE: "Floor Standing", "Pit Area".
zoneCapacity         — Sức chứa của zone.
version              — Optimistic locking counter. Tăng mỗi khi update để detect concurrent modifications.
```

---

### Model `Seat` — Bảng `seats`

```
venueId       — FK đến venue. Ghế thuộc venue nào.
eventId       — FK đến event. Nullable vì ghế venue tồn tại độc lập với event.
               Khi event được tạo và gán tier, ghế mới được assign eventId.
tierId        — FK đến tier. Ghế thuộc tier nào (VIP, Economy...). Nullable.
section       — Khu vực: "VIP Section", "Front Section-A", "Back Section-B".
rowName       — Tên hàng: "Row 1", "Row A", "Row 10". String để hỗ trợ cả số cả chữ.
seatNumber    — Số ghế trong hàng: 1, 2, 3... Integer.
status        — Trạng thái ghế:
               AVAILABLE → Có thể đặt
               RESERVED  → Đã được reserve (đang pending payment, 15 phút)
               SOLD      → Đã bán (payment confirmed)
               BLOCKED   → Admin block (ghế hỏng, dành cho VIP, reserved cho ban tổ chức)
priceOverride — Nếu ghế này có giá đặc biệt khác với tier price. Ví dụ ghế đặc biệt $200
               trong tier VIP $150. Null = dùng giá tier.
version       — Optimistic locking. Detect khi 2 transactions cùng reserve 1 ghế.
```

---

### Model `Reservation` — Bảng `reservations`

```
userId         — User nào đặt.
eventId        — Event nào.
status         — PENDING   → vừa đặt, chưa thanh toán (tồn tại 15 phút)
               CONFIRMED → đã thanh toán thành công
               EXPIRED   → quá 15 phút chưa trả tiền, cron job cleanup
               CANCELLED → user chủ động hủy (hoặc auto-cancel khi refund)
totalAmount    — Tổng tiền TRƯỚC discount. Tổng của priceAtBooking tất cả items.
currency       — Tiền tệ của reservation.
ticketCount    — Tổng số vé trong reservation này. Denormalized từ số ReservationItems.
expiresAt      — Deadline hoàn thành payment. Mặc định = createdAt + 15 phút.
               Khi initiate payment, được extend thêm 30 phút.
confirmedAt    — Khi nào payment confirmed. Null nếu chưa.
cancelledAt    — Khi nào bị cancel. Null nếu chưa.
couponId       — FK đến coupon nếu user đã apply. Null = không dùng coupon.
discountAmount — Số tiền giảm bởi coupon. 0 nếu không có coupon.
               finalAmount = totalAmount - discountAmount.
```

---

### Model `ReservationItem` — Bảng `reservation_items`

```
reservationId  — FK đến reservation cha. CASCADE delete (xóa reservation → xóa tất cả items).
seatId         — FK đến ghế cụ thể. Nullable cho ZONE/GA tier không có ghế đánh số.
tierId         — FK đến tier. Luôn required để biết tier nào.
priceAtBooking — Snapshot giá tại thời điểm đặt. Quan trọng vì dynamic pricing thay đổi liên tục.
               Đây là giá user THỰC SỰ trả, không phải giá hiện tại.
status         — PENDING   → vừa tạo, ghế đang RESERVED
               RESERVED  → (thực ra PENDING và RESERVED giống nhau về trạng thái)
               CONFIRMED → payment thành công, ghế SOLD
               CANCELLED → reservation bị cancel, ghế trả về AVAILABLE
```

---

### Model `Ticket` — Bảng `tickets`

```
ticketCode    — Unique code hiển thị trên vé: "TKT-A1B2C3D4". Unique constraint.
               Format: "TKT-" + 8 random alphanumeric characters.
reservationId — Vé này từ reservation nào.
userId        — Chủ sở hữu vé.
eventId       — Vé cho event nào.
tierId        — Vé loại tier nào (FK).
seatId        — Ghế cụ thể. Nullable nếu tier là ZONE/GA.
qrCodeData    — JSON string dùng để generate QR code:
               {"ticketCode":"TKT-...","eventId":"...","tierId":"...","seatId":"...","ts":1234567890}
               ts = timestamp lúc issue để validate freshness.
status        — VALID     → vé hợp lệ, chưa dùng
               USED      → đã check-in vào event
               CANCELLED → bị hủy (refund hoặc tự cancel)
               EXPIRED   → quá ngày event mà chưa dùng
tierName      — Snapshot tên tier: "VIP". Tier có thể đổi tên sau, vé vẫn hiển thị đúng.
seatLabel     — Snapshot label ghế: "Row A-5". Dùng hiển thị trên vé và check-in UI.
price         — Snapshot giá đã trả. Hiển thị trên vé.
currency      — Tiền tệ.
issuedAt      — Khi nào vé được phát hành (sau khi payment confirmed). Auto = now().
usedAt        — Khi nào vé được scan check-in. Null = chưa dùng.
cancelledAt   — Khi nào vé bị cancel. Null = chưa cancel.
expiresAt     — Vé hết hạn khi nào (thường = endDate của event). Null = không expire.
```

---

### Model `Payment` — Bảng `payments`

```
reservationId        — Payment này cho reservation nào. 1 reservation có thể có nhiều payments
                      (retry sau khi fail).
userId               — Ai thanh toán.
amount               — Số tiền thực tế charge (sau discount). Decimal(10,2).
currency             — Tiền tệ: "USD".
provider             — Provider: "STRIPE", "PAYPAL", "PAYOS".
providerPaymentId    — ID từ phía provider:
                      STRIPE: "pi_3OxxxxxxxxxxxxxY8" (PaymentIntent ID)
                      PAYPAL: "PAYID-..." (Payment ID)
                      PAYOS: order_id
                      Dùng để cross-reference với provider dashboard.
providerClientSecret — STRIPE: "pi_3O...._secret_..." — gửi về frontend để confirm payment.
                      Frontend dùng Stripe SDK + clientSecret để render form và confirm.
                      Sau khi payment done, field này vô dụng nhưng vẫn lưu cho debugging.
status               — PENDING    → vừa tạo, chờ user hoàn thành
                      PROCESSING → đang xử lý (3DS, bank transfer)
                      COMPLETED  → thanh toán thành công
                      FAILED     → thất bại (thẻ từ chối, insufficient funds)
                      REFUNDED   → đã hoàn tiền
failureReason        — Lý do payment thất bại: "insufficient_funds", "card_declined". Null nếu success.
completedAt          — Khi nào payment hoàn thành. Null nếu chưa.
```

---

### Model `Coupon` — Bảng `coupons`

```
code              — Unique code user nhập: "SUMMER20", "VIPFAN50". Uppercase by convention.
description       — Mô tả: "Giảm 20% cho mùa hè". Hiển thị khi validate.
discountType      — PERCENTAGE: giảm theo phần trăm (e.g. 20%)
                   FIXED_AMOUNT: giảm số tiền cố định (e.g. $10)
discountValue     — Giá trị: 20.00 = 20% hoặc 10.00 = $10.
currency          — Tiền tệ nếu FIXED_AMOUNT.
maxUses           — Tổng số lần coupon này được dùng tối đa. Null = unlimited.
currentUses       — Đếm hiện tại. Atomic increment khi apply. Kiểm: currentUses < maxUses.
maxUsesPerUser    — Mỗi user dùng được bao nhiêu lần. Default 1 = dùng 1 lần/user.
minPurchaseAmount — Minimum order để áp dụng coupon. e.g. $50 mới được dùng coupon.
maxDiscountAmount — Cap discount tối đa (áp dụng cho PERCENTAGE).
                   e.g. 30% nhưng max $20: order $100 → giảm $20 (không phải $30).
eventId           — Null = coupon dùng cho tất cả events.
                   Có giá trị = coupon chỉ dùng cho event cụ thể.
validFrom         — Ngày bắt đầu có hiệu lực. Null = dùng ngay.
validUntil        — Ngày hết hạn. Null = không hết hạn.
active            — Admin có thể toggle on/off coupon mà không cần xóa.
createdById       — Admin nào tạo coupon này.
```

---

### Model `EventSchedule` — Bảng `event_schedules`

```
eventId     — Event này thuộc về.
title       — Tiêu đề hoạt động: "Opening Act", "Main Performance", "Fireworks".
description — Mô tả chi tiết.
performer   — Tên người biểu diễn trong slot này: "DJ Opening", "Taylor Swift".
dayNumber   — Ngày thứ mấy của event (cho multi-day festival). 1 = ngày 1, 2 = ngày 2.
startTime   — Giờ bắt đầu của hoạt động.
endTime     — Giờ kết thúc.
sortOrder   — Thứ tự hiển thị trong UI. 0 = đầu tiên.
```

---

### Model `EventMedia` — Bảng `event_media`

```
eventId     — Media thuộc event nào.
mediaType   — IMAGE hoặc VIDEO.
filePath    — Đường dẫn file: "uploads/event-media/uuid.jpg".
             Khi serve: GET /uploads/event-media/uuid.jpg (ServeStaticModule).
fileName    — Tên file gốc user upload: "stage-setup.jpg".
fileSize    — Kích thước file bytes. BigInt vì video có thể > 2GB.
contentType — MIME type: "image/jpeg", "video/mp4".
caption     — Chú thích ảnh/video.
sortOrder   — Thứ tự hiển thị trong gallery. 0 = ảnh đầu tiên.
```

---

### Model `ResaleListing` — Bảng `resale_listings`

```
ticketId           — Vé gốc đang được rao bán. FK đến tickets.
eventId            — Event của vé (denormalized để query marketplace theo event dễ hơn).
sellerId           — User đang bán.
buyerId            — User đã mua (null khi chưa có người mua).
newTicketId        — Vé mới được tạo cho buyer sau khi mua thành công.
                    (Vé cũ của seller bị cancel, vé mới được issue cho buyer)
askingPrice        — Giá người bán muốn bán. Bị giới hạn max 150% originalPrice.
originalPrice      — Giá gốc khi mua vé. Dùng để validate askingPrice ≤ 150%.
currency           — Tiền tệ.
platformFeePercent — Phí nền tảng. Default 5%. Marketplace thu 5% từ giao dịch.
platformFeeAmount  — Số tiền phí: askingPrice × platformFeePercent / 100.
sellerPayout       — Số tiền seller nhận: askingPrice - platformFeeAmount.
status             — LISTED    → đang rao bán, ai cũng thấy
                    LOCKED    → buyer đang trong quá trình mua (10 phút)
                    SOLD      → đã bán thành công
                    CANCELLED → seller hủy listing
                    EXPIRED   → lock timeout mà buyer không mua
lockExpiresAt      — Khi nào lock hết hạn. Null nếu status ≠ LOCKED.
soldAt             — Khi nào bán xong.
cancelledAt        — Khi nào bị hủy.
version            — Optimistic locking chống race condition khi 2 buyers cùng lock.
```

---

### Model `Comment` — Bảng `comments`

```
userId      — User viết comment.
eventId     — Comment về event nào.
content     — Nội dung comment. Text (unlimited length).
rating      — Điểm đánh giá 1-5. Nullable vì comment có thể không có rating (chỉ reply).
badgeType   — Badge hiển thị cạnh tên: "VVIP", "VIP", "ATTENDEE".
             Tự động gán dựa trên tier của vé user đã mua (VIP tier → VIP badge).
badgeLabel  — Label text của badge: "VIP Attendee".
parentId    — FK đến comment cha. Null = top-level comment. Có giá trị = reply.
edited      — true nếu user đã chỉnh sửa comment sau khi post.
```

---

### Model `CheckIn` — Bảng `check_ins`

```
ticketId         — Vé nào được check-in.
eventId          — Event nào (denormalized để query check-ins theo event).
checkedInById    — Staff nào scan vé (FK đến users).
checkInLatitude  — Vị trí GPS khi check-in (latitude). Verify phải ở gần venue.
checkInLongitude — Vị trí GPS khi check-in (longitude).
deviceInfo       — Thiết bị scan: model điện thoại, app version.
successful       — true = check-in thành công, false = thất bại (vé invalid, đã dùng...).
failureReason    — Lý do thất bại: "TICKET_ALREADY_USED", "TICKET_CANCELLED", "WRONG_EVENT".
checkedInAt      — Timestamp chính xác khi check-in.
```

---

### Model `QueueEntry` — Bảng `queue_entries`

```
userId      — User này tham gia hàng đợi.
eventId     — Hàng đợi của event nào.
queueToken  — Token unique để poll vị trí hàng đợi mà không cần auth (share link với friend).
             Unique constraint.
position    — Vị trí trong hàng đợi: 1 = đầu hàng, 101 = vị trí 101.
status      — WAITING   → đang chờ (position > 100)
             ACTIVE    → được phép đặt vé ngay (position ≤ 100 hoặc được promote)
             EXPIRED   → user tự rời hoặc hết thời gian ACTIVE mà không mua
             COMPLETED → đã mua vé thành công, rời hàng đợi
joinedAt    — Khi nào join. Dùng để sort nếu cùng vị trí (thường không xảy ra vì atomic counter).
activatedAt — Khi nào status chuyển sang ACTIVE. Đo thời gian chờ thực tế.
expiresAt   — ACTIVE entries hết hạn sau 10 phút nếu không mua.
completedAt — Khi nào hoàn thành (mua vé xong).
```

---

> **Lưu ý cuối**: Tất cả models đều có `createdAt` (auto = now()) và phần lớn có `updatedAt` (auto update). Đây là audit fields cơ bản — không bao giờ set thủ công, để Prisma tự handle.
