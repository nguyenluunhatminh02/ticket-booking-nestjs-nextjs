export class SeatSuggestionSeatDto {
  id: string;
  section: string;
  rowName: string;
  seatNumber: number;
  status: string;
  price: number;
  currency: string;
  tierName: string;
  label: string;
}

export class SeatSuggestionDto {
  seats: SeatSuggestionSeatDto[];
  section: string;
  row: string;
  totalPrice: number;
  score: number;
  seatCount: number;
}

export class DynamicPriceInfoDto {
  tierId: string;
  tierName: string;
  basePrice: number;
  dynamicPrice: number;
  multiplier: number;
  fillRate: number;
  availableQuantity: number;
  totalQuantity: number;
  reason: string;
}
