# Ticket Booking NestJS - Complete Application Documentation

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Tech Stack](#2-tech-stack)
3. [Authentication System](#3-authentication-system)
4. [Booking System](#4-booking-system)
5. [Concurrency & Anti-Oversell](#5-concurrency--anti-oversell)
6. [Real-time Features](#6-real-time-features)
7. [Complete API Reference](#7-complete-api-reference)
8. [Database Schema](#8-database-schema)
9. [Test Accounts & Setup](#9-test-accounts--setup)
10. [k6 Load Testing Guide](#10-k6-load-testing-guide)

---

## 1. Architecture Overview

```
┌────────────────┐    ┌──────────────────┐    ┌─────────────┐
│   Frontend     │───▶│  NestJS API      │───▶│ PostgreSQL  │
│ (Next.js)      │    │  :3001           │    │  :5432      │
│ :3000          │    │                  │───▶│ Redis :6379 │
└───────┬────────┘    └─────┬────────────┘    └─────────────┘
        │                   │
        │   WebSocket       │   Stripe Webhook
        └────────(WS)───────┘   Cron Jobs
```

### Module Structure

```
AppModule
├── AuthModule        – Authentication, MFA, device management
│   ├── AuthController      (login, register, token management)
│   ├── UserController      (profile, avatar)
│   ├── DeviceController    (multi-device management)
│   ├── MfaController       (TOTP 2FA setup/verify)
│   └── OAuth2Controller    (Google, GitHub SSO)
│
└── BookingModule     – Events, tickets, payments, real-time
    ├── EventController     (CRUD events, tiers, seat maps)
    ├── BookingController   (reserve, cancel)
    ├── PaymentController   (initiate, confirm, webhook)
    ├── TicketController    (my tickets, QR codes)
    ├── QueueController     (virtual waiting room)
    ├── CouponController    (discounts)
    ├── ResaleController    (P2P ticket marketplace)
    ├── CheckInController   (QR scanning)
    ├── CommentController   (reviews & ratings)
    ├── LivestreamController(online events)
    ├── VenueController     (venue CRUD)
    ├── OrganizerController (organizer profiles)
    ├── AdminController     (dashboard & analytics)
    └── SeatGateway         (WebSocket real-time seat map)
```

---

## 2. Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | NestJS 11 |
| Database | PostgreSQL with TypeORM |
| Cache/Lock | Redis (ioredis) |
| Auth | JWT + Passport + bcrypt |
| 2FA | otplib (TOTP) |
| WebSocket | Socket.IO via @nestjs/websockets |
| Payment | Stripe |
| Rate Limit | @nestjs/throttler |
| Cron | @nestjs/schedule |
| API Docs | Swagger (@nestjs/swagger) |
| QR Code | qrcode library |
| File Upload | Multer |

---

## 3. Authentication System

### 3.1 Registration Flow

```
POST /api/v1/auth/register
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "Password123!",
  "confirmPassword": "Password123!"
}
```

1. Validates password (min 8 chars, must match confirm)
2. Hashes password with bcrypt (12 rounds)
3. Creates user record
4. Stores in PasswordHistory (prevents reuse)
5. Generates 24-hour email verification token
6. Sends verification email

### 3.2 Login Flow

```
POST /api/v1/auth/login
{
  "email": "john@example.com",
  "password": "Password123!",
  "deviceId": "browser-uuid",
  "deviceName": "Chrome on Windows",
  "deviceType": "DESKTOP"
}
```

1. Check brute force (max 5 failed attempts → 15-min lockout)
2. Find user by email
3. `bcrypt.compare(password, hash)`
4. Verify `emailVerified = true`
5. Check `accountLocked` status
6. **If MFA enabled & device not trusted:**
   - Return `{ mfaRequired: true, mfaToken: "..." }`
   - Client calls `POST /api/v1/auth/verify-mfa` with TOTP code
7. Register device (creates UserDevice record)
8. Generate tokens:
   - **accessToken** (15 min): `{ sub, email, roles, deviceId, type: ACCESS, jti }`
   - **refreshToken** (7 days): `{ ..., type: REFRESH }`
   - Store refresh JTI in Redis: `refresh:{userId}:{deviceId} → jti`

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbG...",
    "refreshToken": "eyJhbG...",
    "user": {
      "id": "uuid",
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "roles": ["ROLE_USER"]
    }
  }
}
```

### 3.3 Token Refresh

```
POST /api/v1/auth/refresh-token
{ "refreshToken": "...", "deviceId": "..." }
```

### 3.4 MFA (Two-Factor Authentication)

```
POST /api/v1/mfa/setup               → Returns QR code (otpauth:// URI)
POST /api/v1/mfa/setup/confirm       → Confirm with first TOTP code
POST /api/v1/auth/verify-mfa         → Verify during login
DELETE /api/v1/mfa/disable            → Disable MFA
POST /api/v1/mfa/backup-codes/regenerate → New backup codes
```

### 3.5 Security Features

- **Brute force protection**: 5 failed logins → 15-minute lockout
- **Device management**: Max 3 devices, trusted device skips MFA
- **Token blacklisting**: Redis-backed, revoked tokens immediately invalid
- **Password history**: Last 5 passwords cannot be reused
- **Audit logging**: All security events logged with metadata
- **Rate limiting**: 100 requests per 60 seconds (configurable)

---

## 4. Booking System

### 4.1 Complete Booking Journey

```
[1. Browse] → [2. Queue] → [3. Lock Seat] → [4. Reserve] → [5. Coupon] → [6. Pay] → [7. Ticket]
```

#### Step 1: Browse Events

```
GET /api/v1/events?status=ON_SALE&category=CONCERT&page=0&size=20
GET /api/v1/events/:eventId
GET /api/v1/events/:eventId/seats
GET /api/v1/events/search?q=taylor+swift
```

#### Step 2: Virtual Queue (Optional)

If `event.queueEnabled = true`:
```
POST /api/v1/queue/join/:eventId
→ Position ≤ 100: status=ACTIVE (10-min TTL, can book)
→ Position > 100: status=WAITING (wait for activation)

GET /api/v1/queue/position/:queueToken
POST /api/v1/queue/leave/:queueToken
```

#### Step 3: Lock Seat (Real-time via WebSocket)

```javascript
// Connect to Socket.IO
const socket = io('http://localhost:3001', { path: '/ws' });

// Join event room
socket.emit('join-event', { eventId: '...', userId: '...' });

// Lock a seat (5-min TTL in Redis)
socket.emit('lock-seat', { eventId: '...', seatId: '...', userId: '...' });

// All clients in room receive:
socket.on('seat-update', (data) => {
  // { type: 'SEAT_LOCKED', seatId: '...', lockedBy: '...', ttl: 300 }
});

// On error:
socket.on('seat-error', (data) => {
  // { type: 'SEAT_ALREADY_LOCKED', seatId: '...', message: '...' }
});
```

**Lock constraints:**
- Max 10 locks per user per event
- 5-minute TTL with auto-release
- Atomic Redis `SET NX EX` (prevents race conditions)
- Automatically released on WebSocket disconnect

#### Step 4: Reserve Tickets

```
POST /api/v1/bookings/reserve
{
  "eventId": "uuid",
  "tierId": "uuid",
  "seatIds": ["uuid1", "uuid2"],    // Optional, auto-select if omitted
  "quantity": 2                       // Default: 1
}
```

**Inside the SERIALIZABLE transaction:**
1. Verify event is ON_SALE or PRESALE
2. Check queue ACTIVE status (if queue enabled)
3. Check per-user ticket limit
4. `PESSIMISTIC_WRITE` lock on TicketTier → check availableQuantity
5. `PESSIMISTIC_WRITE` lock on Seats → verify AVAILABLE
6. Set seats status → RESERVED
7. Atomic decrement: `tier.availableQuantity -= quantity`
8. Atomic decrement: `event.availableTickets -= quantity`
9. Create Reservation (status=PENDING, expiresAt=15 min)
10. Create ReservationItems
11. Release Redis seat locks

**Response:**
```json
{
  "id": "reservation-uuid",
  "eventId": "...",
  "status": "PENDING",
  "totalAmount": 100.00,
  "ticketCount": 2,
  "expiresAt": "2026-03-18T12:30:00Z",
  "items": [
    {
      "tierName": "VIP",
      "section": "VIP",
      "rowName": "A",
      "seatNumber": 5,
      "seatLabel": "VIP-A-5",
      "priceAtBooking": 50.00
    }
  ]
}
```

#### Step 5: Apply Coupon (Optional)

```
POST /api/v1/coupons/validate
{ "code": "SUMMER20", "reservationId": "uuid" }

POST /api/v1/coupons/apply
{ "code": "SUMMER20", "reservationId": "uuid" }
```

- Discount types: `PERCENTAGE` or `FIXED_AMOUNT`
- Per-user usage limit (tracked via DB, not in-memory)
- Atomic coupon usage increment in transaction

#### Step 6: Payment

```
POST /api/v1/payments/initiate
{
  "reservationId": "uuid",
  "provider": "STRIPE"
}
→ Returns { clientSecret: "pi_xxx_secret_xxx" }
```

**Client-side Stripe confirmation:**
```javascript
const { paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
  payment_method: { card: cardElement }
});
```

**Server confirmation (or via webhook):**
```
POST /api/v1/payments/webhook/stripe
// Stripe sends payment_intent.succeeded
```

On payment confirmation:
1. Mark Payment → COMPLETED
2. Mark Reservation → CONFIRMED
3. Mark all seats → SOLD
4. Issue Tickets with unique `ticketCode` (TKT-XXXXXXXX) and QR data

#### Step 7: Tickets

```
GET /api/v1/tickets/my?page=0&size=20
GET /api/v1/tickets/:ticketCode
GET /api/v1/tickets/:ticketCode/qr         → PNG image
GET /api/v1/tickets/:ticketCode/dynamic-qr → Rotating TOTP-like code (30s)
POST /api/v1/tickets/:ticketCode/cancel
```

### 4.2 Reservation Expiry Cleanup

A **cron job runs every minute** to release expired PENDING reservations:
- Sets reservation status → CANCELLED
- Releases seats back to AVAILABLE
- Restores tier.availableQuantity and event.availableTickets
- If event was SOLD_OUT, reverts to ON_SALE

### 4.3 Check-In (QR Scanning)

```
POST /api/v1/check-in
{
  "ticketCode": "TKT-A1B2C3D4",
  "latitude": 10.7769,
  "longitude": 106.7009,
  "deviceInfo": "Scanner iPad #3"
}
```

- Uses pessimistic lock to prevent double check-in
- Returns attendee name, seat info, success/failure

### 4.4 Resale Marketplace

```
POST /api/v1/resale/list
{ "ticketId": "uuid", "askingPrice": 75.00 }
// Anti-scalping: max 150% of original price
// 5% platform fee auto-calculated

POST /api/v1/resale/:listingId/lock      // 10-min lock (pessimistic DB lock)
POST /api/v1/resale/:listingId/purchase   // Cancels old ticket, issues new one
POST /api/v1/resale/:listingId/cancel
GET  /api/v1/resale/marketplace
GET  /api/v1/resale/event/:eventId
```

### 4.5 Event Management

```
POST /api/v1/events                        // Create (DRAFT)
POST /api/v1/events/:eventId/tiers         // Add tier (auto-generates seats)
POST /api/v1/events/:eventId/publish       // DRAFT → ON_SALE
POST /api/v1/events/:eventId/cancel
PUT  /api/v1/events/:eventId               // Update (DRAFT only)
```

**Event Status Flow:**
```
DRAFT → [publish] → ON_SALE → SOLD_OUT (auto) → COMPLETED
                  → PRESALE ↗
          ↓
       CANCELLED
```

**Ticket Tier Auto-Seat Generation:**
When adding a tier with `totalQuantity: 100`, the system auto-generates 100 seats:
- 20 seats per row (A-1 to A-20, B-1 to B-20, etc.)
- Section name = tier name
- All seats start as AVAILABLE

---

## 5. Concurrency & Anti-Oversell

### 5.1 Multi-Layer Protection

```
Layer 1: Redis Seat Lock     → Prevents visual conflicts (WebSocket)
Layer 2: SERIALIZABLE Txn    → Prevents DB-level race conditions
Layer 3: Pessimistic Locks   → Row-level locks on tier, seats, event
Layer 4: Atomic SQL Updates  → availableQuantity decremented atomically
Layer 5: Cron Cleanup        → Releases expired reservations every minute
```

### 5.2 Reservation Transaction (SERIALIZABLE)

The `reserveTickets()` method uses `SERIALIZABLE` isolation level:
- Strongest isolation: prevents phantom reads, dirty reads, non-repeatable reads
- PostgreSQL will automatically abort and retry on serialization conflictsany concurrent transactions that conflict
- All seat/tier/event updates happen atomically

### 5.3 Atomic Quantity Updates

```sql
-- Instead of: read → modify → write (race-prone)
-- We use: single atomic UPDATE
UPDATE ticket_tiers
SET available_quantity = available_quantity - :qty
WHERE id = :id AND available_quantity >= :qty;

UPDATE events
SET available_tickets = GREATEST(0, available_tickets - :qty)
WHERE id = :id;
```

### 5.4 Redis Seat Lock (Real-time)

```
SET seat:lock:{eventId}:{seatId} {userId} NX EX 300
```
- `NX`: Only set if key doesn't exist (atomic acquire)
- `EX 300`: Auto-expire after 5 minutes
- Checked before reservation: if seat locked by another user → reject

### 5.5 Check-In Double-Use Prevention

Uses pessimistic write lock on the ticket row during check-in transaction.
Two scanners scanning the same ticket simultaneously:
- First scan acquires lock → marks USED → success
- Second scan waits for lock → sees USED → "Ticket already used"

### 5.6 Coupon Atomic Usage

Coupon usage is tracked via database count, not in-memory:
- Per-user check: `SELECT COUNT(*) FROM reservations WHERE userId=X AND couponId=Y`
- Global increment: `UPDATE coupons SET current_uses = current_uses + 1`
- All within same transaction with pessimistic lock on coupon row

---

## 6. Real-time Features

### 6.1 WebSocket Seat Map

**Protocol:** Socket.IO at `ws://localhost:3001/ws`

| Event | Direction | Payload |
|-------|-----------|---------|
| `join-event` | Client→Server | `{ eventId, userId? }` |
| `lock-seat` | Client→Server | `{ eventId, seatId, userId }` |
| `unlock-seat` | Client→Server | `{ eventId, seatId, userId }` |
| `seat-status` | Client→Server | `{ eventId }` |
| `seat-update` | Server→Room | `{ type, seatId, lockedBy?, ttl? }` |
| `seat-error` | Server→Client | `{ type, seatId, message }` |
| `seat-status-response` | Server→Client | `{ type, lockedSeats }` |

### 6.2 Livestream

Events with `eventMode: ONLINE` or `HYBRID` support livestreaming via Mux:
```
GET /api/v1/livestream/:eventId/token   → Mux playback token
GET /api/v1/livestream/:eventId/access  → Check if user has valid ticket
```

---

## 7. Complete API Reference

### Auth Endpoints (61 total)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/auth/register` | Public | Register new user |
| `POST` | `/api/v1/auth/login` | Public | Login |
| `POST` | `/api/v1/auth/verify-mfa` | Public | Verify MFA code |
| `POST` | `/api/v1/auth/refresh-token` | Public | Refresh access token |
| `POST` | `/api/v1/auth/logout` | Bearer | Logout current device |
| `POST` | `/api/v1/auth/logout-all` | Bearer | Logout all devices |
| `GET` | `/api/v1/auth/verify-email?token=` | Public | Verify email |
| `POST` | `/api/v1/auth/forgot-password` | Public | Request password reset |
| `POST` | `/api/v1/auth/reset-password` | Public | Reset password |
| `POST` | `/api/v1/auth/change-password` | Bearer | Change password |
| `POST` | `/api/v1/auth/resend-verification` | Public | Resend verification email |
| `GET` | `/api/v1/users/me` | Bearer | Get profile |
| `PUT` | `/api/v1/users/me` | Bearer | Update profile |
| `POST` | `/api/v1/users/me/avatar` | Bearer | Upload avatar |
| `DELETE` | `/api/v1/users/me/avatar` | Bearer | Delete avatar |
| `POST` | `/api/v1/users/me/deactivate` | Bearer | Deactivate account |
| `GET` | `/api/v1/users/:id` | Admin | Get user by ID |
| `GET` | `/api/v1/devices` | Bearer | List devices |
| `DELETE` | `/api/v1/devices/:deviceId` | Bearer | Remove device |
| `DELETE` | `/api/v1/devices/others` | Bearer | Remove other devices |
| `POST` | `/api/v1/devices/:deviceId/trust` | Bearer | Trust device |
| `DELETE` | `/api/v1/devices/:deviceId/trust` | Bearer | Untrust device |
| `PUT` | `/api/v1/devices/:deviceId/name` | Bearer | Rename device |
| `GET` | `/api/v1/devices/sessions` | Bearer | Active sessions |
| `POST` | `/api/v1/mfa/setup` | Bearer | Init MFA setup |
| `POST` | `/api/v1/mfa/setup/confirm` | Bearer | Confirm MFA |
| `DELETE` | `/api/v1/mfa/disable` | Bearer | Disable MFA |
| `GET` | `/api/v1/mfa/status` | Bearer | MFA status |
| `POST` | `/api/v1/mfa/verify` | Bearer | Verify TOTP |
| `POST` | `/api/v1/mfa/backup-codes/regenerate` | Bearer | New backup codes |
| `GET` | `/api/v1/mfa/backup-codes/count` | Bearer | Backup code count |

### Booking Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/v1/events` | Public | List events |
| `GET` | `/api/v1/events/search?q=` | Public | Search events |
| `GET` | `/api/v1/events/:eventId` | Public | Event details |
| `GET` | `/api/v1/events/:eventId/seats` | Public | Seat map |
| `POST` | `/api/v1/events` | Bearer | Create event |
| `PUT` | `/api/v1/events/:eventId` | Bearer | Update event |
| `POST` | `/api/v1/events/:eventId/publish` | Bearer | Publish event |
| `POST` | `/api/v1/events/:eventId/cancel` | Bearer | Cancel event |
| `POST` | `/api/v1/events/:eventId/tiers` | Bearer | Add ticket tier |
| `GET` | `/api/v1/bookings` | Bearer | My reservations |
| `GET` | `/api/v1/bookings/:reservationId` | Bearer | Get reservation |
| `POST` | `/api/v1/bookings/reserve` | Bearer | Reserve tickets |
| `POST` | `/api/v1/bookings/:reservationId/cancel` | Bearer | Cancel reservation |
| `GET` | `/api/v1/payments/providers` | Public | Available providers |
| `POST` | `/api/v1/payments/initiate` | Bearer | Initiate payment |
| `GET` | `/api/v1/payments/status/:reservationId` | Bearer | Payment status |
| `POST` | `/api/v1/payments/refund/:reservationId` | Bearer | Refund payment |
| `POST` | `/api/v1/payments/webhook/stripe` | Public | Stripe webhook |
| `GET` | `/api/v1/tickets/my` | Bearer | My tickets |
| `GET` | `/api/v1/tickets/event/:eventId` | Bearer | Tickets by event |
| `GET` | `/api/v1/tickets/:ticketCode` | Bearer | Ticket by code |
| `POST` | `/api/v1/tickets/:ticketCode/cancel` | Bearer | Cancel ticket |
| `GET` | `/api/v1/tickets/:ticketCode/qr` | Bearer | QR PNG |
| `GET` | `/api/v1/tickets/:ticketCode/dynamic-qr` | Bearer | Dynamic QR |
| `POST` | `/api/v1/queue/join/:eventId` | Bearer | Join queue |
| `GET` | `/api/v1/queue/position/:queueToken` | Bearer | Queue position |
| `POST` | `/api/v1/queue/leave/:queueToken` | Bearer | Leave queue |
| `GET` | `/api/v1/coupons` | Bearer | List coupons |
| `POST` | `/api/v1/coupons` | Bearer | Create coupon |
| `POST` | `/api/v1/coupons/validate` | Bearer | Validate coupon |
| `POST` | `/api/v1/coupons/apply` | Bearer | Apply coupon |
| `DELETE` | `/api/v1/coupons/remove/:reservationId` | Bearer | Remove coupon |
| `POST` | `/api/v1/resale/list` | Bearer | List for resale |
| `POST` | `/api/v1/resale/:listingId/lock` | Bearer | Lock listing |
| `POST` | `/api/v1/resale/:listingId/purchase` | Bearer | Buy resale |
| `POST` | `/api/v1/resale/:listingId/cancel` | Bearer | Cancel listing |
| `GET` | `/api/v1/resale/marketplace` | Public | Browse marketplace |
| `GET` | `/api/v1/resale/event/:eventId` | Public | Event listings |
| `GET` | `/api/v1/resale/my-listings` | Bearer | My listings |
| `POST` | `/api/v1/check-in` | Bearer | Check in |
| `GET` | `/api/v1/check-in/event/:eventId` | Admin | Check-ins by event |
| `GET` | `/api/v1/check-in/event/:eventId/count` | Admin | Check-in count |
| `GET` | `/api/v1/events/:eventId/comments` | Public | List comments |
| `POST` | `/api/v1/events/:eventId/comments` | Bearer | Create comment |
| `PUT` | `/api/v1/events/:eventId/comments/:id` | Bearer | Update comment |
| `DELETE` | `/api/v1/events/:eventId/comments/:id` | Bearer | Delete comment |
| `GET` | `/api/v1/venues` | Public | List venues |
| `GET` | `/api/v1/venues/:venueId` | Public | Venue details |
| `POST` | `/api/v1/venues` | Bearer | Create venue |
| `GET` | `/api/v1/organizers` | Public | List organizers |
| `GET` | `/api/v1/organizers/:id` | Public | Organizer details |
| `POST` | `/api/v1/organizers` | Bearer | Create organizer |
| `GET` | `/api/v1/admin/dashboard` | Admin | Dashboard stats |
| `GET` | `/api/v1/admin/analytics/event/:eventId` | Admin | Event analytics |
| `GET` | `/api/v1/livestream/:eventId/token` | Bearer | Livestream token |
| `GET` | `/api/v1/livestream/:eventId/access` | Bearer | Livestream access |

---

## 8. Database Schema

### Auth Tables

```
users
├── id (UUID, PK)
├── email (UNIQUE)
├── password_hash
├── first_name, last_name
├── phone_number
├── avatar_url
├── email_verified (boolean)
├── account_locked (boolean)
├── mfa_enabled (boolean)
├── max_devices (default: 3)
└── created_at, updated_at

roles
├── id, name (UNIQUE), description
└── permissions (M2M → permissions)

user_devices
├── id, user_id (FK), device_id
├── device_name, device_type
├── browser, os, ip_address
├── is_trusted (boolean)
├── is_active (boolean)
└── last_used_at

mfa_secrets
├── id, user_id (FK)
├── encrypted_secret
├── backup_codes (JSON)
└── verified (boolean)

verification_tokens
├── id, user_id (FK)
├── token, type (EMAIL_VERIFY/PASSWORD_RESET)
└── expires_at (24h TTL)

login_attempts
├── id, email, ip_address
├── success (boolean)
└── attempted_at

password_history
├── id, user_id (FK)
├── password_hash
└── created_at

audit_logs
├── id, user_id, action
├── resource, resource_id
├── details (JSON)
└── ip_address, created_at
```

### Booking Tables

```
venues
├── id, name, address
├── city, state, country, zip_code
├── capacity, seat_map_config (JSON)
├── latitude, longitude, image_url
└── created_at

events
├── id, name, description, artist_name
├── category (CONCERT/SPORTS/THEATER/...)
├── status (DRAFT→ON_SALE→SOLD_OUT→COMPLETED)
├── event_mode (OFFLINE/ONLINE/HYBRID)
├── event_date, end_date, doors_open_at
├── venue_id (FK), organizer_id (FK)
├── total_tickets, available_tickets
├── max_tickets_per_user
├── queue_enabled (boolean)
├── streaming_url, mux_playback_id
├── cover_image_url, banner_url
└── created_at, updated_at

ticket_tiers
├── id, event_id (FK)
├── name, description
├── price, currency
├── total_quantity, available_quantity
├── max_per_user, sort_order
├── early_bird_price, early_bird_end_date
├── last_minute_price, last_minute_start_date
├── group_min_quantity, group_discount_percent
├── tier_type (ASSIGNED/ZONE/GA)
├── version (@VersionColumn)
└── created_at, updated_at

seats
├── id, venue_id (FK), event_id (FK), tier_id (FK)
├── section, row_name, seat_number
├── status (AVAILABLE/RESERVED/SOLD/BLOCKED)
├── price_override
├── version (@VersionColumn)
└── created_at, updated_at

reservations
├── id, user_id (FK), event_id (FK)
├── status (PENDING/CONFIRMED/EXPIRED/CANCELLED)
├── total_amount, discount_amount, currency
├── ticket_count
├── coupon_id (FK)
├── expires_at (15 min from creation)
├── confirmed_at, cancelled_at
└── created_at, updated_at

reservation_items
├── id, reservation_id (FK)
├── seat_id (FK), tier_id (FK)
├── price_at_booking
├── status (PENDING/RESERVED/CONFIRMED/CANCELLED)
└── created_at

tickets
├── id, ticket_code (UNIQUE, "TKT-XXXXXXXX")
├── reservation_id (FK), user_id (FK)
├── event_id (FK), tier_id (FK), seat_id (FK)
├── qr_code_data (JSON)
├── status (VALID/USED/CANCELLED/EXPIRED)
├── tier_name, seat_label
├── price, currency
├── issued_at, used_at, cancelled_at, expires_at
└── (no version column)

payments
├── id, reservation_id (FK), user_id (FK)
├── amount, currency
├── provider (STRIPE/PAYPAL/PAYOS)
├── status (PENDING/COMPLETED/FAILED/REFUNDED)
├── provider_payment_id, provider_client_secret
├── failure_reason
├── completed_at
└── created_at, updated_at

coupons
├── id, code (UNIQUE), description
├── discount_type (PERCENTAGE/FIXED_AMOUNT)
├── discount_value, currency
├── max_uses, current_uses
├── max_uses_per_user
├── min_purchase_amount, max_discount_amount
├── event_id (FK, optional)
├── valid_from, valid_until
├── active (boolean)
└── created_at

queue_entries
├── id, user_id (FK), event_id (FK)
├── queue_token (UNIQUE)
├── position
├── status (WAITING/ACTIVE/EXPIRED/COMPLETED)
├── joined_at, activated_at, expires_at
└── created_at

resale_listings
├── id, ticket_id (FK), event_id (FK)
├── seller_id (FK), buyer_id (FK)
├── asking_price, original_price, currency
├── platform_fee_percent (5%), platform_fee_amount
├── seller_payout
├── status (LISTED/LOCKED/SOLD/CANCELLED/EXPIRED)
├── lock_expires_at (10 min)
├── new_ticket_id (FK)
├── version (@VersionColumn)
└── created_at, updated_at

check_ins
├── id, ticket_id (FK), event_id (FK)
├── checked_in_by_id (FK)
├── check_in_latitude, check_in_longitude
├── device_info
├── successful (boolean), failure_reason
└── checked_in_at

comments
├── id, event_id (FK), user_id (FK)
├── content, rating (1-5)
├── parent_id (self-referential FK for replies)
└── created_at, updated_at
```

### Redis Keys

```
seat:lock:{eventId}:{seatId}        → userId (TTL 5 min)
seat:locks:{eventId}                 → SET of locked seatIds
seat:user:{eventId}:{userId}         → SET of user's locked seats
refresh:{userId}:{deviceId}          → JWT jti
blacklist:{jti}                      → 1 (TTL = token remaining life)
login:attempts:{email}               → count
```

---

## 9. Test Accounts & Setup

### 9.1 Prerequisites

```bash
# PostgreSQL
docker run -d --name auth-postgres \
  -e POSTGRES_DB=ticket_booking \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 postgres:16

# Redis
docker run -d --name auth-redis \
  -p 6379:6379 redis:7-alpine
```

### 9.2 Environment Variables (.env)

```env
# Server
APP_PORT=3001
CORS_ORIGINS=http://localhost:3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=ticket_booking
DB_SYNC=true
DB_LOGGING=false

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-secret-key-here
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Stripe (optional)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Email (optional)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your@gmail.com
MAIL_PASS=app-password

# Rate Limiting
THROTTLE_TTL=60000
THROTTLE_LIMIT=100
```

### 9.3 Start the Server

```bash
cd ticket-booking-nestjs
npm install
npm run build
npm run start:dev    # or: node dist/main.js
```

Swagger UI: **http://localhost:3001/api/docs**

### 9.4 Create Test Accounts

**Option A: Via API (requires email verification bypass)**

```bash
# Register admin
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Admin",
    "lastName": "User",
    "email": "admin@test.com",
    "password": "Password123!",
    "confirmPassword": "Password123!"
  }'

# Verify email (use the verify-email.js script or direct DB)
# In PostgreSQL:
# UPDATE users SET email_verified = true WHERE email = 'admin@test.com';
# INSERT INTO user_roles (user_id, role_id) SELECT u.id, r.id
#   FROM users u, roles r WHERE u.email = 'admin@test.com' AND r.name = 'ROLE_ADMIN';

# Login
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"Password123!"}'
# → Save the accessToken from response
```

**Option B: Quick DB setup script**

```sql
-- After registration, verify and grant admin:
UPDATE users SET email_verified = true WHERE email = 'admin@test.com';

-- Check available roles:
SELECT * FROM roles;

-- Grant ROLE_ADMIN:
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r
WHERE u.email = 'admin@test.com' AND r.name = 'ROLE_ADMIN';
```

### 9.5 Complete Test Flow (cURL)

```bash
# 1. Login (save token)
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"Password123!"}' \
  | jq -r '.data.accessToken')

# 2. Create venue
VENUE_ID=$(curl -s -X POST http://localhost:3001/api/v1/venues \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Test Arena",
    "city": "Ho Chi Minh City",
    "country": "Vietnam",
    "capacity": 500
  }' | jq -r '.id')

# 3. Create event
EVENT_ID=$(curl -s -X POST http://localhost:3001/api/v1/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"venueId\": \"$VENUE_ID\",
    \"name\": \"Test Concert 2026\",
    \"description\": \"A test concert event\",
    \"category\": \"CONCERT\",
    \"eventDate\": \"2026-06-15T19:00:00Z\",
    \"maxTicketsPerUser\": 4
  }" | jq -r '.id')

# 4. Add ticket tier (creates 50 seats automatically)
curl -s -X POST http://localhost:3001/api/v1/events/$EVENT_ID/tiers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "VIP",
    "price": 150.00,
    "currency": "USD",
    "totalQuantity": 50
  }' | jq '.ticketTiers[0].id'
# → Save as TIER_ID

# 5. Publish event
curl -s -X POST http://localhost:3001/api/v1/events/$EVENT_ID/publish \
  -H "Authorization: Bearer $TOKEN"

# 6. Reserve tickets
curl -s -X POST http://localhost:3001/api/v1/bookings/reserve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"eventId\": \"$EVENT_ID\",
    \"tierId\": \"$TIER_ID\",
    \"quantity\": 2
  }" | jq '.'

# 7. View seat map
curl -s http://localhost:3001/api/v1/events/$EVENT_ID/seats | jq '.availableSeats'

# 8. View my reservations
curl -s http://localhost:3001/api/v1/bookings \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

### 9.6 Recommended Test Accounts

| Account | Email | Password | Role | Purpose |
|---------|-------|----------|------|---------|
| Admin | admin@test.com | Password123! | ROLE_ADMIN | Full access, create events |
| User 1 | user1@test.com | Password123! | ROLE_USER | Regular booking |
| User 2 | user2@test.com | Password123! | ROLE_USER | Concurrent booking test |
| User 3 | user3@test.com | Password123! | ROLE_USER | Resale marketplace test |
| Organizer | org@test.com | Password123! | ROLE_USER | Event organizer |

**Remember:** After registration, update `email_verified = true` in the database for each user, or use the email verification link if SMTP is configured.

---

## 10. k6 Load Testing Guide

### 10.1 Install k6

```bash
# Windows (Chocolatey)
choco install k6

# macOS
brew install k6

# Docker
docker pull grafana/k6
```

### 10.2 Run Tests

```bash
cd ticket-booking-nestjs

# Full test (browse + booking + oversell)
k6 run k6-load-test.js

# Oversell-focused test (100 VUs fighting for 20 seats)
k6 run --env SCENARIO=oversell_test k6-load-test.js

# Spike test (flash sale simulation)
k6 run --env SCENARIO=spike k6-load-test.js

# Endurance test (5 minutes sustained)
k6 run --env SCENARIO=endurance k6-load-test.js

# Custom VUs and duration
k6 run --vus 50 --duration 120s k6-load-test.js
```

### 10.3 Key Metrics to Watch

| Metric | Threshold | Meaning |
|--------|-----------|---------|
| `oversell_detected` | Must be 0 | No tickets sold beyond capacity |
| `reservation_success` | - | Successful bookings count |
| `seat_conflicts` | - | Expected conflicts (system working correctly) |
| `reservation_duration p(95)` | < 5000ms | 95th percentile booking time |
| `http_req_duration p(95)` | < 8000ms | Overall API response time |
| `success_rate` | > 30% | Some failures expected (seat conflicts) |

### 10.4 What the Test Validates

1. **No overselling**: `oversell_detected` counter must be 0
2. **Correct conflicts**: When 100 VUs try to book 20 seats, exactly 20 succeed
3. **Data integrity**: availableTickets never goes negative
4. **Performance**: API responds within thresholds under load
5. **Serialization**: SERIALIZABLE transactions properly abort conflicting writes

---

## Appendix: Files Changed for Concurrency

| File | Change | Purpose |
|------|--------|---------|
| `reservation.service.ts` | SERIALIZABLE txn, atomic SQL, Redis lock check, cron cleanup | Core anti-oversell |
| `coupon.service.ts` | DB-based usage tracking, transactional apply | Fix coupon race |
| `payment.service.ts` | Transactional payment creation | Fix multi-payment race |
| `resale.service.ts` | Pessimistic lock on lockForPurchase | Fix resale lock race |
| `queue.service.ts` | SERIALIZABLE txn for position | Fix queue position race |
| `check-in.service.ts` | Pessimistic lock during check-in | Fix double check-in |
