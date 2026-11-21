import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TicketStatus } from '../entities/enums';
import { CheckInDto } from '../dto';
import { CheckInResponseDto } from '../dto/response/check-in-response.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { verifyDynamicQrCode } from './ticket.service';

@Injectable()
export class CheckInService {
  constructor(
    private prisma: PrismaService,
    private configService?: ConfigService,
  ) {}

  private verifyQr(ticket: any, presentedCode: string): boolean {
    const secret = this.configService?.get<string>('QR_SECRET');
    if (!secret || typeof secret !== 'string' || secret.trim().length === 0) {
      throw new BadRequestException('Dynamic QR is unavailable: QR_SECRET is not configured');
    }
    return verifyDynamicQrCode(ticket, presentedCode, secret);
  }

  async checkIn(dto: CheckInDto, checkedInBy: any): Promise<CheckInResponseDto> {
    // Use transaction with pessimistic lock to prevent double check-in
    return this.prisma.$transaction(async (tx) => {
      const [ticket] = await tx.$queryRaw<any[]>`
        SELECT * FROM tickets WHERE ticket_code = ${dto.ticketCode} FOR UPDATE
      `;

      if (!ticket) {
        return this.failedResponse(dto.ticketCode, 'Ticket not found');
      }
      // Verify the rotating code against the locked row BEFORE any state change.
      // A QR code is mandatory: there is no path that marks a ticket USED without it.
      if (!this.verifyQr(ticket, dto.qrCode)) {
        return this.failedResponse(dto.ticketCode, 'Invalid or expired QR code');
      }
      if (ticket.status === TicketStatus.USED) {
        return this.failedResponse(dto.ticketCode, 'Ticket already used');
      }
      if (ticket.status === TicketStatus.CANCELLED) {
        return this.failedResponse(dto.ticketCode, 'Ticket is cancelled');
      }
      if (ticket.status === TicketStatus.EXPIRED) {
        return this.failedResponse(dto.ticketCode, 'Ticket is expired');
      }
      if (ticket.status !== TicketStatus.VALID) {
        return this.failedResponse(dto.ticketCode, `Invalid ticket status: ${ticket.status}`);
      }

      // Mark ticket as used atomically within the lock
      await tx.ticket.update({
        where: { id: ticket.id },
        data: { status: TicketStatus.USED, usedAt: new Date() },
      });

      // Load related data for the response
      const ticketWithRelations = await tx.ticket.findUnique({
        where: { id: ticket.id },
        include: { event: true, tier: true, user: true },
      });

      // Create check-in record
      const saved = await tx.checkIn.create({
        data: {
          ticketId: ticket.id,
          eventId: ticket.event_id,
          checkedInById: checkedInBy.id,
          checkInLatitude: dto.latitude,
          checkInLongitude: dto.longitude,
          deviceInfo: dto.deviceInfo,
          successful: true,
        },
      });

      return {
        id: saved.id,
        ticketCode: ticketWithRelations!.ticketCode,
        eventName: ticketWithRelations!.event?.name,
        tierName: ticketWithRelations!.tierName ?? ticketWithRelations!.tier?.name,
        seatLabel: ticketWithRelations!.seatLabel,
        attendeeName: ticketWithRelations!.user
          ? `${ticketWithRelations!.user.firstName || ''} ${ticketWithRelations!.user.lastName || ''}`.trim()
          : null,
        attendeeEmail: ticketWithRelations!.user?.email,
        successful: true,
        failureReason: null,
        checkedInAt: saved.checkedInAt,
      };
    }, { isolationLevel: 'Serializable' });
  }

  async getCheckInsByEvent(
    eventId: string,
    page = 0,
    size = 50,
  ): Promise<{ content: CheckInResponseDto[]; totalElements: number; totalPages: number }> {
    const [checkIns, total] = await Promise.all([
      this.prisma.checkIn.findMany({
        where: { eventId },
        include: { ticket: { include: { user: true, tier: true } } },
        orderBy: { checkedInAt: 'desc' },
        skip: page * size,
        take: size,
      }),
      this.prisma.checkIn.count({ where: { eventId } }),
    ]);
    return {
      content: checkIns.map((c) => ({
        id: c.id,
        ticketCode: c.ticket?.ticketCode,
        eventName: null,
        tierName: c.ticket?.tierName ?? c.ticket?.tier?.name,
        seatLabel: c.ticket?.seatLabel,
        attendeeName: c.ticket?.user
          ? `${c.ticket.user.firstName || ''} ${c.ticket.user.lastName || ''}`.trim()
          : null,
        attendeeEmail: c.ticket?.user?.email,
        successful: c.successful,
        failureReason: c.failureReason,
        checkedInAt: c.checkedInAt,
      })),
      totalElements: total,
      totalPages: Math.ceil(total / size),
    };
  }

  async getCheckInCount(eventId: string): Promise<number> {
    return this.prisma.checkIn.count({ where: { eventId, successful: true } });
  }

  private failedResponse(ticketCode: string, reason: string): CheckInResponseDto {
    return {
      id: null,
      ticketCode,
      eventName: null,
      tierName: null,
      seatLabel: null,
      attendeeName: null,
      attendeeEmail: null,
      successful: false,
      failureReason: reason,
      checkedInAt: null,
    };
  }
}
