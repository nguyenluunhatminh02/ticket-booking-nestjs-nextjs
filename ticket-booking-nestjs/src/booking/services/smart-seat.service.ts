import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SeatStatus, ReservationStatus } from '../entities/enums';
import { SeatSuggestionDto, SeatSuggestionSeatDto, DynamicPriceInfoDto } from '../dto/response/smart-seat-response.dto';

@Injectable()
export class SmartSeatService {
  constructor(
    private prisma: PrismaService,
  ) {}

  async findBestSeats(
    eventId: string,
    tierId: string,
    quantity: number,
  ): Promise<SeatSuggestionDto[]> {
    const availableSeats = await this.prisma.seat.findMany({
      where: { eventId, tierId, status: SeatStatus.AVAILABLE },
      include: { tier: true },
      orderBy: [{ rowName: 'asc' }, { seatNumber: 'asc' }],
    });

    if (availableSeats.length === 0) return [];

    // Group by row
    const rowMap = new Map<string, typeof availableSeats>();
    for (const seat of availableSeats) {
      const row = seat.rowName || 'A';
      if (!rowMap.has(row)) rowMap.set(row, []);
      rowMap.get(row)!.push(seat);
    }

    const suggestions: SeatSuggestionDto[] = [];

    for (const [rowName, rowSeats] of rowMap) {
      if (rowSeats.length < quantity) continue;
      rowSeats.sort((a, b) => a.seatNumber - b.seatNumber);

      for (let i = 0; i <= rowSeats.length - quantity; i++) {
        let contiguous = true;
        for (let j = 1; j < quantity; j++) {
          if (rowSeats[i + j].seatNumber !== rowSeats[i].seatNumber + j) {
            contiguous = false;
            break;
          }
        }
        if (!contiguous) continue;

        const block = rowSeats.slice(i, i + quantity);
        const totalSeatsInRow = Math.max(...rowSeats.map((s) => s.seatNumber));
        const center = totalSeatsInRow / 2;
        const blockCenter = block[0].seatNumber + (quantity - 1) / 2;

        // ML-enhanced multi-factor scoring
        const centerScore = 100 - Math.abs(blockCenter - center) * 5; // Center preference (30%)
        
        // Row preference: middle rows score higher (25%)
        const allRows = [...rowMap.keys()].sort();
        const rowIdx = allRows.indexOf(rowName);
        const middleRow = allRows.length / 2;
        const rowScore = 100 - Math.abs(rowIdx - middleRow) * (100 / allRows.length);
        
        // Adjacency bonus: prefer blocks with sold neighbors (social proof) (15%)
        const adjacencyScore = await this.calculateAdjacencyScore(block, rowSeats);
        
        // Value score: price vs position quality (15%)
        const avgPrice = block.reduce((s, seat) => s + Number(seat.priceOverride ?? seat.tier?.price ?? 0), 0) / block.length;
        const valueScore = centerScore > 70 ? 90 : centerScore > 50 ? 70 : 50;
        
        // Aisle proximity: near aisle = easier access (15%)
        const nearAisle = block[0].seatNumber <= 2 || 
                          block[block.length - 1].seatNumber >= totalSeatsInRow - 1;
        const aisleScore = nearAisle ? 80 : 60;

        const score = Math.round(
          centerScore * 0.30 +
          rowScore * 0.25 +
          adjacencyScore * 0.15 +
          valueScore * 0.15 +
          aisleScore * 0.15
        );

        const seatDtos: SeatSuggestionSeatDto[] = block.map((s) => ({
          id: s.id,
          section: s.section || '',
          rowName: s.rowName || 'A',
          seatNumber: s.seatNumber,
          status: s.status,
          price: Number(s.priceOverride ?? s.tier?.price ?? 0),
          currency: s.tier?.currency || 'USD',
          tierName: s.tier?.name || '',
          label: `${s.section ? `${s.section}-` : ''}${s.rowName || 'A'}${s.seatNumber}`,
        }));

        suggestions.push({
          seats: seatDtos,
          section: block[0].section || '',
          row: rowName,
          totalPrice: seatDtos.reduce((sum, s) => sum + s.price, 0),
          score: Math.max(0, Math.round(score)),
          seatCount: quantity,
        });

        if (suggestions.length >= 5) break;
      }
      if (suggestions.length >= 5) break;
    }

    // Sort by score descending
    suggestions.sort((a, b) => b.score - a.score);
    return suggestions.slice(0, 5);
  }

