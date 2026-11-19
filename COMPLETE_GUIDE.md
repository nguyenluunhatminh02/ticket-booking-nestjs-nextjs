# 🎫 Ticket Booking System - Complete Guide

## Mục lục

- [1. Kiến trúc hệ thống](#1-kiến-trúc-hệ-thống)
- [2. Yêu cầu hệ thống](#2-yêu-cầu-hệ-thống)
- [3. Cài đặt & Khởi chạy](#3-cài-đặt--khởi-chạy)
- [4. Seed Data & Test Accounts](#4-seed-data--test-accounts)
- [5. API Reference](#5-api-reference)
- [6. Concurrency & Oversell Protection](#6-concurrency--oversell-protection)
- [7. k6 Load Testing Guide](#7-k6-load-testing-guide)
- [8. Machine Learning Integration](#8-machine-learning-integration)
- [9. Troubleshooting](#9-troubleshooting)

---

## 1. Kiến trúc hệ thống

```
┌───────────────────┐    ┌──────────────────────┐    ┌─────────────────┐
│   Next.js 15      │    │   NestJS 11 API      │    │  PostgreSQL     │
│   (Frontend)      │───▶│   localhost:3001      │───▶│  (Prisma)       │
│   localhost:3000   │    │   /api/v1/*           │    │  ticket_booking │
│                   │    │                      │    └─────────────────┘
│ React 18          │    │ JWT + Passport       │            │
│ TanStack Query    │    │ Socket.IO WebSocket  │    ┌─────────────────┐
│ Zustand           │    │ Swagger /api/docs    │───▶│  Redis           │
│ Stripe.js         │    │ Throttler            │    │  Seat Locks      │
│ Socket.IO Client  │    │ Cron Jobs            │    │  Token Blacklist │
│ Shadcn UI         │    │                      │    │  Refresh Tokens  │
└───────────────────┘    └──────────────────────┘    └─────────────────┘
                                   │
                          ┌────────┴────────┐
                          │  Stripe API     │
                          │  Mux (Stream)   │
                          │  SMTP (Email)   │
                          └─────────────────┘
```

### Module Backend

| Module | Chức năng |
|--------|-----------|
| **AuthModule** | Đăng ký, đăng nhập, MFA (TOTP), OAuth2 (Google/GitHub), JWT, Device management |
| **BookingModule** | Events, Reservations, Payments, Tickets, Queue, Seats, Coupons, Resale, CheckIn |

### Entities chính

| Entity | Mô tả |
|--------|-------|
| User | Người dùng, hỗ trợ RBAC, MFA, multi-device |
| Event | Sự kiện với status lifecycle (DRAFT → ON_SALE → SOLD_OUT) |
| TicketTier | Hạng vé (VIP, Regular...) với dynamic pricing |
| Seat | Ghế ngồi, @VersionColumn cho optimistic locking |
| Reservation | Đặt vé, TTL 15 phút, SERIALIZABLE transaction |
| Ticket | Vé đã phát hành, QR code, Dynamic TOTP QR |
| Payment | Thanh toán Stripe/PayPal/PayOS |

---

## 2. Yêu cầu hệ thống

### Required

| Tool | Version | Mục đích |
|------|---------|----------|
| Node.js | >= 18.x | Runtime |
| PostgreSQL | >= 14 | Database chính |
| Redis | >= 6 | Seat locks, token cache |
| npm/yarn | Latest | Package manager |

### Optional

| Tool | Version | Mục đích |
|------|---------|----------|
| k6 | >= 0.47 | Load testing |
| Docker | Latest | Container deployment |
| Stripe CLI | Latest | Webhook testing |

---

## 3. Cài đặt & Khởi chạy

### 3.1 Backend (NestJS)

```bash
# 1. Clone & install
cd ticket-booking-nestjs
npm install

# 2. Tạo file .env
cp .env.example .env
```

**File `.env` cần thiết:**

```env
# ── Server ──
APP_PORT=3001
CORS_ORIGINS=http://localhost:3000

# ── Database ──
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ticket_booking
DB_USERNAME=postgres
DB_PASSWORD=your_password
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/ticket_booking

# ── Redis ──
REDIS_HOST=localhost
REDIS_PORT=6379

# ── JWT ──
JWT_SECRET=your-super-secret-key-change-in-production
JWT_ACCESS_TOKEN_EXPIRATION=900000
JWT_REFRESH_TOKEN_EXPIRATION=604800000

# ── Rate Limiting ──
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100

# ── Email (MailHog for dev) ──
MAIL_HOST=localhost
MAIL_PORT=1025
MAIL_USER=
MAIL_PASS=
MAIL_FROM=noreply@ticketbooking.com

# ── Stripe ──
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# ── OAuth2 ──
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx

# ── Mux (Livestream) ──
MUX_TOKEN_ID=xxx
MUX_TOKEN_SECRET=xxx
```

```bash
# 3. Tạo database PostgreSQL
psql -U postgres -c "CREATE DATABASE ticket_booking;"

# 4. Chạy backend
npm run start:dev
# → Server chạy tại http://localhost:3001
# → Swagger docs tại http://localhost:3001/api/docs
```

### 3.2 Frontend (Next.js)

```bash
cd ticket-frontend-nestjs
npm install

# Tạo .env.local
cp .env.example .env.local
# Điền NEXT_PUBLIC_API_URL, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
# NEXT_PUBLIC_MAPBOX_TOKEN, NEXT_PUBLIC_OAUTH2_BASE_URL,
# JWT_SECRET (phải trùng JWT_SECRET của backend)

# Chạy frontend (không Turbopack)
npm run dev
# → http://localhost:3000
```

### 3.3 Verify Setup

```bash
# Check backend health
curl http://localhost:3001/api/v1/events

# Check frontend
# Mở Chrome: http://localhost:3000
```

---

## 4. Seed Data & Test Accounts

### 4.1 Quick Seed (Manual)

```bash
# 1. Đăng ký admin user qua API
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Admin",
    "lastName": "User",
    "email": "admin@test.com",
    "password": "Password123!",
    "confirmPassword": "Password123!"
  }'

# 2. Verify email trực tiếp qua DB (bypass email)
psql -U postgres -d ticket_booking -c \
  "UPDATE users SET email_verified = true, email_verified_at = NOW() WHERE email = 'admin@test.com';"

# 3. Login và lấy token
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "Password123!",
    "deviceId": "dev-001",
    "deviceName": "Dev Machine",
    "deviceType": "DESKTOP"
  }'
# → Lưu accessToken

# 4. Tạo Venue
curl -X POST http://localhost:3001/api/v1/venues \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -d '{
    "name": "Nhà hát Lớn Hà Nội",
    "city": "Hà Nội",
    "country": "Vietnam",
    "capacity": 500
  }'

# 5. Tạo Event
curl -X POST http://localhost:3001/api/v1/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -d '{
    "venueId": "<VENUE_ID>",
    "name": "Đêm nhạc Sơn Tùng MTP",
    "description": "Concert đỉnh cao",
    "category": "CONCERT",
    "eventDate": "2026-06-15T19:00:00.000Z",
    "maxTicketsPerUser": 4,
    "queueEnabled": false
  }'

# 6. Thêm Ticket Tier (auto-gen seats)
curl -X POST http://localhost:3001/api/v1/events/<EVENT_ID>/tiers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -d '{
    "name": "VIP",
    "price": 2000000,
    "currency": "VND",
    "totalQuantity": 100
  }'

# 7. Publish event
curl -X POST http://localhost:3001/api/v1/events/<EVENT_ID>/publish \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### 4.2 Automated Seed (k6 Setup Script)

```bash
# Tạo 50 users + 1 admin + event với 20 seats
node k6-setup.js --users 50 --seats 20

# Tạo 200 users cho stress test
node k6-setup.js --users 200 --seats 20

# Cleanup test data
node k6-setup.js --cleanup
```

**Output: `k6-test-data.json`**
```json
{
  "users": [
    { "email": "k6_user0@test.com", "token": "eyJhbG...", "userId": "uuid" },
    { "email": "k6_user1@test.com", "token": "eyJhbG...", "userId": "uuid" }
  ],
  "adminToken": "eyJhbG...",
  "eventId": "uuid-event",
  "tierId": "uuid-tier",
  "venueId": "uuid-venue"
}
```

### 4.3 Test Accounts

| Email | Password | Role | Ghi chú |
|-------|----------|------|---------|
| `admin@test.com` | `Password123!` | Admin | Cần verify email qua DB |
| `k6_admin@test.com` | `Password123!` | Admin | Tạo bởi k6-setup.js |
| `k6_user0@test.com` → `k6_user49@test.com` | `Password123!` | User | Auto-verified |
| `user@test.com` | `Password123!` | User | Manual testing |

### 4.4 Database Connection

```bash
# PostgreSQL
psql -U postgres -d ticket_booking

# Hoặc dùng pgAdmin / DBeaver / DataGrip
Host:     localhost
Port:     5432
Database: ticket_booking
Username: postgres        (hoặc auth_user)
Password: your_password   (hoặc auth_password)
```

### 4.5 Useful DB Queries

```sql
-- Xem tất cả users
SELECT id, email, email_verified, first_name FROM users;

-- Verify email manual
UPDATE users SET email_verified = true, email_verified_at = NOW()
WHERE email = 'your@email.com';

-- Xem events
SELECT id, name, status, total_tickets, available_tickets FROM events;

-- Xem seats của event
SELECT section, row_name, seat_number, status FROM seats
WHERE event_id = 'xxx' ORDER BY row_name, seat_number;

-- Đếm seats theo trạng thái
SELECT status, COUNT(*) FROM seats WHERE event_id = 'xxx' GROUP BY status;

-- Xem reservations
SELECT r.id, u.email, r.status, r.ticket_count, r.total_amount, r.expires_at
FROM reservations r JOIN users u ON r.user_id = u.id
WHERE r.event_id = 'xxx' ORDER BY r.created_at DESC;

-- Kiểm tra oversell
SELECT 
  e.name,
  e.total_tickets,
  e.available_tickets,
  (SELECT COUNT(*) FROM seats WHERE event_id = e.id AND status = 'SOLD') as sold_seats,
  (SELECT COUNT(*) FROM seats WHERE event_id = e.id AND status = 'RESERVED') as reserved_seats,
  (SELECT COUNT(*) FROM seats WHERE event_id = e.id AND status = 'AVAILABLE') as available_seats
FROM events e WHERE e.id = 'xxx';
```

---

## 5. API Reference

### Authentication

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST | `/auth/register` | No | Đăng ký |
| POST | `/auth/login` | No | Đăng nhập (+ MFA check) |
| POST | `/auth/verify-mfa` | No | Xác thực TOTP |
| POST | `/auth/refresh-token` | No | Refresh JWT |
| POST | `/auth/logout` | Yes | Đăng xuất |
| POST | `/auth/logout-all` | Yes | Đăng xuất mọi thiết bị |
| GET | `/auth/verify-email?token=` | No | Verify email |
| POST | `/auth/forgot-password` | No | Yêu cầu reset password |
| POST | `/auth/reset-password` | No | Reset password |
| POST | `/auth/change-password` | Yes | Đổi password |
| GET | `/users/me` | Yes | Profile hiện tại |
| PUT | `/users/me` | Yes | Cập nhật profile |

### Events

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET | `/events` | No | Liệt kê events (paginated) |
| GET | `/events/:id` | No | Chi tiết event |
| GET | `/events/search?q=` | No | Tìm kiếm |
| GET | `/events/:id/seats` | No | Seat map |
| POST | `/events` | Yes | Tạo event (admin) |
| POST | `/events/:id/publish` | Yes | Publish event |
| POST | `/events/:id/cancel` | Yes | Hủy event |
| POST | `/events/:id/tiers` | Yes | Thêm ticket tier |

### Bookings

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST | `/bookings/reserve` | Yes | Đặt vé |
| GET | `/bookings` | Yes | Danh sách reservations |
| GET | `/bookings/:id` | Yes | Chi tiết reservation |
| POST | `/bookings/:id/cancel` | Yes | Hủy reservation |

### Payments

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST | `/payments/initiate` | Yes | Bắt đầu thanh toán |
| GET | `/payments/status/:reservationId` | Yes | Trạng thái payment |
| GET | `/payments/providers` | Yes | Danh sách payment providers |
| POST | `/payments/refund/:reservationId` | Yes | Hoàn tiền |

### Tickets

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET | `/tickets/my` | Yes | Vé của tôi |
| GET | `/tickets/:code` | Yes | Chi tiết vé |
| GET | `/tickets/:code/qr` | Yes | QR code image |
| GET | `/tickets/:code/dynamic-qr` | Yes | Dynamic TOTP QR (30s) |
| POST | `/tickets/:code/cancel` | Yes | Hủy vé |

### Queue / Coupon / Resale / CheckIn

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST | `/queue/join/:eventId` | Yes | Tham gia hàng đợi |
| GET | `/queue/position/:token` | Yes | Xem vị trí |
| POST | `/coupons/validate` | Yes | Validate mã giảm giá |
| POST | `/coupons/apply` | Yes | Áp dụng coupon |
| POST | `/resale/list` | Yes | Đăng bán lại vé |
| GET | `/resale/listings` | No | Xem vé bán lại |
| POST | `/check-in/scan` | Yes | Scan QR tại venue |

---

## 6. Concurrency & Oversell Protection

Hệ thống sử dụng **3 lớp bảo vệ** chống oversell:

### Layer 1: Redis Seat Lock (Tạm thời)
```
User chọn ghế → Redis SET seat:lock:{eventId}:{seatId} = userId (TTL 5 min)
→ WebSocket broadcast đến tất cả user đang xem seat map
→ Ngăn 2 user chọn cùng 1 ghế trước khi submit
```

### Layer 2: SERIALIZABLE Transaction (PostgreSQL)
```typescript
// reservation.service.ts
this.prisma.$transaction(async (tx) => {
  // 1. Pessimistic lock: SELECT ... FOR UPDATE trên event + tier
  const [tier] = await tx.$queryRaw`
    SELECT * FROM ticket_tiers WHERE id = ${dto.tierId}::uuid FOR UPDATE
  `;

  // 2. Check availability
  if (tier.available_quantity < quantity) {
    throw new ConflictException('Not enough tickets');
  }

  // 3. Lock seats FOR UPDATE (GA auto-select hoặc specific seats)
  const seats = await tx.$queryRaw`
    SELECT * FROM seats
    WHERE event_id = ${dto.eventId}::uuid AND status = 'AVAILABLE'
    LIMIT ${quantity} FOR UPDATE
  `;

  // 4. Atomic decrement (không dùng read-modify-write)
  await tx.ticketTier.update({
    where: { id: tier.id },
    data: { availableQuantity: { decrement: seats.length } },
  });

  // 5. Auto SOLD_OUT khi hết vé
  if (updatedEvent.availableTickets <= 0) {
    await tx.event.update({ where: { id: dto.eventId }, data: { status: EventStatus.SOLD_OUT } });
  }
}, { isolationLevel: 'Serializable' });
```

### Layer 3: Version column (Optimistic Locking)
```prisma
// schema.prisma — ResaleListing
version Int @default(0)
// Tăng thủ công trong transaction; conflict → retry
```

### Layer 4: Cron Cleanup (15-min TTL)
```typescript
@Cron(CronExpression.EVERY_MINUTE)
async cleanupExpiredReservations() {
  // Release PENDING reservations expired > 15min
  // → Giải phóng seats bị "kẹt"
}
```

---

## 7. k6 Load Testing Guide

### 7.1 Cài đặt k6

```bash
# Windows (choco)
choco install k6

# Windows (winget)
winget install grafana.k6

# macOS
brew install k6

# Verify
k6 version
```

### 7.2 Setup Test Data

```bash
cd ticket-booking-nestjs

# Đảm bảo backend đang chạy
npm run start:dev

# Setup 200 users + event với 20 seats cho oversell test
node k6-setup.js --users 200 --seats 20
```

### 7.3 Chạy Test

#### Test cơ bản (đã có sẵn)
```bash
# Full multi-scenario test
k6 run k6-load-test.js

# Chỉ oversell test
k6 run k6-load-test.js --env SCENARIO=oversell_test

# Spike test (flash sale)
k6 run k6-load-test.js --env SCENARIO=spike

# Endurance test (5 phút)
k6 run k6-load-test.js --env SCENARIO=endurance
```

#### Oversell Stress Test (mới - nâng cao)
```bash
# Blitz attack: 200 VUs × 400 iterations cùng mua 20 vé
k6 run k6-oversell-stress-test.js

# Custom VUs
k6 run k6-oversell-stress-test.js --env VUS=300 --env ITERATIONS=500

# Flash sale simulation
k6 run k6-oversell-stress-test.js --env SCENARIO=spike_sale

# Thundering herd (worst case)
k6 run k6-oversell-stress-test.js --env SCENARIO=thundering_herd

# Endurance (5 phút liên tục)
k6 run k6-oversell-stress-test.js --env SCENARIO=endurance

# Mixed (read + write + verify integrity)
k6 run k6-oversell-stress-test.js --env SCENARIO=mixed
```

### 7.4 Đọc kết quả

```
✓ oversell_detected........: 0      ← PHẢI = 0 (không oversell)
✓ duplicate_seat...........: 0      ← PHẢI = 0
✓ capacity_exceeded........: 0      ← PHẢI = 0
  reservation_success......: 20     ← Đúng = số seats (20)
  reservation_conflict.....: 380    ← Expected: 400 - 20 = 380
  reservation_error........: 0      ← PHẢI = 0
  reservation_duration.....: p(95)=2500ms
  success_rate.............: 100%   ← 409 cũng tính success
  error_rate...............: 0%
```

### 7.5 Cleanup

```bash
# Xóa tất cả test data
node k6-setup.js --cleanup
```

---

## 8. Machine Learning Integration

### 8.1 Tổng quan ML đã tích hợp

Hệ thống đã tích hợp 3 module ML chính:

| Module | Mô tả | File |
|--------|-------|------|
| **Smart Seat Recommendation** | Đề xuất ghế tốt nhất dựa trên vị trí trung tâm | `smart-seat.service.ts` + ML nâng cấp |
| **Dynamic Pricing Engine** | Giá vé thay đổi theo demand/supply/time | `smart-seat.service.ts` + ML nâng cấp |
| **Fraud Detection** | Phát hiện giao dịch bất thường | `ml/fraud-detection.service.ts` (mới) |
| **Demand Forecasting** | Dự đoán lượng mua để scale hạ tầng | `ml/demand-forecast.service.ts` (mới) |

### 8.2 Chi tiết từng module

#### A. Smart Seat Recommendation (ML-Enhanced)

**Trước:** Chỉ dựa trên khoảng cách đến trung tâm hàng ghế.

**Sau (ML):** Multi-factor scoring bao gồm:
- Khoảng cách đến trung tâm sân khấu (30%)
- Lịch sử preferences của user (25%)
- Phân tích heatmap ghế phổ biến (20%)
- Giá trị giá/chất lượng tối ưu (15%)
- Khoảng cách đến exit/restroom (10%)

#### B. Dynamic Pricing Engine (ML-Enhanced)

**Trước:** Rule-based: <30% sold → 0.85x, >80% → 1.3x, >90% → 1.5x

**Sau (ML):** Time-series regression model:
- Velocity of sales (tốc độ bán vé)
- Time to event (thời gian còn lại)
- Historical demand patterns
- Day of week / seasonality
- Competitor pricing signals
- Social media buzz metrics

#### C. Fraud Detection (Mới)

Phát hiện hành vi bất thường:
- Mua hàng loạt từ cùng IP/device
- Velocity check: mua quá nhanh
- Credit card fingerprinting
- Bot detection pattern
- Resale scalper identification

#### D. Demand Forecasting (Mới)

Dự đoán lượng traffic để auto-scale:
- Predict peak booking windows
- Queue length estimation
- Server capacity planning
- Marketing campaign impact prediction

---

## 9. Troubleshooting

### Lỗi thường gặp

| Lỗi | Nguyên nhân | Fix |
|-----|-------------|-----|
| `ECONNREFUSED :5432` | PostgreSQL chưa chạy | `net start postgresql-x64-14` |
| `ECONNREFUSED :6379` | Redis chưa chạy | `redis-server` hoặc Docker |
| `401 Unauthorized` | Token hết hạn | Login lại hoặc refresh token |
| `Email not verified` | Chưa verify email | Chạy SQL UPDATE ở mục 4.5 |
| `Event not on sale` | Event chưa publish | POST `/events/:id/publish` |
| `Not enough tickets` | Hết vé (expected) | Tạo event mới hoặc cancel reservations |
| `Maximum N tickets per user` | Giới hạn per-user | Dùng user khác |

### Redis Issues

```bash
# Check Redis running
redis-cli ping
# → PONG

# Xem seat locks
redis-cli keys "seat:lock:*"

# Xóa tất cả seat locks
redis-cli keys "seat:lock:*" | xargs redis-cli del

# Xem refresh tokens
redis-cli keys "refresh:*"
```

### Database Reset

```bash
# Drop & recreate database
psql -U postgres -c "DROP DATABASE ticket_booking;"
psql -U postgres -c "CREATE DATABASE ticket_booking;"

# Restart backend (auto-sync sẽ recreate tables)
npm run start:dev
```
