import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { CurrentUser, Roles } from '../../common/decorators';
import { User } from '../../auth/entities/user.entity';
import { TicketService } from '../services/ticket.service';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('tickets')
export class TicketController {
  constructor(
    private readonly ticketService: TicketService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('my')
  async getMyTickets(@CurrentUser() user: User) {
    return this.ticketService.getMyTickets(user.id, 0, 100);
  }

  @Roles('ROLE_ADMIN', 'ROLE_ORGANIZER')
  @Get('event/:eventId')
  async getTicketsByEvent(
    @Param('eventId') eventId: string,
    @CurrentUser() user: User,
  ) {
    // Resource authorization: organizer must own the event
    const roles: string[] = (user as any).roles || [];
    const isAdmin = roles.includes('ROLE_ADMIN');
    if (!isAdmin) {
      const event = await this.prisma.event.findUnique({ where: { id: eventId } });
      if (!event || event.createdById !== user.id) {
        throw new ForbiddenException('You do not have access to this event');
      }
    }
    return this.ticketService.getTicketsByEvent(eventId);
  }

  @Get(':ticketCode')
  async getTicketByCode(
    @Param('ticketCode') ticketCode: string,
    @CurrentUser() user: User,
  ) {
    const roles: string[] = (user as any).roles || [];
    const isAdmin = roles.includes('ROLE_ADMIN');
    const isOrganizer = roles.includes('ROLE_ORGANIZER');

    if (isAdmin) {
      return this.ticketService.getTicketByCode(ticketCode);
    }

    if (isOrganizer) {
      // Organizer can view ticket if they own the event
      const ticket = await this.prisma.ticket.findUnique({
        where: { ticketCode },
        include: { event: true },
      });
      if (!ticket || ticket.event.createdById !== user.id) {
        throw new ForbiddenException('You do not have access to this ticket');
      }
      return this.ticketService.getTicketByCode(ticketCode);
    }

    // Regular user can only view their own tickets
    return this.ticketService.getTicketByCode(ticketCode, user.id);
  }

  @Post(':ticketCode/cancel')
  async cancelTicket(
    @Param('ticketCode') ticketCode: string,
    @CurrentUser() user: User,
  ) {
    return this.ticketService.cancelTicket(ticketCode, user.id);
  }

  @Get(':ticketCode/qr')
  async getQrCode(
    @Param('ticketCode') ticketCode: string,
    @CurrentUser() user: User,
  ) {
    return this.ticketService.getQrCode(ticketCode, user.id);
  }

  @Get(':ticketCode/dynamic-qr')
  async getDynamicQr(
    @Param('ticketCode') ticketCode: string,
    @CurrentUser() user: User,
  ) {
    return this.ticketService.getDynamicQr(ticketCode, user.id);
  }
}
