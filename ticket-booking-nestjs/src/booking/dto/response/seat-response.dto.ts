export class SeatResponseDto {
  id: string;
  section: string;
  rowName: string;
  seatNumber: number;
  status: string;
  price: number;
  currency: string;
  label: string;
  tierId: string | null;
  tierName: string | null;
}

export class SeatMapResponseDto {
  eventId: string;
  eventName: string;
  sections: Record<string, SeatResponseDto[]>;
  totalSeats: number;
  availableSeats: number;
}
