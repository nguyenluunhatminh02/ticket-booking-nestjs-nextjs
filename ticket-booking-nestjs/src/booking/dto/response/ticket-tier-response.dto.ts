export class TicketTierResponseDto {
  id: string;
  name: string;
  description: string | null;
  price: number;
  effectivePrice: number;
  currency: string;
  totalQuantity: number;
  availableQuantity: number;
  maxPerUser: number | null;
  sortOrder: number;
  pricingPhase: string | null;
  earlyBirdPrice: number | null;
  lastMinutePrice: number | null;
  earlyBirdEndDate: Date | null;
  lastMinuteStartDate: Date | null;
  tierType: string | null;
  zoneName: string | null;
  zoneCapacity: number | null;
  groupMinQuantity: number | null;
  groupDiscountPercent: number | null;
}
