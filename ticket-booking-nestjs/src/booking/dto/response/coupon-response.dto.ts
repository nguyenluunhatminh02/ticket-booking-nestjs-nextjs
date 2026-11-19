export class CouponResponseDto {
  id: string;
  code: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  currency: string;
  maxUses: number | null;
  currentUses: number;
  maxUsesPerUser: number | null;
  minPurchaseAmount: number | null;
  maxDiscountAmount: number | null;
  eventId: string | null;
  eventName: string | null;
  validFrom: Date | null;
  validUntil: Date | null;
  active: boolean;
  createdAt: Date;
}
