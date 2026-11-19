export class PaymentResponseDto {
  id: string;
  reservationId: string;
  amount: number;
  currency: string;
  provider: string;
  status: string;
  clientSecret: string | null;
  approvalUrl: string | null;
  checkoutUrl: string | null;
  completedAt: Date | null;
  createdAt: Date;
}
