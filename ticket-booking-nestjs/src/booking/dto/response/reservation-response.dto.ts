export class ReservationItemResponseDto {
  id: string;
  tierName: string | null;
  section: string | null;
  rowName: string | null;
  seatNumber: number | null;
  seatLabel: string | null;
  priceAtBooking: number;
}

export class ReservationResponseDto {
  id: string;
  eventId: string;
  eventName: string | null;
  status: string;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  couponCode: string | null;
  currency: string | null;
  ticketCount: number;
  expiresAt: Date | null;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  items: ReservationItemResponseDto[];
  createdAt: Date;
}
