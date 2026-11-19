export enum EventCategory {
  CONCERT = 'CONCERT',
  SPORTS = 'SPORTS',
  THEATER = 'THEATER',
  COMEDY = 'COMEDY',
  FESTIVAL = 'FESTIVAL',
  CONFERENCE = 'CONFERENCE',
  OTHER = 'OTHER',
}

export enum EventStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ON_SALE = 'ON_SALE',
  PRESALE = 'PRESALE',
  SOLD_OUT = 'SOLD_OUT',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

export enum EventMode {
  OFFLINE = 'OFFLINE',
  ONLINE = 'ONLINE',
  HYBRID = 'HYBRID',
}

export enum TicketStatus {
  VALID = 'VALID',
  USED = 'USED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum ReservationStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export enum ReservationItemStatus {
  PENDING = 'PENDING',
  RESERVED = 'RESERVED',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

export enum SeatStatus {
  AVAILABLE = 'AVAILABLE',
  RESERVED = 'RESERVED',
  SOLD = 'SOLD',
  BLOCKED = 'BLOCKED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentProvider {
  STRIPE = 'STRIPE',
  PAYPAL = 'PAYPAL',
  PAYOS = 'PAYOS',
}

export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_AMOUNT = 'FIXED_AMOUNT',
}

export enum PricingPhase {
  EARLY_BIRD = 'EARLY_BIRD',
  REGULAR = 'REGULAR',
  LAST_MINUTE = 'LAST_MINUTE',
}

export enum TierType {
  ASSIGNED = 'ASSIGNED',
  ZONE = 'ZONE',
  GA = 'GA',
}

export enum QueueStatus {
  WAITING = 'WAITING',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  COMPLETED = 'COMPLETED',
}

export enum ResaleStatus {
  LISTED = 'LISTED',
  LOCKED = 'LOCKED',
  SOLD = 'SOLD',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum MediaType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
}
