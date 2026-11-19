import { PricingPhase, TierType } from './enums';

export class TicketTier {
  id: string;
  event?: any;
  eventId: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  totalQuantity: number;
  availableQuantity: number;
  maxPerUser: number;
  sortOrder: number;
  pricingPhase: PricingPhase;
  earlyBirdPrice: number;
  lastMinutePrice: number;
  earlyBirdEndDate: Date;
  lastMinuteStartDate: Date;
  groupMinQuantity: number;
  groupDiscountPercent: number;
  tierType: TierType;
  zoneName: string;
  zoneCapacity: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;

  getEffectivePrice(): number {
    const now = new Date();
    if (this.earlyBirdPrice && this.earlyBirdEndDate && now < this.earlyBirdEndDate) {
      return this.earlyBirdPrice;
    }
    if (this.lastMinutePrice && this.lastMinuteStartDate && now >= this.lastMinuteStartDate) {
      return this.lastMinutePrice;
    }
    return this.price;
  }
}
