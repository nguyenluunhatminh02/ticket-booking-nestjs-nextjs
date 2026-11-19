import { SeatStatus } from './enums';

export class Seat {
  id: string;
  venue?: any;
  venueId: string;
  event?: any;
  eventId: string;
  tier?: any;
  tierId: string;
  section: string;
  rowName: string;
  seatNumber: number;
  status: SeatStatus;
  priceOverride: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;

  getSeatLabel(): string {
    return `${this.section}-${this.rowName}-${this.seatNumber}`;
  }
}
