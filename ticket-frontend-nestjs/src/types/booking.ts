/* ===== Booking Types ===== */

export interface Venue {
  id: string;
  name: string;
  address?: string;
  city: string;
  state?: string;
  country?: string;
  capacity?: number;
  latitude?: number;
  longitude?: number;
}

export type EventCategory = "CONCERT" | "SPORTS" | "THEATER" | "COMEDY" | "FESTIVAL" | "CONFERENCE" | "OTHER";
export type EventStatus = "DRAFT" | "PUBLISHED" | "ON_SALE" | "PRESALE" | "SOLD_OUT" | "CANCELLED" | "COMPLETED";
export type EventMode = "OFFLINE" | "ONLINE" | "HYBRID";
export type ReservationStatus = "PENDING" | "CONFIRMED" | "EXPIRED" | "CANCELLED";
export type PaymentStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "REFUNDED";
export type PaymentProvider = "STRIPE" | "PAYPAL" | "PAYOS";
export type SeatStatus = "AVAILABLE" | "RESERVED" | "SOLD" | "BLOCKED";
export type QueueStatus = "WAITING" | "ACTIVE" | "EXPIRED" | "COMPLETED";
export type TicketStatus = "VALID" | "USED" | "CANCELLED" | "EXPIRED";
export type PricingPhase = "EARLY_BIRD" | "REGULAR" | "LAST_MINUTE";
export type TierType = "ASSIGNED" | "ZONE" | "GA";

export interface EventResponse {
  id: string;
  name: string;
  description?: string;
  category: EventCategory;
  status: EventStatus;
  eventMode?: EventMode;
  streamingUrl?: string;
  muxPlaybackId?: string;
  bannerUrl?: string;
  eventDate: string;
  endDate?: string;
  totalTickets: number;
  availableTickets: number;
  maxTicketsPerUser: number;
  queueEnabled: boolean;
  venue: Venue;
  organizer?: OrganizerResponse;
  ticketTiers: TicketTier[];
  schedules?: EventScheduleResponse[];
}

export interface TicketTier {
  id: string;
  name: string;
  description?: string;
  price: number;
  effectivePrice?: number;
  currency: string;
  totalQuantity: number;
  availableQuantity: number;
  pricingPhase?: PricingPhase;
  earlyBirdPrice?: number;
  lastMinutePrice?: number;
  earlyBirdEndDate?: string;
  lastMinuteStartDate?: string;
  tierType?: TierType;
  zoneName?: string;
  zoneCapacity?: number;
  groupMinQuantity?: number;
  groupDiscountPercent?: number;
}

export interface SeatResponse {
  id: string;
  section: string;
  rowName: string;
  seatNumber: number;
  status: SeatStatus;
  price: number;
  currency: string;
  tierName: string;
  label: string;
}

export interface SeatMapResponse {
  eventId: string;
  eventName: string;
  totalSeats: number;
  availableSeats: number;
  sections: Record<string, SeatResponse[]>;
}

export interface ReservationResponse {
  id: string;
  eventId?: string;
  eventName: string;
  venueName?: string;
  status: ReservationStatus;
  totalAmount: number;
  discountAmount?: number;
  finalAmount?: number;
  couponCode?: string;
  currency: string;
  ticketCount: number;
  expiresAt?: string;
  createdAt?: string;
  items: ReservationItem[];
}

export interface ReservationItem {
  id: string;
  seatLabel: string;
  tierName: string;
  priceAtBooking: number;
  currency: string;
}

export interface PaymentResponse {
  id: string;
  reservationId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: string;
  clientSecret?: string;
  approvalUrl?: string;
  checkoutUrl?: string;
  completedAt?: string;
  createdAt?: string;
}

export interface PaymentProviderInfo {
  provider: PaymentProvider;
  displayName: string;
}

export interface QueuePositionResponse {
  id: string;
  eventId: string;
  eventName?: string;
  queueToken: string;
  position: number;
  totalInQueue?: number;
  status: QueueStatus;
  estimatedWaitMinutes?: number;
  activatedAt?: string;
  expiresAt?: string;
}

/* ===== Request types ===== */

export interface ReserveTicketsRequest {
  eventId: string;
  tierId: string;
  seatIds?: string[];
  quantity: number;
}

export interface InitiatePaymentRequest {
  reservationId: string;
  provider: PaymentProvider;
}

/* ===== Coupon types ===== */

export type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT";

export interface CouponResponse {
  id: string;
  code: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  currency: string;
  maxUses?: number;
  currentUses: number;
  maxUsesPerUser?: number;
  minPurchaseAmount?: number;
  maxDiscountAmount?: number;
  eventId?: string;
  eventName?: string;
  validFrom: string;
  validUntil?: string;
  active: boolean;
  createdAt: string;
}

export interface ApplyCouponRequest {
  reservationId: string;
  couponCode: string;
}

