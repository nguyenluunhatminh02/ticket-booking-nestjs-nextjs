export class ApplyCouponResponseDto {
  couponCode: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  discountAmount: number;
  originalAmount: number;
  finalAmount: number;
  currency: string;
  message: string;
}
