export class TopSellingEvent {
  eventName: string;
  ticketsSold: number;
  revenue: number;
}

export class RevenueByDay {
  date: string;
  revenue: number;
  ticketsSold: number;
}

export class DashboardStatsResponseDto {
  totalEvents: number;
  onSaleEvents: number;
  soldOutEvents: number;
  totalReservations: number;
  confirmedReservations: number;
  totalPayments: number;
  totalRevenue: number;
  totalTicketsSold: number;
  totalCheckIns: number;
  averageOccupancyRate: number;
  topSellingEvents: TopSellingEvent[];
  revenueByDay: RevenueByDay[];
}

export class TierBreakdown {
  tierName: string;
  totalQuantity: number;
  soldQuantity: number;
  revenue: number;
  price: number;
}

export class CategoryStats {
  category: string;
  eventCount: number;
  ticketsSold: number;
  revenue: number;
  averageOccupancy: number;
}

export class MonthlyRevenue {
  month: string;
  revenue: number;
  ticketsSold: number;
  eventCount: number;
}

export class RevenueAnalyticsResponseDto {
  eventId: string;
  eventName: string;
  category: string;
  status: string;
  totalTickets: number;
  ticketsSold: number;
  checkIns: number;
  totalRevenue: number;
  occupancyRate: number;
  tierBreakdown: TierBreakdown[];
  categoryStats: CategoryStats[];
  monthlyRevenue: MonthlyRevenue[];
  overallRevenue: number;
}
