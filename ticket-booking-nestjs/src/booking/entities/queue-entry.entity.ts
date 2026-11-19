import { QueueStatus } from './enums';

export class QueueEntry {
  id: string;
  user?: any;
  userId: string;
  event?: any;
  eventId: string;
  queueToken: string;
  position: number;
  status: QueueStatus;
  joinedAt: Date;
  activatedAt: Date;
  expiresAt: Date;
  completedAt: Date;
}