export interface ApplyCouponResponse {
  couponCode: string;
  description?: string;
  discountType: string;
  discountValue: number;
  discountAmount: number;
  originalAmount: number;
  finalAmount: number;
  currency: string;
  message: string;
}

export interface CreateCouponRequest {
  code: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  currency?: string;
  maxUses?: number;
  maxUsesPerUser?: number;
  minPurchaseAmount?: number;
  maxDiscountAmount?: number;
  eventId?: string;
  validFrom?: string;
  validUntil?: string;
}

/* ===== Paginated response ===== */

export interface Page<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
}

/* ===== Ticket types ===== */

export interface TicketResponse {
  id: string;
  ticketCode: string;
  eventId: string;
  eventName: string;
  eventCoverImageUrl?: string;
  eventDate?: string;
  venueName?: string;
  venueAddress?: string;
  eventMode?: EventMode;
  hasLivestream?: boolean;
  tierName: string;
  seatLabel?: string;
  price: number;
  currency: string;
  status: TicketStatus;
  qrCodeData: string;
  issuedAt: string;
  usedAt?: string;
  expiresAt?: string;
}

/* ===== Check-in types ===== */

export interface CheckInRequest {
  ticketCode: string;
  latitude?: number;
  longitude?: number;
  deviceInfo?: string;
}

export interface CheckInResponse {
  id: string;
  ticketCode?: string;
  eventName?: string;
  tierName?: string;
  seatLabel?: string;
  attendeeName?: string;
  attendeeEmail?: string;
  successful: boolean;
  failureReason?: string;
  checkedInAt: string;
}

/* ===== Comment types ===== */

export interface CommentResponse {
  id: string;
  userId: string;
  userName: string;
  userAvatarUrl?: string;
  content: string;
  rating?: number;
  badgeType?: string;
  badgeLabel?: string;
  edited: boolean;
  replies: CommentResponse[];
  createdAt: string;
  updatedAt?: string;
}

export interface CreateCommentRequest {
  content: string;
  rating?: number;
  parentId?: string;
}

/* ===== Event Schedule types ===== */

export interface EventScheduleResponse {
  id: string;
  title: string;
  description?: string;
  performer?: string;
  dayNumber: number;
  startTime?: string;
  endTime?: string;
  sortOrder: number;
}

/* ===== Organizer types ===== */

export interface OrganizerResponse {
  id: string;
  userId?: string;
  name: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  contactEmail?: string;
  contactPhone?: string;
  followerCount: number;
  verified: boolean;
  following: boolean;
}

export interface CreateOrganizerRequest {
  name: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  contactEmail?: string;
  contactPhone?: string;
}

/* ===== Dashboard types ===== */

export interface DashboardStats {
  totalEvents: number;
  onSaleEvents: number;
  soldOutEvents: number;
  totalReservations: number;
  confirmedReservations: number;
  totalPayments: number;
  totalRevenue: number;
  totalTicketsSold: number;
  totalCheckIns: number;
  averageOccupancyRate: number;
  topSellingEvents: TopSellingEvent[];
  revenueByDay: RevenueByDay[];
}

export interface TopSellingEvent {
  eventName: string;
  ticketsSold: number;
  revenue: number;
}

export interface RevenueByDay {
  date: string;
  revenue: number;
  ticketsSold: number;
}

/* ===== Resale Marketplace types ===== */

export type ResaleStatus = "LISTED" | "LOCKED" | "SOLD" | "CANCELLED" | "EXPIRED";

export interface ResaleListingResponse {
  id: string;
  eventId: string;
  eventName: string;
  eventCoverImageUrl?: string;
  eventDate?: string;
  venueName?: string;
  tierName: string;
  seatLabel?: string;
  askingPrice: number;
  originalPrice: number;
  currency: string;
  platformFeePercent: number;
  platformFeeAmount?: number;
  sellerPayout?: number;
  sellerId: string;
  sellerName?: string;
  buyerId?: string;
  status: ResaleStatus;
  lockExpiresAt?: string;
  soldAt?: string;
  createdAt: string;
  newTicketCode?: string;
}

export interface ResaleListingRequest {
  ticketId: string;
  askingPrice: number;
}

/* ===== Smart Seat types ===== */

export interface SeatSuggestion {
  seats: SeatResponse[];
  section: string;
  row: string;
  totalPrice: number;
  score: number;
  seatCount: number;
}

export interface DynamicPriceInfo {
  basePrice: number;
  dynamicPrice: number;
  multiplier: number;
  fillRate: number;
  availableQuantity: number;
  totalQuantity: number;
  reason: string;
}

/* ===== Dynamic QR types ===== */

export interface DynamicQrResponse {
  qrData: string;
  isDynamic: boolean;
  ticketCode: string;
  secondsRemaining?: number;
  refreshInterval?: number;
}
