# BOOKING & PAYMENT SYSTEM - COMPLETE DOCUMENTATION
## Ticket Booking Platform (NestJS Backend + Next.js Frontend)

> **Tài liệu chi tiết về toàn bộ hệ thống Booking & Payment** — phân tích từ Frontend → Backend → Database  
> Ngày test: 23/03/2026 | Tester: Manual Browser Testing (Chrome)

---

## MỤC LỤC

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Database Schema (Prisma/PostgreSQL)](#2-database-schema)
3. [Luồng Booking chi tiết](#3-luồng-booking-chi-tiết)
4. [Luồng Payment chi tiết](#4-luồng-payment-chi-tiết)
5. [API Endpoints chi tiết](#5-api-endpoints-chi-tiết)
6. [Backend Services & Business Logic](#6-backend-services--business-logic)
7. [Frontend Pages & Components](#7-frontend-pages--components)
8. [Hệ thống phụ trợ](#8-hệ-thống-phụ-trợ)
9. [Kết quả Test thực tế](#9-kết-quả-test-thực-tế)

---

## 1. TỔNG QUAN KIẾN TRÚC

```
┌──────────────────────┐     ┌──────────────────────────┐     ┌───────────────┐
│  Next.js Frontend    │────▶│  NestJS Backend           │────▶│  PostgreSQL   │
│  (Port 3000)         │     │  (Port 3001)              │     │ (ticket_booking) │
│                      │     │  /api/v1/...              │     │               │
│  - React Query       │     │  - Prisma ORM             │     │  26 tables    │
│  - Zustand Store     │     │  - JWT Auth               │     │  16 enums     │
│  - Socket.IO Client  │     │  - Stripe SDK             │     └───────────────┘
│  - Stripe Elements   │     │  - Socket.IO Server       │               │
│  - Mapbox GL         │     │  - Cron Jobs              │     ┌───────────────┐
│  - Mux Player        │     │  - Multer (uploads)       │────▶│  Redis        │
└──────────────────────┘     └──────────────────────────┘     │  (Seat Locks) │
                                       │                       └───────────────┘
                              ┌────────────────┐
                              │  ML Service    │
                              │  (FastAPI:8000)│
                              │  - Fraud       │
                              │  - Demand      │
                              │  - Pricing     │
                              └────────────────┘
```

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 18, TypeScript, TailwindCSS, shadcn/ui |
| State | Zustand (auth), TanStack React Query (server data) |
| Realtime | Socket.IO (seat locking WebSocket) |
| Backend | NestJS, TypeScript, Prisma ORM |
| Database | PostgreSQL (26 models, 16 enums) |
| Cache | Redis (seat locks, 5-min TTL) |
| Payment | Stripe (Payment Intents API) |
| Media | Mux (livestream), Mapbox (venue maps) |
| ML | FastAPI Python service (fraud, demand, pricing) |

---

## 2. DATABASE SCHEMA

### 2.1 Booking Domain - Core Models

#### **Event** (`events`)
```
id              UUID (PK)
venue_id        UUID → venues
created_by      UUID → users  
organizer_id    UUID → organizers
name            String
description     Text
artist_name     String
category        EventCategory (CONCERT|SPORTS|THEATER|COMEDY|FESTIVAL|CONFERENCE|OTHER)
event_date      Timestamptz
doors_open_at   Timestamptz
status          EventStatus (DRAFT|PUBLISHED|ON_SALE|PRESALE|SOLD_OUT|CANCELLED|COMPLETED)
cover_image_url String
total_tickets   Int
available_tickets Int        ← Atomic decrement/increment khi reserve/cancel
on_sale_at      Timestamptz
presale_at      Timestamptz
max_tickets_per_user Int     ← Giới hạn vé/user
queue_enabled   Boolean      ← Bật hàng đợi
event_mode      EventMode (OFFLINE|ONLINE|HYBRID)
streaming_url   String
mux_playback_id String       ← Mux video playback
mux_asset_id    String       ← Mux video asset
banner_url      String
end_date        Timestamptz
```

#### **TicketTier** (`ticket_tiers`)
```
id                    UUID (PK)
event_id              UUID → events
name                  String (VIP, Premium, General Admission, Economy)
description           Text
price                 Decimal(10,2)    ← Giá gốc
currency              String (default: "USD")
total_quantity        Int
available_quantity    Int              ← Atomic decrement/increment
max_per_user          Int
sort_order            Int
pricing_phase         PricingPhase (EARLY_BIRD|REGULAR|LAST_MINUTE)
early_bird_price      Decimal(10,2)
last_minute_price     Decimal(10,2)
early_bird_end_date   Timestamptz
last_minute_start_date Timestamptz
group_min_quantity    Int              ← Mua nhóm tối thiểu
group_discount_percent Decimal(5,2)
tier_type             TierType (ASSIGNED|ZONE|GA)
zone_name             String
zone_capacity         Int
version               Int (default: 0)  ← Optimistic locking
```

#### **Seat** (`seats`)
```
id              UUID (PK)
venue_id        UUID → venues
event_id        UUID → events
tier_id         UUID → ticket_tiers
section         String (VIP Section, Front Section-A, Back Section-A, ...)
row_name        String (Row 1, Row 2, ...)
seat_number     Int
status          SeatStatus (AVAILABLE|RESERVED|SOLD|BLOCKED)
price_override  Decimal(10,2)
version         Int (default: 0)  ← Optimistic locking
```

#### **Reservation** (`reservations`)
```
id              UUID (PK)
user_id         UUID → users
event_id        UUID → events
status          ReservationStatus (PENDING|CONFIRMED|EXPIRED|CANCELLED)
total_amount    Decimal(10,2)
currency        String
ticket_count    Int
expires_at      Timestamptz  ← 15 phút từ lúc đặt
confirmed_at    Timestamptz
cancelled_at    Timestamptz
coupon_id       UUID → coupons (nullable)
discount_amount Decimal(10,2) (default: 0)
```

#### **ReservationItem** (`reservation_items`)
```
id              UUID (PK)
reservation_id  UUID → reservations (CASCADE)
seat_id         UUID → seats (nullable)
tier_id         UUID → ticket_tiers
price_at_booking Decimal(10,2)  ← Snapshot giá tại thời điểm đặt
status          ReservationItemStatus (PENDING|RESERVED|CONFIRMED|CANCELLED)
```

#### **Ticket** (`tickets`)
```
id              UUID (PK)
ticket_code     String (UNIQUE) - Format: "TKT-XXXXXXXX"
reservation_id  UUID → reservations
user_id         UUID → users
event_id        UUID → events
tier_id         UUID → ticket_tiers
seat_id         UUID → seats (nullable)
qr_code_data    Text (JSON: {ticketCode, eventId, tierId, seatId, ts})
status          TicketStatus (VALID|USED|CANCELLED|EXPIRED)
tier_name       String (snapshot)
seat_label      String (snapshot, e.g. "Row1-5")
price           Decimal(10,2) (snapshot)
currency        String
issued_at       Timestamptz
used_at         Timestamptz
cancelled_at    Timestamptz
expires_at      Timestamptz
```

#### **Payment** (`payments`)
```
id                      UUID (PK)
reservation_id          UUID → reservations
user_id                 UUID → users
amount                  Decimal(10,2)
currency                String
provider                String (STRIPE|PAYPAL|PAYOS)
provider_payment_id     String  ← Stripe PaymentIntent ID
provider_client_secret  String  ← Stripe client secret cho frontend
status                  PaymentStatus (PENDING|PROCESSING|COMPLETED|FAILED|REFUNDED)
failure_reason          String
completed_at            Timestamptz
```

#### **Coupon** (`coupons`)
```
id                  UUID (PK)
code                String (UNIQUE, uppercase)
description         Text
discount_type       DiscountType (PERCENTAGE|FIXED_AMOUNT)
discount_value      Decimal(10,2)
currency            String
max_uses            Int              ← Tổng số lần sử dụng tối đa
current_uses        Int (default: 0) ← Atomic increment
max_uses_per_user   Int (default: 1)
min_purchase_amount Decimal(10,2)
max_discount_amount Decimal(10,2)
event_id            UUID → events (nullable, coupon cho event cụ thể)
valid_from          Timestamptz
valid_until         Timestamptz
active              Boolean (default: true)
created_by          UUID → users
```

### 2.2 Auxiliary Models

| Model | Table | Mô tả |
|-------|-------|--------|
| **Venue** | `venues` | Địa điểm tổ chức (name, city, country, capacity, lat/lng, seat_map_config) |
| **Organizer** | `organizers` | Ban tổ chức (name, follower_count, verified) |
| **OrganizerFollower** | `organizer_followers` | User follow Organizer (unique userId+organizerId) |
| **QueueEntry** | `queue_entries` | Hàng đợi (position, status WAITING/ACTIVE/EXPIRED/COMPLETED) |
| **CheckIn** | `check_ins` | Check-in vé (ticketId, lat/lng, deviceInfo, successful) |
| **ResaleListing** | `resale_listings` | Bán lại vé (askingPrice max 150%, platformFee 5%, lock 10 phút) |
| **Comment** | `comments` | Bình luận event (rating 1-5, badgeType VVIP/VIP/ATTENDEE, nested replies) |
| **EventSchedule** | `event_schedules` | Lịch trình event (multi-day, performer, startTime/endTime) |
| **EventMedia** | `event_media` | Ảnh/Video event (IMAGE/VIDEO, filePath, caption) |

### 2.3 Tất cả Enums

```
EventCategory:     CONCERT | SPORTS | THEATER | COMEDY | FESTIVAL | CONFERENCE | OTHER
EventStatus:       DRAFT | PUBLISHED | ON_SALE | PRESALE | SOLD_OUT | CANCELLED | COMPLETED
EventMode:         OFFLINE | ONLINE | HYBRID
TicketStatus:      VALID | USED | CANCELLED | EXPIRED
ReservationStatus: PENDING | CONFIRMED | EXPIRED | CANCELLED
ReservationItemStatus: PENDING | RESERVED | CONFIRMED | CANCELLED
SeatStatus:        AVAILABLE | RESERVED | SOLD | BLOCKED
PaymentStatus:     PENDING | PROCESSING | COMPLETED | FAILED | REFUNDED
PaymentProvider:   STRIPE | PAYPAL | PAYOS
DiscountType:      PERCENTAGE | FIXED_AMOUNT
PricingPhase:      EARLY_BIRD | REGULAR | LAST_MINUTE
TierType:          ASSIGNED | ZONE | GA
QueueStatus:       WAITING | ACTIVE | EXPIRED | COMPLETED
ResaleStatus:      LISTED | LOCKED | SOLD | CANCELLED | EXPIRED
MediaType:         IMAGE | VIDEO
```

---

## 3. LUỒNG BOOKING CHI TIẾT

### 3.1 Tổng quan Flow

```
[1. Discovery]  →  [2. Event Detail]  →  [3. Tier Selection]  →  [4. Seat Selection]
     │                    │                       │                       │
  /events              /events/:id            Click tier card      Seat Map / AI suggest
     │                    │                       │                       │
  GET /events     GET /events/:id          WebSocket lock-seat    useSeatSuggestions()
                  GET /events/:id/seats                                  │
                                                                         ▼
[5. Queue (optional)]  →  [6. Reserve]  →  [7. Checkout]  →  [8. Payment]  →  [9. Ticket]
         │                      │                │                 │              │
  POST /queue/join     POST /bookings/    /reservations/:id  POST /payments/  /tickets
  GET /queue/position    /reserve            Coupon apply      /initiate     GET /tickets/my
                           │                    │              Stripe SDK      QR codes
                      Navigate to          POST /coupons/     Webhook          Dynamic QR
                      /reservations/:id      /apply           confirm
```

### 3.2 Bước 1: Discovery - Tìm sự kiện

**Frontend**: `/events` page
- Gọi API: `GET /events?page=0&size=20&status=ON_SALE,PRESALE`
- Hiển thị: Event cards với tên, venue, ngày, số vé, giá từ
- Lọc: Category (Concert, Sports, Theater...), Search by name/artist/venue
- Map view: Hiển thị vị trí venue trên bản đồ

**Backend**: `EventController.listEvents()` → `EventService.listEvents()`
```typescript
// Lọc events theo status, category, city, dateRange
// Include: venue, ticketTiers, organizer, schedules
// Order by: eventDate ASC
// Chỉ trả về events có status ON_SALE hoặc PRESALE
```

### 3.3 Bước 2: Event Detail - Xem chi tiết sự kiện

**Frontend**: `/events/[eventId]` page
- Gọi APIs:
  - `GET /events/:id` → Event info + tiers + schedules
  - `GET /events/:id/seats` → Seat map (grouped by section)
  - `GET /smart-seats/pricing/event/:id` → Dynamic pricing cho tất cả tiers
  - WebSocket `join-event` → Nhận seat locks real-time

**Backend**: `EventService.getEvent()` + `EventService.getSeatMap()`
```typescript
// getEvent: Include venue, ticketTiers (with effectivePrice), schedules, media, organizer
// getSeatMap: Group seats by section → SeatMapResponseDto {
//   sections: Record<string, SeatResponseDto[]>,
//   totalSeats, availableSeats
// }
```

**Hiển thị trên Frontend**:
- Event header: Tên, category badge, status badge, venue, date, available tickets, max per user
- Mô tả sự kiện
- Venue Map (Mapbox GL với marker + popup)
- Select Ticket Tier: Cards cho mỗi tier (giá, dynamic price, stock bar, mô tả)
- Seat Map: 2D stadium SVG + 3D WebGL toggle
- Smart Seat Suggestions: AI gợi ý ghế tốt nhất
- Comments section

### 3.4 Bước 3: Chọn Tier & Ghế

**Frontend Logic**:
1. User click vào tier card → Tier được highlight (border xanh + checkmark)
2. Smart Seat Suggestions tự động hiện lên:
   - Gọi: `GET /smart-seats/suggest/:eventId?quantity=1&tierId=xxx`
   - Hiển thị top 5 ghế được AI đề xuất với score (0-100)
3. Dynamic pricing hiển thị:
   - Gọi: `GET /smart-seats/pricing/event/:eventId`
   - Hiển thị discount % và giá thực tế (multiplier 0.7-2.0)
4. Quantity selector xuất hiện (+/- buttons)
5. Sticky bottom bar: "X ticket(s) · TierName - $Total USD | Reserve Tickets"

**Backend - SmartSeatService.findBestSeats()**:
```typescript
// Multi-factor scoring (tổng 100 điểm):
// - Center preference: 30% (ghế ở giữa row → điểm cao)
// - Row preference: 25% (row 1 = gần sân khấu → điểm cao)
// - Adjacency: 15% (gần ghế đã bán → social proof)
// - Value: 15% (price vs average)
// - Aisle access: 15% (ghế gần lối đi)
```

**Backend - SmartSeatService.getDynamicPrice()**:
```typescript
// Dynamic pricing factors:
// - Fill rate (35%): Tỉ lệ ghế đã bán → giá cao hơn khi gần sold out
// - Velocity (30%): Tốc độ bán → bán nhanh = giá tăng
// - Time to event (25%): Gần ngày diễn → giá tăng
// - Category (10%): CONCERT/FESTIVAL có multiplier cao hơn
// Multiplier bounds: 0.7 (giảm 30%) đến 2.0 (tăng 100%)
```

### 3.5 Bước 4: WebSocket Seat Locking (Real-time)

**Frontend**: `useSeatWebSocket()` hook
```typescript
// Connect: ws://localhost:3001/ws (auth: Bearer token)
// Emit 'join-event': { eventId, userId } → Join room event:{eventId}
// Emit 'lock-seat': { eventId, seatId, userId } → Lock ghế 5 phút
// Emit 'unlock-seat': { eventId, seatId, userId } → Unlock ghế
// Listen 'seat-update': { type: SEAT_LOCKED|SEAT_UNLOCKED, seatId, userId }
// Listen 'seat-error': { message } (ghế đã bị lock bởi user khác)
```

**Backend**: `SeatGateway` + `SeatLockService`
```typescript
// SeatLockService dùng Redis:
// - lockSeat(): SET seat:{eventId}:{seatId} = userId, NX (only if not exists), EX 300s
// - Per-user limit: Max 10 locked seats cùng lúc  
// - unlockSeat(): ONLY owner mới unlock được (so sánh userId)
// - handleDisconnect(): Release tất cả locks của user khi disconnect
// - Broadcast seat-update tới tất cả clients trong room
```

### 3.6 Bước 5: Queue Management (tùy chọn)

**Khi event.queueEnabled = true**:

**Frontend**:
1. Hiển thị "Join Queue" button thay vì booking trực tiếp
2. Gọi: `POST /queue/join/:eventId` → Nhận queueToken
3. Poll: `GET /queue/position/:queueToken` mỗi 3 giây
4. Hiển thị: Position, Total in queue, Estimated wait time, Status
5. Khi status = ACTIVE → Cho phép booking

**Backend**: `QueueService`
```typescript
// joinQueue(): Serializable transaction
//   - Count current position → position = count + 1
//   - If position <= 100 → status = ACTIVE (được booking ngay)
//   - If position > 100 → status = WAITING
//   - ACTIVE: expiresAt = now + 10 phút
// 
// getQueuePosition():
//   - Return position, totalInQueue, estimatedWaitMinutes
//   - estimatedWaitMinutes = position <= 100 ? 0 : ceil(position/100 * 5)
//
// leaveQueue(): Mark EXPIRED
```

### 3.7 Bước 6: Reserve Tickets

**Frontend**: Click "Reserve Tickets"
```typescript
// useReserveTickets mutation:
// POST /bookings/reserve
// Body: { eventId, tierId, seatIds?: string[], quantity?: number }
// On success: Navigate to /reservations/{reservationId}
```

**Backend**: `ReservationService.reserveTickets()` — **CRITICAL TRANSACTION**
```typescript
// ═══════════════════════════════════════════════════════════
// Serializable Isolation Level Transaction
// ═══════════════════════════════════════════════════════════

async reserveTickets(dto, user) {
  // 1. VERIFY REDIS LOCKS
  //    Nếu user chọn seatIds cụ thể → kiểm tra Redis lock thuộc về user này
  //    Nếu ghế bị lock bởi user khác → throw ConflictException

  return prisma.$transaction(async (tx) => {
    // 2. LOCK EVENT ROW (Pessimistic Lock)
    //    SELECT * FROM events WHERE id = ? FOR UPDATE
    //    → Chặn concurrent access vào cùng event
    //    → Check status = ON_SALE || PRESALE

    // 3. QUEUE GATING
    //    Nếu event.queueEnabled → Check user có QueueEntry status=ACTIVE
    //    Không có → throw "You must join the queue first"

    // 4. PER-USER LIMIT CHECK
    //    Count reservations (PENDING + CONFIRMED) cho user + event này
    //    If existing + quantity > maxTicketsPerUser → throw "Maximum X tickets per user"

    // 5. LOCK TIER ROW (Pessimistic Lock)
    //    SELECT * FROM ticket_tiers WHERE id = ? FOR UPDATE
    //    → Check availableQuantity >= quantity

    // 6. LOCK SEAT ROWS (Pessimistic Lock)
    //    Nếu có seatIds → SELECT ... WHERE id = ANY(seatIds) AND status=AVAILABLE FOR UPDATE
    //    Không có seatIds → Auto-select: SELECT ... WHERE tier_id=? AND status=AVAILABLE
    //                       ORDER BY row_name, seat_number LIMIT quantity FOR UPDATE

    // 7. CALCULATE EFFECTIVE PRICE
    //    getEffectivePrice(tier):
    //    - Nếu earlyBirdPrice + earlyBirdEndDate + now < endDate → earlyBirdPrice
    //    - Nếu lastMinutePrice + lastMinuteStartDate + now >= startDate → lastMinutePrice  
    //    - Else → tier.price

    // 8. UPDATE SEATS → status = RESERVED
    //    UPDATE seats SET status='RESERVED' WHERE id IN (seatIds)

    // 9. DECREMENT TIER AVAILABILITY (Atomic)
    //    UPDATE ticket_tiers SET available_quantity = available_quantity - N

    // 10. DECREMENT EVENT AVAILABILITY (Atomic)
    //     UPDATE events SET available_tickets = GREATEST(0, available_tickets - N)
    
    // 11. CHECK SOLD OUT
    //     If updatedEvent.availableTickets <= 0 → status = SOLD_OUT

    // 12. CREATE RESERVATION
    //     { userId, eventId, status: PENDING, totalAmount, currency, ticketCount,
    //       expiresAt: now + 15 MINUTES }

    // 13. CREATE RESERVATION ITEMS
    //     For each seat: { reservationId, seatId, tierId, priceAtBooking, status: RESERVED }

    // 14. RELEASE REDIS LOCKS
    //     Giải phóng Redis seat locks (vì đã có DB lock rồi)

    // 15. RETURN ReservationResponseDto
  }, { isolationLevel: 'Serializable' });
}
```

**Key Points**:
- **Serializable isolation**: Cao nhất, ngăn phantom reads
- **Pessimistic locking (FOR UPDATE)**: Lock rows khi đọc → ngăn race conditions
- **Atomic decrements**: `available_quantity - N` → thread-safe
- **Expiry**: 15 phút để hoàn thành payment
- **Auto SOLD_OUT**: Tự động chuyển status khi hết vé

---

## 4. LUỒNG PAYMENT CHI TIẾT

### 4.1 Checkout Page

**Frontend**: `/reservations/[reservationId]`
- APIs gọi:
  - `GET /bookings/:id` → Reservation details (items, amounts, coupon info)
  - `GET /payments/providers` → Available payment methods
  - `GET /payments/status/:id` → Poll payment status mỗi 10 giây
- Hiển thị:
  - Order Summary (tier, seat label, price per item, total)
  - Countdown timer (15 phút, hiển thị MM:SS)
  - Coupon code input + Check/Apply button
  - Payment method selection (STRIPE / PAYPAL / PAYOS)
  - Pay button với total amount
  - Cancel Reservation button

### 4.2 Coupon Flow

**Frontend**:
1. User nhập coupon code
2. "Check" → `POST /coupons/validate { reservationId, couponCode }`
3. Hiển thị thông tin coupon (discount type, value, valid period)
4. "Apply" → `POST /coupons/apply { reservationId, couponCode }`
5. Cập nhật finalAmount = totalAmount - discountAmount
6. "Remove" → `DELETE /coupons/remove/:reservationId`

**Backend**: `CouponService`
```typescript
// validateCoupon():
//   - Check coupon.active && coupon exists
//   - Check validFrom/validUntil
//   - Check eventId match (nếu coupon specific cho event)
//   - Check maxUses > currentUses
//   - Check maxUsesPerUser (count usage cho user này)
//   - Check minPurchaseAmount <= reservation.totalAmount
//   - Return: coupon info + calculated discount amount

// applyCoupon(): Serializable Transaction
//   - Validate lại coupon (atomic)
//   - Calculate discount:
//     PERCENTAGE: totalAmount * (discountValue / 100), cap by maxDiscountAmount
//     FIXED_AMOUNT: min(discountValue, totalAmount)
//   - Atomic increment: coupon.currentUses++
//   - Update reservation: couponId, discountAmount
//   - Return: ApplyCouponResponseDto { originalAmount, discountAmount, finalAmount }

// removeCoupon():
//   - Decrement coupon.currentUses
//   - Clear reservation.couponId, reservation.discountAmount = 0
```

### 4.3 Payment Initiation

**Frontend**: Click payment method → Click "Pay $X.XX USD"
```typescript
// useInitiatePayment mutation:
// POST /payments/initiate
// Body: { reservationId, provider: "STRIPE"|"PAYPAL"|"PAYOS" }
// Response: { id, clientSecret, approvalUrl, checkoutUrl, ... }
```

**Backend**: `PaymentService.initiatePayment()`
```typescript
async initiatePayment(dto, user) {
  // 1. GET RESERVATION
  //    Verify ownership (reservation.userId === user.id)
  //    Check status = PENDING || EXPIRED (có thể retry)

  return prisma.$transaction(async (tx) => {
    // 2. CANCEL OLD PENDING PAYMENTS
    //    UPDATE payments SET status=FAILED WHERE reservationId=? AND status=PENDING
    //    → Đảm bảo chỉ 1 payment active per reservation

    // 3. EXTEND RESERVATION EXPIRY
    //    expiresAt = now + 30 MINUTES 
    //    (kéo dài vì đang trong flow payment)

    // 4. CALCULATE FINAL AMOUNT
    //    amount = totalAmount - discountAmount

    // 5. CREATE PAYMENT INTENT (provider-specific)
    switch(provider) {
      case STRIPE:
        // stripe.paymentIntents.create({
        //   amount: Math.round(amount * 100), ← CENTS
        //   currency: 'usd',
        //   metadata: { reservationId, userId }
        // })
        // → providerPaymentId = paymentIntent.id
        // → providerClientSecret = paymentIntent.client_secret
        break;
      
      case PAYPAL:
        throw BadRequestException('PayPal not yet available');
        
      case PAYOS:
        throw BadRequestException('PayOS not yet available');
    }

    // 6. SAVE PAYMENT RECORD
    //    { reservationId, userId, amount, currency, provider,
    //      status: PENDING/FAILED, providerPaymentId, providerClientSecret }

    // 7. RETURN PaymentResponseDto
    //    { id, clientSecret, approvalUrl, checkoutUrl, ... }
  });
}
```

### 4.4 Stripe Payment Flow

```
Frontend (StripeCheckout)          Stripe API              Backend
        │                             │                       │
        │ ① loadStripe(publicKey)     │                       │
        │ ◄───────────────────────────                        │
        │                             │                       │
        │ ② Elements(clientSecret)    │                       │
        │ ◄───────────────────────────                        │
        │                             │                       │
        │ ③ User enters card details  │                       │
        │    PaymentElement renders    │                       │
        │                             │                       │
        │ ④ stripe.confirmPayment()   │                       │
        │ ─────────────────────────►  │                       │
        │                             │ 3D Secure (nếu cần)  │
        │ ◄───────────────────────────│                       │
        │                             │                       │
        │ ⑤ Redirect to /payments/    │                       │
        │    callback?provider=stripe  │                       │
        │    &status=succeeded         │                       │  
        │    &reservationId=xxx        │                       │  
        │                             │                       │
        │ ⑥ POST /payments/           │                       │
        │    confirm-stripe            │                       │
        │ ──────────────────────────────────────────────────►  │
        │                             │                       │
        │                             │  ⑦ Webhook:           │
        │                             │  payment_intent.      │
        │                             │  succeeded            │
        │                             │ ─────────────────────►│
        │                             │                       │
        │                             │     ⑧ Atomic:         │
        │                             │     - Lock payment    │
        │                             │       FOR UPDATE      │
        │                             │     - Update COMPLETED│
        │                             │     - Confirm reserv. │
        │                             │     - Issue tickets   │
        │                             │     (Serializable TX) │
```

### 4.5 Confirm Stripe Payment

**Backend**: `PaymentService.confirmStripePayment()`
```typescript
async confirmStripePayment(paymentIntentId, reservationId, userId) {
  // 1. FIND PAYMENT by reservationId + providerPaymentId
  // 2. IDEMPOTENT CHECK: Nếu đã COMPLETED → return current state
  // 3. CHECK STATUS = PENDING (chỉ confirm PENDING payments)

  return prisma.$transaction(async (tx) => {
    // 4. PESSIMISTIC LOCK PAYMENT
    //    SELECT * FROM payments WHERE id=? AND status='PENDING' FOR UPDATE
    //    Nếu null → đã processed bởi concurrent request → return current

    // 5. UPDATE PAYMENT → COMPLETED
    //    status = COMPLETED, completedAt = now()

    // 6. CONFIRM RESERVATION
    //    reservationService.confirmReservation(reservationId):
    //    - reservation.status = CONFIRMED, confirmedAt = now()
    //    - Tất cả seats → status = SOLD (RESERVED → SOLD)
    //    - Tất cả reservationItems → status = CONFIRMED
    //    - Check event SOLD_OUT

    // 7. ISSUE TICKETS
    //    ticketService.issueTicketsForReservation(reservation):
    //    - For each reservationItem:
    //      - Generate ticketCode: "TKT-" + uuid.substring(0,8).toUpperCase()
    //      - Generate qrCodeData: JSON { ticketCode, eventId, tierId, seatId, timestamp }
    //      - Create ticket record: status=VALID, price=priceAtBooking
    //      - Snapshot: tierName, seatLabel

    // 8. RETURN PaymentResponseDto
  }, { isolationLevel: 'Serializable' });
}
```

### 4.6 Stripe Webhook Handler

**Backend**: `PaymentController.stripeWebhook()` → `PaymentService.handleStripeWebhook()`
```typescript
// Route: POST /payments/webhook/stripe
// Body: Raw payload (Stripe signature verification)
// 
// handleStripeWebhook(payload, sigHeader):
//   1. Verify signature: stripeClient.webhooks.constructEvent(payload, sigHeader, webhookSecret)
//   2. If event.type === 'payment_intent.succeeded':
//      - Serializable transaction:
//        - Lock payment row WHERE provider_payment_id = pi.id AND status = 'PENDING' FOR UPDATE
//        - If not found → already processed, skip
//        - Update payment → COMPLETED  
//        - Confirm reservation
//        - Issue tickets
//
// Safety: Idempotent - nếu payment đã COMPLETED, webhook bị bỏ qua
```

### 4.7 Refund Flow

**Frontend**: Button "Refund" trên reservation detail (khi payment COMPLETED)
```typescript
// useRefundPayment mutation:
// POST /payments/refund/:reservationId
```

**Backend**: `PaymentService.refundPayment()`
```typescript
async refundPayment(reservationId, userId) {
  // 1. Find COMPLETED payment for reservation
  // 2. Update payment → REFUNDED
  // 3. Release reservation:
  //    - reservation.status = CANCELLED
  //    - All seats → AVAILABLE (SOLD → AVAILABLE)
  //    - All reservationItems → CANCELLED
  //    - Increment tier.availableQuantity
  //    - Increment event.availableTickets
  //    - If event was SOLD_OUT and now has available → revert to ON_SALE
  // 4. (Production) Call Stripe refund API
}
```

### 4.8 Payment Callback Page

**Frontend**: `/payments/callback?provider=stripe&status=succeeded&reservationId=xxx`
- Hiển thị loading state
- Confirm payment status với backend
- Nếu success: Auto-redirect to `/reservations/:id` sau 5 giây countdown
- Nếu error: Hiển thị error message + "Try again" button

---

## 5. API ENDPOINTS CHI TIẾT

### 5.1 Booking APIs

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|--------|
| `GET` | `/bookings` | JWT | Danh sách reservations của user |
| `GET` | `/bookings/:id` | JWT | Chi tiết 1 reservation |
| `POST` | `/bookings/reserve` | JWT | **Đặt vé** (Serializable TX) |
| `POST` | `/bookings/:id/cancel` | JWT | Hủy reservation (chỉ PENDING) |

### 5.2 Payment APIs

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|--------|
| `GET` | `/payments/providers` | JWT | Danh sách payment methods |
| `POST` | `/payments/initiate` | JWT | **Khởi tạo payment** |
| `GET` | `/payments/status/:id` | JWT | Kiểm tra trạng thái payment |
| `POST` | `/payments/confirm-stripe` | JWT | **Xác nhận Stripe payment** (Serializable TX) |
| `POST` | `/payments/refund/:id` | JWT | **Hoàn tiền** |
| `POST` | `/payments/webhook/stripe` | Public | Stripe webhook |

### 5.3 Event APIs

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|--------|
| `GET` | `/events` | Public | Danh sách events (filter, paginate) |
| `GET` | `/events/search` | Public | Tìm kiếm (ILIKE) |
| `GET` | `/events/:id` | Public | Chi tiết event |
| `GET` | `/events/:id/seats` | Public | Seat map (grouped by section) |
| `POST` | `/events` | JWT+Admin | Tạo event DRAFT |
| `PUT` | `/events/:id` | JWT+Admin | Sửa event (chỉ DRAFT) |
| `POST` | `/events/:id/publish` | JWT+Admin | Publish event |
| `POST` | `/events/:id/cancel` | JWT+Admin | Hủy event |
| `POST` | `/events/:id/tiers` | JWT+Admin | Thêm ticket tier (auto-gen seats) |

### 5.4 Ticket APIs

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|--------|
| `GET` | `/tickets/my` | JWT | Vé của tôi (paginated) |
| `GET` | `/tickets/event/:id` | JWT | Vé theo event |
| `GET` | `/tickets/:code` | JWT | Vé theo code |
| `POST` | `/tickets/:code/cancel` | JWT | Hủy vé (chỉ VALID) |
| `GET` | `/tickets/:code/qr` | JWT | QR code PNG |
| `GET` | `/tickets/:code/dynamic-qr` | JWT | Dynamic QR (TOTP 30s) |

### 5.5 Queue APIs

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|--------|
| `POST` | `/queue/join/:id` | JWT | Tham gia hàng đợi |
| `GET` | `/queue/position/:token` | JWT | Kiểm tra vị trí |
| `POST` | `/queue/leave/:token` | JWT | Rời hàng đợi |

### 5.6 Coupon APIs

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|--------|
| `GET` | `/coupons` | JWT+Admin | Danh sách coupons |
| `POST` | `/coupons` | JWT+Admin | Tạo coupon |
| `POST` | `/coupons/validate` | JWT | Validate coupon code |
| `POST` | `/coupons/apply` | JWT | **Apply coupon** (Serializable TX) |
| `DELETE` | `/coupons/remove/:id` | JWT | Gỡ coupon khỏi reservation |
| `POST` | `/coupons/:id/activate` | JWT+Admin | Kích hoạt |
| `POST` | `/coupons/:id/deactivate` | JWT+Admin | Vô hiệu hóa |

### 5.7 Smart Seat & AI APIs

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|--------|
| `GET` | `/smart-seats/suggest/:eventId` | Public | AI gợi ý ghế (multi-factor scoring) |
| `GET` | `/smart-seats/pricing/:tierId` | Public | Dynamic price cho 1 tier |
| `GET` | `/smart-seats/pricing/event/:eventId` | Public | Dynamic prices toàn event |

### 5.8 Check-in APIs

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|--------|
| `POST` | `/check-in` | JWT | Check-in vé (FOR UPDATE lock) |
| `GET` | `/check-in/event/:id` | JWT+Admin | Danh sách check-ins |
| `GET` | `/check-in/event/:id/count` | JWT+Admin | Đếm check-ins thành công |

### 5.9 Resale APIs

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|--------|
| `GET` | `/resale/marketplace` | Public | Danh sách vé bán lại |
| `GET` | `/resale/event/:id` | Public | Vé bán lại theo event |
| `GET` | `/resale/my-listings` | JWT | Listings của tôi |
| `GET` | `/resale/:id` | Public | Chi tiết listing |
| `POST` | `/resale/list` | JWT | **Đăng bán vé** (max 150%) |
| `POST` | `/resale/:id/lock` | JWT | **Lock listing** (10 phút) |
| `POST` | `/resale/:id/purchase` | JWT | **Mua vé** (cancel old, issue new) |
| `POST` | `/resale/:id/cancel` | JWT | Hủy listing |

### 5.10 WebSocket Events

| Event | Direction | Payload | Mô tả |
|-------|-----------|---------|--------|
| `join-event` | Client→Server | `{ eventId, userId }` | Join room, nhận current locks |
| `lock-seat` | Client→Server | `{ eventId, seatId, userId }` | Lock ghế (Redis 5min TTL) |
| `unlock-seat` | Client→Server | `{ eventId, seatId, userId }` | Unlock ghế |
| `seat-update` | Server→Client | `{ type, seatId, userId }` | Broadcast lock/unlock |
| `seat-error` | Server→Client | `{ message }` | Error (ghế đã lock) |
| `seat-status` | Client→Server | `{ eventId }` | Request current status |
| `seat-status-response` | Server→Client | `{ seats }` | Current locked seats |
| `disconnect` | Auto | - | Release tất cả locks |

---

## 6. BACKEND SERVICES & BUSINESS LOGIC

### 6.1 ReservationService (Core)

| Method | Logic |
|--------|-------|
| `reserveTickets()` | **Serializable TX**: Lock event → check queue → per-user limit → lock tier → lock seats → calculate price → reserve seats → decrement counts → check sold out → create reservation + items → release Redis locks |
| `confirmReservation()` | Update status CONFIRMED → seats SOLD → items CONFIRMED → check SOLD_OUT |
| `cancelReservation()` | Chỉ PENDING → release seats AVAILABLE → items CANCELLED → increment counts → check revert ON_SALE |
| `releaseReservation()` | Atomic release: cancel + restore seats + restore tier/event counts |
| `cleanupExpiredReservations()` | **Cron mỗi phút**: Tìm PENDING reservations hết hạn → release |

### 6.2 PaymentService (Core)

| Method | Logic |
|--------|-------|
| `getAvailableProviders()` | Check Stripe key configured → return list |
| `initiatePayment()` | Cancel old payments → extend expiry 30min → create Stripe PaymentIntent → save payment record |
| `confirmStripePayment()` | **Serializable TX**: Idempotent check → lock payment FOR UPDATE → COMPLETED → confirm reservation → issue tickets |
| `refundPayment()` | payment REFUNDED → release reservation → restore seats/counts |
| `handleStripeWebhook()` | Verify signature → **Serializable TX**: lock payment → confirm → issue tickets |

### 6.3 TicketService

| Method | Logic |
|--------|-------|
| `issueTicketsForReservation()` | For each item: generate TKT-XXXXXXXX code + QR JSON → create ticket VALID |
| `getMyTickets()` | Paginated, include event/venue/tier |
| `cancelTicket()` | Chỉ VALID → CANCELLED + cancelledAt |
| `getQrCode()` | Generate PNG via `qrcode` library |
| `getDynamicQr()` | TOTP: HMAC-SHA256(ticketCode, timeSlot) → 8-char code, rotate mỗi 30 giây |

### 6.4 CouponService

| Method | Logic |
|--------|-------|
| `validateCoupon()` | Check active, dates, eventId, maxUses, maxUsesPerUser, minPurchaseAmount |
| `applyCoupon()` | **Serializable TX**: Validate → calculate discount → atomic increment currentUses → update reservation |
| `removeCoupon()` | Decrement currentUses → clear reservation.couponId + discountAmount |

### 6.5 CheckInService

| Method | Logic |
|--------|-------|
| `checkIn()` | **FOR UPDATE lock**: Find ticket by code → check VALID → check not already used → update USED + usedAt → create CheckIn record |

### 6.6 QueueService

| Method | Logic |
|--------|-------|
| `joinQueue()` | **Serializable TX**: Count position → ACTIVE (≤100) / WAITING (>100) → set expiresAt |
| `getQueuePosition()` | Return position, total, estimated wait |

### 6.7 ResaleService

| Method | Logic |
|--------|-------|
| `listForResale()` | **Anti-scalping**: askingPrice ≤ 150% × originalPrice → create listing LISTED |
| `lockForPurchase()` | **Serializable TX**: FOR UPDATE → 10-min lock → LOCKED |
| `completePurchase()` | Cancel seller's ticket → issue new ticket to buyer → SOLD |
| `cancelListing()` | Only seller → CANCELLED |

### 6.8 ML Services

| Service | Functionality |
|---------|--------------|
| **FraudDetectionService** | Risk scoring (0-100): VELOCITY 30%, CANCEL_PATTERN 20%, PAYMENT_FAILURES 25%, BULK_PURCHASE 15%, TIME_ANOMALY 10%. Thresholds: >70 BLOCK, 50-70 REVIEW, <50 ALLOW |
| **DemandForecastService** | Exponential smoothing on booking velocity. Predict 24h/72h forward. Sellout probability (logistic model). Demand heatmap (hourly/daily distribution) |
| **SmartSeatService** | Multi-factor scoring: center (30%), row (25%), adjacency (15%), value (15%), aisle (15%). Dynamic pricing: fill (35%), velocity (30%), time (25%), category (10%), bounds 0.7-2.0× |

### 6.9 Cron Jobs

| Cron | Interval | Logic |
|------|----------|-------|
| `cleanupExpiredReservations` | Mỗi phút | Tìm PENDING reservations quá hạn → release seats → restore counts → check revert SOLD_OUT |

---

## 7. FRONTEND PAGES & COMPONENTS

### 7.1 Pages

| Route | Page | Chức năng |
|-------|------|-----------|
| `/` | Homepage | Landing page, CTA, feature showcase |
| `/login` | Login | Email/password, OAuth (Google/GitHub/Microsoft), Remember me |
| `/register` | Register | First/Last name, Email, Phone, Password |
| `/events` | Events List | 8 events, category filter, search, map view |
| `/events/:id` | Event Detail | **Core booking page**: info, map, tiers, seat map, AI suggest, reserve |
| `/reservations` | Reservations List | My reservations với status, "Pay Now" / "Cancel" |
| `/reservations/:id` | Checkout | **Core payment page**: order summary, countdown, coupon, payment methods |
| `/payments/callback` | Payment Callback | Handle redirect từ payment providers |
| `/tickets` | My Tickets | Vé đã mua, QR code, dynamic QR, livestream link, resale |
| `/resale` | Resale Market | Marketplace + My Listings tabs |
| `/organizers` | Organizers | List organizers, follow/unfollow |
| `/livestream/:id` | Livestream | Mux video player, ticket verification |
| `/profile` | Profile | User info, avatar |
| `/security` | Security | Password, sessions |
| `/devices` | Devices | Active devices management |
| `/mfa` | MFA | Setup 2FA |
| `/coupons` | Coupons (Admin) | Create/manage coupons |

### 7.2 Key Components

| Component | File | Mô tả |
|-----------|------|--------|
| **StadiumSeatMap** | `stadium-seat-map.tsx` | SVG stadium layout, interactive seat selection, color-coded tiers |
| **Venue3DViewer** | `venue-3d-viewer.tsx` | WebGL 3D stadium view, fallback to 2D |
| **StripeCheckout** | `stripe-checkout.tsx` | Stripe Elements form, card payment, 3D Secure |
| **VenueMap** | `venue-map.tsx` | Mapbox GL map with venue marker/popup |
| **EventMediaGallery** | `event-media-gallery.tsx` | Image/video gallery with lightbox |
| **LivestreamPlayer** | `livestream-player.tsx` | Mux HLS player, auto-refresh token |
| **EventSchedule** | `event-schedule.tsx` | Multi-day schedule display |
| **CommentSection** | `comment-section.tsx` | Nested comments, ratings, badges |

### 7.3 State Management

| Store | Type | Mô tả |
|-------|------|--------|
| **useAuthStore** | Zustand (persisted) | user, isAuthenticated, mfaRequired, logout |
| **useAuthModalStore** | Zustand | Modal view (login/register/forgot), isOpen, redirectTo |
| **React Query** | Server state | Tất cả API calls via hooks (use-booking, use-tickets, use-resale, use-smart-seats, use-livestream) |

### 7.4 React Query Hooks

| Hook | Queries | Mutations |
|------|---------|-----------|
| **use-booking** | useEvents, useEvent, useEventSearch, useSeatMap, useReservations, useReservation, usePaymentProviders, usePaymentStatus, useQueuePosition, useAdminCoupons | useReserveTickets, useCancelReservation, useInitiatePayment, useRefundPayment, useJoinQueue, useLeaveQueue, useValidateCoupon, useApplyCoupon, useRemoveCoupon, useCreateCoupon, useToggleCoupon, useDeleteCoupon |
| **use-tickets** | useMyTickets, useTicket, useTicketsByEvent, useTicketQrCode, useDynamicQr | useCancelTicket |
| **use-resale** | useMarketplaceListings, useMyResaleListings, useResaleListingDetails | useListForResale, useLockResaleListing, usePurchaseResaleListing, useCancelResaleListing |
| **use-smart-seats** | useSeatSuggestions, useDynamicPrice, useEventDynamicPrices | - |
| **use-seat-websocket** | - (WebSocket) | lockSeat, unlockSeat |
| **use-livestream** | useLivestreamAccess, useLivestreamToken | - |

---

## 8. HỆ THỐNG PHỤ TRỢ

### 8.1 Concurrency Control

| Cơ chế | Nơi sử dụng | Mục đích |
|--------|-------------|----------|
| **Serializable TX** | reserveTickets, confirmStripePayment, handleStripeWebhook, applyCoupon, joinQueue, lockForPurchase | Ngăn phantom reads, đảm bảo consistency |
| **Pessimistic Lock (FOR UPDATE)** | Lock event, tier, seats, payment rows | Ngăn concurrent updates trên cùng row |
| **Optimistic Lock (version)** | Seats, TicketTiers, ResaleListings | Detect concurrent modifications |
| **Redis NX + TTL** | Seat locking (5-min TTL, max 10/user) | Temporary exclusive access |
| **Atomic Operations** | availableQuantity decrement, currentUses increment | Thread-safe counters |
| **Idempotent Checks** | confirmStripePayment, webhook handler | Xử lý duplicate requests safely |

### 8.2 Auto-transitions

```
Event Status Transitions:
  DRAFT → PUBLISHED → ON_SALE ↔ SOLD_OUT
                    ↘ PRESALE ↗
                    → CANCELLED
                    → COMPLETED

Seat Status Transitions:
  AVAILABLE → RESERVED → SOLD → AVAILABLE (refund)
  AVAILABLE → BLOCKED
  RESERVED → AVAILABLE (expiry/cancel)

Reservation Status Transitions:
  PENDING → CONFIRMED (payment success)
  PENDING → EXPIRED (cron cleanup after 15 min)
  PENDING → CANCELLED (user cancel)

Payment Status Transitions:
  PENDING → COMPLETED (stripe confirm/webhook)
  PENDING → FAILED (error/replaced)
  COMPLETED → REFUNDED (user refund)
```

### 8.3 Security

| Feature | Implementation |
|---------|---------------|
| JWT Authentication | Access token + Refresh token, device tracking |
| Route Guards | `@Roles('ROLE_ADMIN')`, `@Public()` decorators |
| Per-user Limits | maxTicketsPerUser enforced at reservation time |
| Anti-scalping | Resale max 150% of original price |
| Rate Limiting | Per IP (NestJS throttle) |
| Fraud Detection | ML risk scoring (velocity, patterns, bulk) |
| Webhook Security | Stripe signature verification |
| TOTP QR Code | Dynamic QR refreshes every 30 seconds |
| Check-in Lock | FOR UPDATE prevents double check-in |

### 8.4 Pricing System

```
Tier Effective Price Calculation:
  1. Early Bird: Nếu now < earlyBirdEndDate → earlyBirdPrice
  2. Last Minute: Nếu now >= lastMinuteStartDate → lastMinutePrice
  3. Regular: tier.price

Dynamic Pricing (AI multiplier):
  Base × Multiplier (0.7 ~ 2.0)
  
  Factors:
  - Fill Rate (35%): sold/total → higher fill = higher price
  - Velocity (30%): tickets/hour trending → fast selling = higher price
  - Time to Event (25%): closer to event = higher price
  - Category (10%): CONCERT/FESTIVAL premium

  Example (from test): 
    Economy $39.99 × 0.78 multiplier = $31.27 (22% discount, low fill rate)
```

---

## 9. KẾT QUẢ TEST THỰC TẾ

### 9.1 Test Environment
- Backend: NestJS on port 3001
- Frontend: Next.js on port 3000
- Database: PostgreSQL (ticket_booking, localhost:5432)
- Browser: Chrome (via Playwright MCP)

### 9.2 Test Scenarios Executed

| # | Scenario | Kết quả | Chi tiết |
|---|----------|---------|----------|
| 1 | **Homepage load** | ✅ PASS | Landing page hiển thị đúng, 3 featured events, CTA buttons |
| 2 | **User Registration** | ✅ PASS | Form validation, tạo account, redirect to login |
| 3 | **Email Verification** | ✅ PASS (manual DB) | Set email_verified=true via SQL |
| 4 | **User Login** | ✅ PASS | JWT token, device registration, toast "Logged in successfully" |
| 5 | **Events Listing** | ✅ PASS | 8 events loaded, category filters, search bar, map toggle |
| 6 | **Event Detail** | ✅ PASS | Event info, venue map (Mapbox), tiers, seat map, comments |
| 7 | **Tier Selection** | ✅ PASS | Economy tier selected → Smart Seat Suggestions + Quantity selector + Reserve button |
| 8 | **Smart Seat AI** | ✅ PASS | 5 suggestions with scores (70-73), section/row info, prices |
| 9 | **Dynamic Pricing** | ✅ PASS | 22% discount shown (multiplier 0.78), "Now $31.27" |
| 10 | **Seat Map 2D** | ✅ PASS | SVG stadium with stage, green available dots, legend |
| 11 | **Reserve Tickets** | ✅ PASS | POST /bookings/reserve → Created reservation → Redirect to checkout |
| 12 | **Checkout Page** | ✅ PASS | Order summary, countdown timer (14:15), coupon input, payment methods |
| 13 | **Payment Methods** | ✅ PASS | PayPal + Bank/E-Wallet shown, Pay button with total |
| 14 | **Reservations List** | ✅ PASS | 1 reservation shown with PENDING status, "Pay Now" + "Cancel" |
| 15 | **My Tickets** | ✅ PASS (empty) | "No tickets yet" - expected before payment |
| 16 | **Resale Marketplace** | ✅ PASS (empty) | Marketplace + My Listings tabs, "No listings available" |

### 9.3 Issues Noted

| # | Issue | Severity | Chi tiết |
|---|-------|----------|----------|
| 1 | Device conflict on login | Medium | Unique constraint on `device_id` - cần clear old devices khi login từ cùng browser |
| 2 | Stripe not configured | Low | No STRIPE_SECRET_KEY → chỉ PayPal/PayOS (cũng chưa available) |
| 3 | Login redirect lag | Low | Sau login, trang login không auto-redirect, cần navigate thủ công |

### 9.4 Data Flow Summary (Tested)

```
Register → Verify Email (DB) → Login → Browse Events (8 found)
    → Click Taylor Swift Event → View Details + Map + Tiers + Seat Map
    → Select Economy Tier ($39.99) → See AI Suggestions (5 seats, score 70-73)
    → See Dynamic Price (-22%, $31.27) → Click "Reserve Tickets"
    → Redirect to Checkout /reservations/:id
    → See Order Summary + 15-min Countdown + Payment Options
    → PayPal / Bank (Stripe not configured)
    → Back to Reservations List → PENDING with "Pay Now"
```

---

## APPENDIX: Complete Model Relationships

```
User ──┬── Reservation ──── ReservationItem ──── Seat
       │        │                  │
       │        │                  └── TicketTier ── Event ── Venue
       │        │                                      │
       │        ├── Payment                            ├── EventSchedule
       │        │                                      ├── EventMedia
       │        ├── Ticket ── CheckIn                  ├── Comment
       │        │                                      ├── QueueEntry
       │        └── Coupon                             └── ResaleListing
       │
       ├── Organizer ── OrganizerFollower
       ├── UserRole ── Role ── RolePermission ── Permission
       ├── UserDevice
       ├── OAuthAccount
       ├── MfaSecret
       ├── PasswordHistory
       ├── LoginAttempt
       ├── AuditLog
       └── VerificationToken
```

---

> **Document generated**: 23/03/2026  
> **Total Backend Controllers**: 16  
> **Total Backend Services**: 20  
> **Total API Endpoints**: ~70+  
> **Total Database Models**: 26  
> **Total Enums**: 16  
> **Total Frontend Pages**: 17+  
> **Total React Query Hooks**: 30+  
