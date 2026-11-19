export class QueuePositionResponseDto {
  id: string;
  eventId: string;
  eventName: string | null;
  queueToken: string;
  position: number;
  totalInQueue: number;
  status: string;
  estimatedWaitMinutes: number;
  activatedAt: Date | null;
  expiresAt: Date | null;
  joinedAt: Date;
}
