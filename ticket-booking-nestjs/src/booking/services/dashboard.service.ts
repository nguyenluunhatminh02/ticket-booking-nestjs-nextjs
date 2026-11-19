import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventStatus, TicketStatus, ReservationStatus, PaymentStatus } from '../entities/enums';
import {
  DashboardStatsResponseDto,
  RevenueAnalyticsResponseDto,
  TopSellingEvent,
  RevenueByDay,
} from '../dto/response/dashboard-response.dto';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
  ) {}

  async getDashboardStats(organizerId?: string): Promise<DashboardStatsResponseDto> {
    const eventWhere = organizerId ? { organizerId } : {};

    const totalEvents = await this.prisma.event.count({ where: eventWhere });
    const soldOutEvents = await this.prisma.event.count({
      where: { ...eventWhere, status: EventStatus.SOLD_OUT },
    });
    const totalTicketsSold = await this.prisma.ticket.count({
      where: { status: TicketStatus.VALID },
    });

    // Revenue
    const revenueResult = await this.prisma.$queryRaw<any[]>`
      SELECT COALESCE(SUM(amount), 0) as "totalRevenue"
      FROM payments WHERE status = 'COMPLETED'
    `;
    const totalRevenue = parseFloat(revenueResult[0]?.totalRevenue || '0');

    const totalCheckIns = await this.prisma.checkIn.count();
    const totalReservations = await this.prisma.reservation.count();
    const confirmedReservations = await this.prisma.reservation.count({
      where: { status: ReservationStatus.CONFIRMED },
    });
    const totalPayments = await this.prisma.payment.count({
      where: { status: PaymentStatus.COMPLETED },
    });

    // Top events by tickets sold
    const topEvents = await this.prisma.$queryRaw<any[]>`
      SELECT event_id as "eventId", COUNT(*)::int as "ticketCount"
      FROM tickets WHERE status = 'VALID'
      GROUP BY event_id ORDER BY "ticketCount" DESC LIMIT 5
    `;

    const topSellingEvents: TopSellingEvent[] = topEvents.map((te) => ({
      eventName: te.eventId,
      ticketsSold: parseInt(te.ticketCount, 10),
      revenue: 0,
    }));

    // Revenue by day (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const revenueByDayRaw = await this.prisma.$queryRaw<any[]>`
      SELECT TO_CHAR(completed_at, 'YYYY-MM-DD') as date,
             SUM(amount) as revenue, COUNT(*)::int as "ticketsSold"
      FROM payments
      WHERE status = 'COMPLETED' AND completed_at >= ${thirtyDaysAgo}
      GROUP BY TO_CHAR(completed_at, 'YYYY-MM-DD')
      ORDER BY date ASC
    `;

    const revenueByDay: RevenueByDay[] = revenueByDayRaw.map((r) => ({
      date: r.date,
      revenue: parseFloat(r.revenue || '0'),
      ticketsSold: parseInt(r.ticketsSold || '0', 10),
    }));

    const activeEvents = await this.prisma.event.count({
      where: { ...eventWhere, status: EventStatus.ON_SALE },
    });

    // Average occupancy
    const averageOccupancyRate = totalTicketsSold > 0 && totalReservations > 0
      ? Math.round((totalCheckIns / totalTicketsSold) * 100)
      : 0;

    return {
      totalEvents,
      onSaleEvents: activeEvents,
      soldOutEvents,
      totalReservations,
      confirmedReservations,
      totalPayments,
      totalRevenue,
      totalTicketsSold,
      totalCheckIns,
      averageOccupancyRate,
      topSellingEvents,
      revenueByDay,
    };
  }

  async getRevenueAnalytics(eventId?: string): Promise<RevenueAnalyticsResponseDto[]> {
    const eventWhere = eventId ? { id: eventId } : {};
    const events = await this.prisma.event.findMany({ where: eventWhere, take: 50 });

    return Promise.all(
      events.map(async (ev) => {
        const ticketsSold = await this.prisma.ticket.count({
          where: { eventId: ev.id, status: TicketStatus.VALID },
        });
        const checkIns = await this.prisma.checkIn.count({
          where: { eventId: ev.id },
        });
        const revenueResult = await this.prisma.$queryRaw<any[]>`
          SELECT COALESCE(SUM(p.amount), 0) as total
          FROM payments p INNER JOIN reservations r ON p.reservation_id = r.id
          WHERE r.event_id = ${ev.id}::uuid AND p.status = 'COMPLETED'
        `;
        const totalRevenue = parseFloat(revenueResult[0]?.total || '0');
        const totalTickets = ev.totalTickets || 0;
        const occupancyRate = totalTickets > 0
          ? Math.round((ticketsSold / totalTickets) * 100)
          : 0;

        return {
          eventId: ev.id,
          eventName: ev.name,
          category: ev.category,
          status: ev.status,
          totalTickets,
          ticketsSold,
          checkIns,
          totalRevenue,
          occupancyRate,
          tierBreakdown: [],
          categoryStats: [],
          monthlyRevenue: [],
          overallRevenue: totalRevenue,
        } as RevenueAnalyticsResponseDto;
      }),
    );
  }

  async getCategoryAnalytics(): Promise<any[]> {
    const result = await this.prisma.$queryRaw<any[]>`
      SELECT category, COUNT(*)::int as "eventCount"
      FROM events GROUP BY category ORDER BY "eventCount" DESC
    `;

    return result.map((r) => ({
      category: r.category,
      eventCount: parseInt(r.eventCount, 10),
    }));
  }
}
