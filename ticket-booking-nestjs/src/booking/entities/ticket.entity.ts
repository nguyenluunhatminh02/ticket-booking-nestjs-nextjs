import { TicketStatus } from './enums';

export class Ticket {
  id: string;
  ticketCode: string;
  reservation?: any;
  reservationId: string;
  user?: any;
  userId: string;
  event?: any;
  eventId: string;
  tier?: any;
  tierId: string;
  seat?: any;
  seatId: string;
  qrCodeData: string;
  status: TicketStatus;
  tierName: string;
  seatLabel: string;
  price: number;
  currency: string;
  issuedAt: Date;
  usedAt: Date;
  cancelledAt: Date;
  expiresAt: Date;
}
