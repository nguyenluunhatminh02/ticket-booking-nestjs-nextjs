import { PaymentStatus } from './enums';

export class Payment {
  id: string;
  reservation?: any;
  reservationId: string;
  user?: any;
  userId: string;
  amount: number;
  currency: string;
  provider: string;
  providerPaymentId: string;
  providerClientSecret: string;
  status: PaymentStatus;
  failureReason: string;
  createdAt: Date;
  completedAt: Date;
  updatedAt: Date;
}