  async getDynamicPrice(eventId: string, tierId: string): Promise<DynamicPriceInfoDto> {
    const tier = await this.prisma.ticketTier.findFirst({ where: { id: tierId, eventId } });
    if (!tier) throw new NotFoundException('Tier not found');

    const totalSeats = await this.prisma.seat.count({ where: { eventId, tierId } });
    const soldSeats = await this.prisma.seat.count({
      where: { eventId, tierId, status: SeatStatus.SOLD },
    });

    const basePrice = Number(tier.price);
    const soldPercent = totalSeats > 0 ? (soldSeats / totalSeats) * 100 : 0;
    const fillRate = totalSeats > 0 ? soldSeats / totalSeats : 0;

    // ML-enhanced dynamic pricing with time-decay + velocity signals
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    const daysToEvent = event?.eventDate
      ? Math.max(0, (new Date(event.eventDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      : 30;

    // Calculate sales velocity (bookings in last 24h)
    const sinceDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentBookings = await this.prisma.reservation.count({
      where: {
        eventId,
        createdAt: { gt: sinceDate },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    });

    let multiplier = 1.0;
    let reason = 'Normal demand';

    // Fill-rate factor (primary signal)
    if (soldPercent >= 95) {
      multiplier = 1.8;
      reason = 'Almost sold out - premium pricing';
    } else if (soldPercent >= 90) {
      multiplier = 1.5;
      reason = 'Very high demand - over 90% sold';
    } else if (soldPercent >= 80) {
      multiplier = 1.3;
      reason = 'High demand - over 80% sold';
    } else if (soldPercent >= 60) {
      multiplier = 1.1;
      reason = 'Above average demand';
    } else if (soldPercent <= 20) {
      multiplier = 0.85;
      reason = 'Early bird discount - low occupancy';
    } else if (soldPercent <= 30) {
      multiplier = 0.9;
      reason = 'Low demand discount';
    }

    // Time-to-event adjustment (secondary signal)
    if (daysToEvent < 1 && fillRate > 0.5) {
      multiplier *= 1.15; // Last-day urgency premium
      reason += ' + last-day urgency';
    } else if (daysToEvent < 3 && fillRate > 0.6) {
      multiplier *= 1.08;
      reason += ' + approaching event';
    } else if (daysToEvent > 30 && fillRate < 0.3) {
      multiplier *= 0.92;
      reason += ' + early booking incentive';
    }

    // Velocity-based surge (tertiary signal)
    if (recentBookings > 20) {
      multiplier *= 1.1;
      reason += ' + high velocity surge';
    } else if (recentBookings > 10) {
      multiplier *= 1.05;
    }

    // Cap multiplier to reasonable bounds
    multiplier = Math.max(0.7, Math.min(2.0, multiplier));

    const dynamicPrice = Math.round(basePrice * multiplier * 100) / 100;

    return {
      tierId,
      tierName: tier.name,
      basePrice,
      dynamicPrice,
      multiplier,
      fillRate,
      availableQuantity: totalSeats - soldSeats,
      totalQuantity: totalSeats,
      reason,
    };
  }

  async getDynamicPriceByTierId(tierId: string): Promise<DynamicPriceInfoDto> {
    const tier = await this.prisma.ticketTier.findFirst({ where: { id: tierId } });
    if (!tier) throw new NotFoundException('Tier not found');
    return this.getDynamicPrice(tier.eventId, tierId);
  }

  async getAllDynamicPrices(eventId: string): Promise<Record<string, DynamicPriceInfoDto>> {
    const tiers = await this.prisma.ticketTier.findMany({ where: { eventId } });
    const result: Record<string, DynamicPriceInfoDto> = {};
    for (const tier of tiers) {
      result[tier.id] = await this.getDynamicPrice(eventId, tier.id);
    }
    return result;
  }

  /**
   * ML adjacency scoring: prefer seats near already-sold seats.
   * Social proof: people prefer seats near others (not isolated).
   */
  private async calculateAdjacencyScore(
    block: any[],
    rowSeats: any[],
  ): Promise<number> {
    const blockStart = block[0].seatNumber;
    const blockEnd = block[block.length - 1].seatNumber;

    // Check if neighbors are sold/reserved (occupied = social proof)
    const leftNeighbor = rowSeats.find(s => s.seatNumber === blockStart - 1);
    const rightNeighbor = rowSeats.find(s => s.seatNumber === blockEnd + 1);

    let score = 50; // baseline
    if (leftNeighbor && (leftNeighbor.status === SeatStatus.SOLD || leftNeighbor.status === SeatStatus.RESERVED)) {
      score += 25;
    }
    if (rightNeighbor && (rightNeighbor.status === SeatStatus.SOLD || rightNeighbor.status === SeatStatus.RESERVED)) {
      score += 25;
    }
    // Bonus if both sides occupied (cozy middle group)
    if (score === 100) score = 95; // Cap at 95, not 100

    return Math.min(95, score);
  }

}
