export class ResaleListingResponseDto {
  id: string;
  ticketId: string;
  eventId: string;
  eventName: string | null;
  eventCoverImageUrl: string | null;
  eventDate: Date | null;
  venueName: string | null;
  tierName: string | null;
  seatLabel: string | null;
  askingPrice: number;
  originalPrice: number;
  currency: string;
  platformFeePercent: number;
  platformFeeAmount: number;
  sellerPayout: number;
  sellerId: string;
  sellerName: string | null;
  buyerId: string | null;
  status: string;
  lockExpiresAt: Date | null;
  soldAt: Date | null;
  createdAt: Date;
  newTicketCode: string | null;
}
