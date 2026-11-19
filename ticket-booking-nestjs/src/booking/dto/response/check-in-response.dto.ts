export class CheckInResponseDto {
  id: string | null;
  ticketCode: string;
  eventName: string | null;
  tierName: string | null;
  seatLabel: string | null;
  attendeeName: string | null;
  attendeeEmail: string | null;
  successful: boolean;
  failureReason: string | null;
  checkedInAt: Date | null;
}
