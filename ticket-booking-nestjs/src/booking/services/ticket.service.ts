import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Ticket, Reservation, Event } from '../entities';
import { TicketStatus } from '../entities/enums';
import { TicketResponseDto } from '../dto/response/ticket-response.dto';
import { User } from '../../auth/entities/user.entity';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TicketService {
  constructor(
    private prisma: PrismaService,
  ) {}

  async issueTicketsForReservation(reservation: Reservation, tx?: any): Promise<Ticket[]> {
    const client = tx ?? this.prisma;
    const existing = await client.ticket.findMany({ where: { reservationId: reservation.id } });
    if (existing.length > 0) return existing as unknown as Ticket[];
    const tickets: Ticket[] = [];
    for (const item of (reservation.items ?? [])) {
      const ticketCode = 'TKT-' + uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
      const qrData = JSON.stringify({
        ticketCode,
        eventId: reservation.eventId,
        tierId: item.tierId,
        seatId: item.seatId,
        ts: Date.now(),
      });

      const ticket = await client.ticket.create({
        data: {
          ticketCode,
          reservationId: reservation.id,
          userId: reservation.userId,
          eventId: reservation.eventId,
          tierId: item.tierId,
          seatId: item.seatId,
          qrCodeData: qrData,
          status: TicketStatus.VALID as any,
          tierName: item.tier?.name,
          seatLabel: item.seat?.rowName
            ? `${item.seat.rowName}${item.seat.seatNumber}`
            : item.seat
              ? `Seat ${item.seat.seatNumber}`
              : null,
          price: item.priceAtBooking,
          currency: reservation.currency || 'USD',
        },
      });
      tickets.push(ticket as unknown as Ticket);
    }
    return tickets;
  }

  async getMyTickets(
    userId: string,
    page = 0,
    size = 20,
  ): Promise<{ content: TicketResponseDto[]; totalElements: number; totalPages: number }> {
    const where = { userId };
    const [tickets, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        include: { event: { include: { venue: true } }, tier: true },
        orderBy: { issuedAt: 'desc' },
        skip: page * size,
        take: size,
      }),
      this.prisma.ticket.count({ where }),
    ]);
    return {
      content: tickets.map((t) => this.toResponse(t as unknown as Ticket)),
      totalElements: total,
      totalPages: Math.ceil(total / size),
    };
  }

  async getTicketByCode(ticketCode: string, userId?: string): Promise<TicketResponseDto> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { ticketCode },
      include: { event: { include: { venue: true } }, tier: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (userId && ticket.userId !== userId) {
      throw new BadRequestException('Not authorized to view this ticket');
    }
    return this.toResponse(ticket as unknown as Ticket);
  }

  async getTicketsByEvent(
    eventId: string,
    page = 0,
    size = 20,
  ): Promise<{ content: TicketResponseDto[]; totalElements: number; totalPages: number }> {
    const where = { eventId };
    const [tickets, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        include: { event: { include: { venue: true } }, tier: true },
        orderBy: { issuedAt: 'desc' },
        skip: page * size,
        take: size,
      }),
      this.prisma.ticket.count({ where }),
    ]);
    return {
      content: tickets.map((t) => this.toResponse(t as unknown as Ticket)),
      totalElements: total,
      totalPages: Math.ceil(total / size),
    };
  }

  async cancelTicket(ticketCode: string, userId: string): Promise<TicketResponseDto> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { ticketCode },
      include: { event: { include: { venue: true } }, tier: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.userId !== userId) throw new BadRequestException('Not authorized');
    if (ticket.status !== TicketStatus.VALID) {
      throw new BadRequestException('Only VALID tickets can be cancelled');
    }
    const updated = await this.prisma.ticket.update({
      where: { ticketCode },
      data: { status: TicketStatus.CANCELLED as any, cancelledAt: new Date() },
      include: { event: { include: { venue: true } }, tier: true },
    });
    return this.toResponse(updated as unknown as Ticket);
  }

  async getQrCode(ticketCode: string, userId: string): Promise<Buffer> {
    const ticket = await this.prisma.ticket.findUnique({ where: { ticketCode } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.userId !== userId) throw new BadRequestException('Not authorized');
    // Return simple QR data as base64 PNG placeholder
    // In production, use a QR library like qrcode
    const QRCode = require('qrcode');
    return QRCode.toBuffer(ticket.qrCodeData || ticket.ticketCode);
  }

  async getDynamicQr(ticketCode: string, userId: string): Promise<{ code: string; expiresAt: Date }> {
    const ticket = await this.prisma.ticket.findUnique({ where: { ticketCode } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.userId !== userId) throw new BadRequestException('Not authorized');

    // Generate a TOTP-like rotating code (simplified)
    const timeSlot = Math.floor(Date.now() / 30000); // 30-second window
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', ticket.ticketCode);
    hmac.update(String(timeSlot));
    const code = hmac.digest('hex').substring(0, 8).toUpperCase();
    const expiresAt = new Date((timeSlot + 1) * 30000);

    return { code, expiresAt };
  }

  async getTicketEntity(ticketCode: string): Promise<Ticket> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { ticketCode },
      include: { event: { include: { venue: true } }, tier: true, user: true, seat: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket as unknown as Ticket;
  }

  async getTicketEntityById(ticketId: string): Promise<Ticket> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { event: { include: { venue: true } }, tier: true, user: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket as unknown as Ticket;
  }

  toResponse(t: Ticket): TicketResponseDto {
    return {
      id: t.id,
      ticketCode: t.ticketCode,
      eventId: t.eventId,
      eventName: t.event?.name ?? null,
      eventCoverImageUrl: t.event?.coverImageUrl ?? null,
      eventDate: t.event?.eventDate ?? null,
      venueName: t.event?.venue?.name ?? null,
      venueAddress: t.event?.venue?.address ?? null,
      eventMode: t.event?.eventMode ?? null,
      hasLivestream: !!t.event?.muxPlaybackId,
      tierName: t.tierName ?? t.tier?.name ?? null,
      seatLabel: t.seatLabel,
      price: Number(t.price),
      currency: t.currency,
      status: t.status,
      qrCodeData: t.qrCodeData,
      issuedAt: t.issuedAt,
      usedAt: t.usedAt,
      expiresAt: t.expiresAt,
    };
  }
}
