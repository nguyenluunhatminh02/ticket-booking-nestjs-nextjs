import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  ReservationStatus,
  ReservationItemStatus,
  SeatStatus,
  EventStatus,
  QueueStatus,
  TicketStatus,
  ResaleStatus,
} from '../entities/enums';
import { ReserveTicketsDto } from '../dto';
import {
  ReservationResponseDto,
  ReservationItemResponseDto,
} from '../dto/response/reservation-response.dto';
import { User } from '../../auth/entities/user.entity';
import { SeatLockService } from './seat-lock.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReservationService {
  private readonly logger = new Logger(ReservationService.name);

  constructor(
    private prisma: PrismaService,
    private seatLockService: SeatLockService,
  ) {}

  private getEffectivePrice(tier: any): number {
    const now = new Date();
    if (tier.earlyBirdPrice && tier.earlyBirdEndDate && now < tier.earlyBirdEndDate) {
      return Number(tier.earlyBirdPrice);
    }
    if (tier.lastMinutePrice && tier.lastMinuteStartDate && now >= tier.lastMinuteStartDate) {
      return Number(tier.lastMinutePrice);
    }
    return Number(tier.price);
  }

  async reserveTickets(dto: ReserveTicketsDto, user: User): Promise<ReservationResponseDto> {
    if (dto.seatIds?.length) {
      const lockedSeats = await this.seatLockService.getLockedSeats(dto.eventId);
      for (const seatId of dto.seatIds) {
        const holder = lockedSeats[seatId];
        if (holder && holder !== user.id) {
          throw new ConflictException(`Seat ${seatId} is locked by another user`);
        }
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const [event] = await tx.$queryRaw<any[]>`
        SELECT * FROM events WHERE id = ${dto.eventId}::uuid FOR UPDATE
      `;
      if (!event) throw new NotFoundException('Event not found');
      if (String(event.status) !== EventStatus.ON_SALE && String(event.status) !== EventStatus.PRESALE) {
        throw new BadRequestException('Event is not on sale');
      }

      if (event.queue_enabled) {
        const activeEntry = await tx.queueEntry.findFirst({
          where: { eventId: dto.eventId, userId: user.id, status: QueueStatus.ACTIVE },
        });
        if (!activeEntry) {
          throw new BadRequestException('You must join the queue first');
        }
      }

      const quantity = dto.quantity || 1;
      if (event.max_tickets_per_user) {
        const agg = await tx.reservation.aggregate({
          _sum: { ticketCount: true },
          where: {
            eventId: dto.eventId,
            userId: user.id,
            status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
          },
        });
        const existingTickets = agg._sum.ticketCount ?? 0;
        if (existingTickets + quantity > event.max_tickets_per_user) {
          throw new BadRequestException(
            `Maximum ${event.max_tickets_per_user} tickets per user`,
          );
        }
      }

      const [tier] = await tx.$queryRaw<any[]>`
        SELECT * FROM ticket_tiers WHERE id = ${dto.tierId}::uuid FOR UPDATE
      `;
      if (!tier) throw new NotFoundException('Ticket tier not found');
      if (tier.available_quantity < quantity) {
        throw new ConflictException('Not enough tickets available');
      }

      let seats: any[] = [];
      if (dto.seatIds?.length) {
        seats = await tx.$queryRaw<any[]>`
          SELECT * FROM seats
          WHERE id = ANY(${dto.seatIds}::uuid[])
            AND event_id = ${dto.eventId}::uuid
            AND status = ${SeatStatus.AVAILABLE}
          FOR UPDATE
        `;
        if (seats.length !== dto.seatIds.length) {
          throw new ConflictException('Some seats are not available');
        }
      } else {
        seats = await tx.$queryRaw<any[]>`
          SELECT * FROM seats
          WHERE event_id = ${dto.eventId}::uuid
            AND tier_id = ${dto.tierId}::uuid
            AND status = ${SeatStatus.AVAILABLE}
          ORDER BY row_name ASC, seat_number ASC
          LIMIT ${quantity}
          FOR UPDATE
        `;
        if (seats.length < quantity) {
          throw new ConflictException('Not enough seats available');
        }
      }

      const effectivePrice = this.getEffectivePrice(tier);
      const seatIds = seats.map((s: any) => s.id);

      await tx.seat.updateMany({
        where: { id: { in: seatIds } },
        data: { status: SeatStatus.RESERVED },
      });

      await tx.ticketTier.update({
        where: { id: tier.id },
        data: { availableQuantity: { decrement: seats.length } },
      });

      await tx.$executeRaw`
        UPDATE events
        SET available_tickets = GREATEST(0, available_tickets - ${seats.length})
        WHERE id = ${dto.eventId}::uuid
      `;

      const updatedEvent = await tx.event.findUnique({ where: { id: dto.eventId } });
      if (updatedEvent && (updatedEvent.availableTickets ?? 0) <= 0) {
        await tx.event.update({
          where: { id: dto.eventId },
          data: { status: EventStatus.SOLD_OUT },
        });
      }

      const totalAmount = Math.round(effectivePrice * seats.length * 100) / 100;
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      const savedRes = await tx.reservation.create({
        data: {
          userId: user.id,
          eventId: dto.eventId,
          status: ReservationStatus.PENDING,
          totalAmount,
          currency: tier.currency || 'USD',
          ticketCount: seats.length,
          expiresAt,
        },
      });

      const items: any[] = [];
      for (const seat of seats) {
        const item = await tx.reservationItem.create({
          data: {
            reservationId: savedRes.id,
            seatId: seat.id,
            tierId: dto.tierId,
            priceAtBooking: effectivePrice,
            status: ReservationItemStatus.RESERVED,
          },
        });
        items.push(item);
      }

      for (const seat of seats) {
        await this.seatLockService.unlockSeat(dto.eventId, seat.id, user.id);
      }

      const eventForResponse = await tx.event.findUnique({ where: { id: dto.eventId } });
      return this.toResponse(savedRes, items, eventForResponse);
    }, { isolationLevel: 'Serializable' });
  }

  async getUserReservations(userId: string): Promise<ReservationResponseDto[]> {
    const reservations = await this.prisma.reservation.findMany({
      where: { userId },
      include: {
        event: true,
        items: { include: { seat: true, tier: true } },
        coupon: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return reservations.map((r) => this.toResponse(r, r.items, r.event));
  }

  async getReservation(reservationId: string, userId: string): Promise<ReservationResponseDto> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        event: true,
        items: { include: { seat: true, tier: true } },
        coupon: true,
      },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');
    if (reservation.userId !== userId) throw new BadRequestException('Not authorized');
    return this.toResponse(reservation, reservation.items, reservation.event);
  }

  async cancelReservation(reservationId: string, userId: string): Promise<ReservationResponseDto> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        event: true,
        items: { include: { seat: true, tier: true } },
      },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');
    if (reservation.userId !== userId) throw new BadRequestException('Not authorized');
    if (reservation.status !== ReservationStatus.PENDING) {
      throw new BadRequestException('Only PENDING reservations can be cancelled');
    }

    await this.releaseReservation(reservation);
    const updated = await this.getReservationEntity(reservationId);
    return this.toResponse(updated, updated.items, updated.event);
  }

  async confirmReservation(reservationId: string, tx?: any): Promise<void> {
    const client = tx ?? this.prisma;
    const reservation = await client.reservation.findUnique({
      where: { id: reservationId },
      include: {
        event: true,
        items: { include: { seat: true } },
      },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');
    if (reservation.status === ReservationStatus.CONFIRMED) return;
    if (reservation.status !== ReservationStatus.PENDING) {
      throw new BadRequestException('Only PENDING reservations can be confirmed');
    }

    await client.reservation.update({
      where: { id: reservationId },
      data: { status: ReservationStatus.CONFIRMED, confirmedAt: new Date() },
    });

    const seatIds = reservation.items
      .filter((item: any) => item.seatId)
      .map((item: any) => item.seatId as string);
    if (seatIds.length > 0) {
      await client.seat.updateMany({
        where: { id: { in: seatIds } },
        data: { status: SeatStatus.SOLD },
      });
    }

    await client.reservationItem.updateMany({
      where: { reservationId },
      data: { status: ReservationItemStatus.CONFIRMED },
    });

    const event = await client.event.findUnique({ where: { id: reservation.eventId } });
    if (event && (event.availableTickets ?? 0) <= 0) {
      await client.event.update({
        where: { id: event.id },
        data: { status: EventStatus.SOLD_OUT },
      });
    }
  }

  async releaseReservation(reservation: any, tx?: any): Promise<void> {
    const run = async (client: any) => {
      const [locked] = await client.$queryRaw<any[]>`
        SELECT * FROM reservations WHERE id = ${reservation.id}::uuid FOR UPDATE
      `;
      if (!locked) return;
      const status = String(locked.status);
      if (status !== ReservationStatus.PENDING && status !== ReservationStatus.CONFIRMED) {
        return;
      }

      const items = await client.reservationItem.findMany({
        where: { reservationId: reservation.id },
      });

      const seatIds = items
        .filter((i: any) => i.seatId)
        .map((i: any) => i.seatId as string);
      if (seatIds.length > 0) {
        await client.seat.updateMany({
          where: { id: { in: seatIds } },
          data: { status: SeatStatus.AVAILABLE },
        });
      }

      await client.reservation.update({
        where: { id: reservation.id },
        data: { status: ReservationStatus.CANCELLED, cancelledAt: new Date() },
      });

      await client.reservationItem.updateMany({
        where: { reservationId: reservation.id },
        data: { status: ReservationItemStatus.CANCELLED },
      });

      const tickets = await client.ticket.findMany({
        where: { reservationId: reservation.id },
        select: { id: true },
      });
      if (tickets.length > 0) {
        await client.ticket.updateMany({
          where: { reservationId: reservation.id, status: TicketStatus.VALID },
          data: { status: TicketStatus.CANCELLED, cancelledAt: new Date() },
        });
        await client.resaleListing.updateMany({
          where: {
            ticketId: { in: tickets.map((t: any) => t.id) },
            status: { in: [ResaleStatus.LISTED, ResaleStatus.LOCKED] },
          },
          data: { status: ResaleStatus.CANCELLED, cancelledAt: new Date() },
        });
      }

      const tierIds = [...new Set(items.map((i: any) => i.tierId))] as string[];
      for (const tierId of tierIds) {
        const count = items.filter((i: any) => i.tierId === tierId).length;
        await client.ticketTier.update({
          where: { id: tierId },
          data: { availableQuantity: { increment: count } },
        });
      }
      await client.event.update({
        where: { id: reservation.eventId },
        data: {
          availableTickets: {
            increment: locked.ticket_count || items.length,
          },
        },
      });

      const event = await client.event.findUnique({ where: { id: reservation.eventId } });
      if (event?.status === EventStatus.SOLD_OUT && (event.availableTickets ?? 0) > 0) {
        await client.event.update({
          where: { id: event.id },
          data: { status: EventStatus.ON_SALE },
        });
      }
    };

    if (tx) {
      await run(tx);
    } else {
      await this.prisma.$transaction(run, { isolationLevel: 'Serializable' });
    }
  }

  async getReservationEntity(reservationId: string, tx?: any): Promise<any> {
    const client = tx ?? this.prisma;
    const reservation = await client.reservation.findUnique({
      where: { id: reservationId },
      include: {
        event: true,
        items: { include: { seat: true, tier: true } },
        coupon: true,
      },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');
    return reservation;
  }

  async extendExpiry(reservation: any, minutes: number, tx?: any): Promise<void> {
    const client = tx ?? this.prisma;
    await client.reservation.update({
      where: { id: reservation.id },
      data: { expiresAt: new Date(Date.now() + minutes * 60 * 1000) },
    });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async cleanupExpiredReservations(): Promise<void> {
    const expiredReservations = await this.prisma.reservation.findMany({
      where: {
        status: ReservationStatus.PENDING,
        expiresAt: { lt: new Date() },
      },
      include: {
        items: { include: { seat: true, tier: true } },
      },
    });

    for (const reservation of expiredReservations) {
      try {
        await this.releaseReservation(reservation);
        this.logger.log(`Released expired reservation ${reservation.id}`);
      } catch (err) {
        this.logger.error(`Failed to release reservation ${reservation.id}: ${err.message}`);
      }
    }

    if (expiredReservations.length > 0) {
      this.logger.log(`Cleaned up ${expiredReservations.length} expired reservations`);
    }
  }

  private toResponse(
    r: any,
    items: any[],
    event?: any,
  ): ReservationResponseDto {
    return {
      id: r.id,
      eventId: r.eventId,
      eventName: event?.name ?? null,
      status: r.status,
      totalAmount: Number(r.totalAmount),
      discountAmount: Number(r.discountAmount || 0),
      finalAmount: Number(r.totalAmount) - Number(r.discountAmount || 0),
      couponCode: r.coupon?.code ?? null,
      currency: r.currency || 'USD',
      ticketCount: r.ticketCount || items?.length || 0,
      expiresAt: r.expiresAt,
      confirmedAt: r.confirmedAt,
      cancelledAt: r.cancelledAt,
      items: items?.map((i) => this.toItemResponse(i)) ?? [],
      createdAt: r.createdAt,
    };
  }

  private toItemResponse(i: any): ReservationItemResponseDto {
    return {
      id: i.id,
      tierName: i.tier?.name ?? null,
      section: i.seat?.section ?? null,
      rowName: i.seat?.rowName ?? null,
      seatNumber: i.seat?.seatNumber ?? null,
      seatLabel: i.seat
        ? `${i.seat.section}-${i.seat.rowName}-${i.seat.seatNumber}`
        : null,
      priceAtBooking: Number(i.priceAtBooking),
    };
  }
}
