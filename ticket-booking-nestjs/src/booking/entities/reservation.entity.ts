import { ReservationStatus } from './enums';

export class Reservation {
  id: string;
  user?: any;
  userId: string;
  event?: any;
  eventId: string;
  status: ReservationStatus;
  totalAmount: number;
  currency: string;
  ticketCount: number;
  expiresAt: Date;
  confirmedAt: Date;
  cancelledAt: Date;
  coupon?: any;
  couponId: string;
  discountAmount: number;
  items?: any[];
  createdAt: Date;
  updatedAt: Date;

  getFinalAmount(): number {
    return Number(this.totalAmount) - Number(this.discountAmount || 0);
  }
}
