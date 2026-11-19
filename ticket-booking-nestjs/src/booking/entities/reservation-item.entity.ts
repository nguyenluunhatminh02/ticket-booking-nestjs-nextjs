import { ReservationItemStatus } from './enums';

export class ReservationItem {
  id: string;
  reservation?: any;
  reservationId: string;
  seat?: any;
  seatId: string;
  tier?: any;
  tierId: string;
  priceAtBooking: number;
  status: ReservationItemStatus;
  createdAt: Date;
}
