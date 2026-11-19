import { ResaleStatus } from './enums';

export class ResaleListing {
  id: string;
  originalTicket?: any;
  ticketId: string;
  event?: any;
  eventId: string;
  seller?: any;
  sellerId: string;
  buyer?: any;
  buyerId: string;
  newTicket?: any;
  newTicketId: string;
  askingPrice: number;
  originalPrice: number;
  currency: string;
  platformFeePercent: number;
  platformFeeAmount: number;
  sellerPayout: number;
  status: ResaleStatus;
  lockExpiresAt: Date;
  soldAt: Date;
  cancelledAt: Date;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
