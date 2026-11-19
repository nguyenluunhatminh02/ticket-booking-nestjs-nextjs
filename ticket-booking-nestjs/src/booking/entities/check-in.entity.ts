export class CheckIn {
  id: string;
  ticket?: any;
  ticketId: string;
  event?: any;
  eventId: string;
  checkedInBy?: any;
  checkedInById: string;
  checkInLatitude: number;
  checkInLongitude: number;
  deviceInfo: string;
  successful: boolean;
  failureReason: string;
  checkedInAt: Date;
}
