import { DiscountType } from './enums';

export class Coupon {
  id: string;
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  currency: string;
  maxUses: number;
  currentUses: number;
  maxUsesPerUser: number;
  minPurchaseAmount: number;
  maxDiscountAmount: number;
  event?: any;
  eventId: string;
  validFrom: Date;
  validUntil: Date;
  active: boolean;
  createdBy?: any;
  createdAt: Date;
  updatedAt: Date;

  isValid(): boolean {
    if (!this.active) return false;
    const now = new Date();
    if (this.validFrom && now < this.validFrom) return false;
    if (this.validUntil && now > this.validUntil) return false;
    if (this.maxUses && this.currentUses >= this.maxUses) return false;
    return true;
  }

  calculateDiscount(cartTotal: number): number {
    if (this.discountType === DiscountType.PERCENTAGE) {
      let discount = (cartTotal * Number(this.discountValue)) / 100;
      if (this.maxDiscountAmount) {
        discount = Math.min(discount, Number(this.maxDiscountAmount));
      }
      return discount;
    }
    return Math.min(Number(this.discountValue), cartTotal);
  }
}
