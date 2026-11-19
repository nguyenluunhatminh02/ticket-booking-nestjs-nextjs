export class TicketResponseDto {
  id: string;
  ticketCode: string;
  eventId: string;
  eventName: string;
  eventCoverImageUrl: string;
  eventDate: Date;
  venueName: string;
  venueAddress: string;
  eventMode: string;
  hasLivestream: boolean;
  tierName: string;
  seatLabel: string;
  price: number;
  currency: string;
  status: string;
  qrCodeData: string;
  issuedAt: Date;
  usedAt: Date;
  expiresAt: Date;
}
