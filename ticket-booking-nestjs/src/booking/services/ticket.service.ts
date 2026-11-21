import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Ticket, Reservation, Event } from '../entities';
import { TicketStatus } from '../entities/enums';
import { TicketResponseDto } from '../dto/response/ticket-response.dto';
import { User } from '../../auth/entities/user.entity';
import { PrismaService } from '../../prisma/prisma.service';

/** 30-second rotation window. The immediately preceding slot is also accepted
 * to tolerate a code generated just before a roll or slight clock skew. */
export const DYNAMIC_QR_WINDOW_MS = 30_000;

/** 128 bits of randomness: 32 hex chars, keeping the human-readable TKT- prefix. */
function generateTicketCode(): string {
  return `TKT-${uuidv4().replace(/-/g, '').toUpperCase()}`;
}

function isTicketCodeCollision(error: any): boolean {
  // Prisma P2002 = unique constraint violation; only retry when the ticket code is the culprit.
  return error?.code === 'P2002'
    && (error?.meta?.target == null || String(error.meta.target).includes('ticket'));
}

/** Canonical, unambiguous payload representation shared by generation and verification. */
export interface DynamicQrClaims {
  ticketId: string;
  eventId: string;
  timeSlot: number;
  expiresAt: number;
}

/** Fields needed to render/verify a QR. Raw lock rows use snake_case, Prisma rows camelCase. */
export interface DynamicQrTicket {
  id: string;
  ticketCode?: string;
  ticket_code?: string;
  eventId?: string;
  event_id?: string;
}

/** Fail closed if the server-side secret is absent: never fall back to public data. */
export function getDynamicQrSecret(configService?: ConfigService): string {
  const secret = configService?.get<string>('QR_SECRET');
  if (!secret || typeof secret !== 'string' || secret.trim().length === 0) {
    throw new BadRequestException('Dynamic QR is unavailable: QR_SECRET is not configured');
  }
  return secret;
}

/** code = HMAC-SHA256(payload, secret).hex.slice(0, 12).toUpperCase() */
export function computeDynamicQrCode(claims: DynamicQrClaims, secret: string): string {
  const payload = `${claims.ticketId}|${claims.eventId}|${claims.timeSlot}|${claims.expiresAt}`;
  return createHmac('sha256', secret).update(payload).digest('hex').slice(0, 12).toUpperCase();
}

/**
 * Constant-time verification of a dynamic QR code.
 * Accepts the current slot and the previous slot (30s tolerance); rejects codes
 * that are expired, malformed, or bound to a different ticket/event.
 */
export function verifyDynamicQrCode(
  ticket: DynamicQrTicket,
  code: string,
  secret: string,
  now: number = Date.now(),
): boolean {
  const ticketId = ticket?.id;
  const eventId = ticket?.eventId ?? ticket?.event_id;
  if (!ticketId || !eventId || typeof code !== 'string') return false;

  const presented = code.trim().toUpperCase();
  if (!/^[0-9A-F]{12}$/.test(presented)) return false;

  const currentSlot = Math.floor(now / DYNAMIC_QR_WINDOW_MS);
  let matched = false;
  for (const timeSlot of [currentSlot, currentSlot - 1]) {
    const expiresAt = (timeSlot + 1) * DYNAMIC_QR_WINDOW_MS;
    // A previous-slot code is valid for one additional window after its expiry.
    const effectiveExpiry = expiresAt + (timeSlot === currentSlot ? 0 : DYNAMIC_QR_WINDOW_MS);
    if (effectiveExpiry <= now) continue;

    const expected = computeDynamicQrCode({ ticketId, eventId, timeSlot, expiresAt }, secret);
    // Accumulate instead of short-circuiting so both slots are always compared.
    matched = timingSafeEqual(Buffer.from(expected, 'ascii'), Buffer.from(presented, 'ascii')) || matched;
  }
  return matched;
}

@Injectable()
export class TicketService {
  constructor(
    private prisma: PrismaService,
    // Optional to keep legacy direct instantiations working; Nest injects ConfigService.
    private configService?: ConfigService,
  ) {}

  async issueTicketsForReservation(reservation: Reservation, tx?: any): Promise<Ticket[]> {
    const client = tx ?? this.prisma;
    const existing = await client.ticket.findMany({ where: { reservationId: reservation.id } });
    if (existing.length > 0) return existing as unknown as Ticket[];
    const tickets: Ticket[] = [];
    for (const item of (reservation.items ?? [])) {
      let created: any;
      // A 128-bit code makes collisions negligible; retry a few times if one still occurs.
      for (let attempt = 0; attempt < 3; attempt++) {
        const ticketCode = generateTicketCode();
        const qrData = JSON.stringify({
          ticketCode,
          eventId: reservation.eventId,
          tierId: item.tierId,
          seatId: item.seatId,
          ts: Date.now(),
        });

        try {
          created = await client.ticket.create({
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
          break;
        } catch (error: any) {
          if (!isTicketCodeCollision(error) || attempt === 2) throw error;
        }
      }
      tickets.push(created as unknown as Ticket);
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

  /** Server-side secret + ticket/event identity + time slot. The public ticket
   * code is never used as an HMAC key (it is printed on every ticket). */
  async getDynamicQr(ticketCode: string, userId: string): Promise<{ code: string; expiresAt: Date }> {
    const ticket = await this.prisma.ticket.findUnique({ where: { ticketCode } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.userId !== userId) throw new BadRequestException('Not authorized');

    const now = Date.now();
    const timeSlot = Math.floor(now / DYNAMIC_QR_WINDOW_MS);
    const expiresAt = (timeSlot + 1) * DYNAMIC_QR_WINDOW_MS;
    const secret = getDynamicQrSecret(this.configService);
    const code = computeDynamicQrCode(
      { ticketId: ticket.id, eventId: ticket.eventId, timeSlot, expiresAt },
      secret,
    );

    return { code, expiresAt: new Date(expiresAt) };
  }

  /** Verifier used by check-in against the locked ticket row. */
  checkDynamicQr(ticket: DynamicQrTicket, code: string, now: number = Date.now()): boolean {
    const secret = getDynamicQrSecret(this.configService);
    return verifyDynamicQrCode(ticket, code, secret, now);
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
