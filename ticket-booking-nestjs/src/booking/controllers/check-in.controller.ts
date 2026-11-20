import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { CurrentUser, Roles } from '../../common/decorators';
import { User } from '../../auth/entities/user.entity';
import { CheckInService } from '../services/check-in.service';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('check-in')
export class CheckInController {
  constructor(
    private readonly checkInService: CheckInService,
    private readonly prisma: PrismaService,
  ) {}

  @Roles('ROLE_ADMIN', 'ROLE_ORGANIZER')
  @Post()
  async checkIn(
    @Body('ticketCode') ticketCode: string,
    @CurrentUser() user: User,
  ) {
    // Verify organizer owns the event for this ticket
    const roles: string[] = (user as any).roles || [];
    const isAdmin = roles.includes('ROLE_ADMIN');

    if (!isAdmin) {
      const ticket = await this.prisma.ticket.findUnique({
        where: { ticketCode },
        include: { event: true },
      });
      if (!ticket || ticket.event.createdById !== user.id) {
        throw new ForbiddenException('You do not have access to check in this ticket');
      }
    }

    return this.checkInService.checkIn(ticketCode, user.id);
  }

  @Roles('ROLE_ADMIN', 'ROLE_ORGANIZER')
  @Get('stats/:eventId')
  async getStats(
    @Param('eventId') eventId: string,
    @CurrentUser() user: User,
  ) {
    const roles: string[] = (user as any).roles || [];
    const isAdmin = roles.includes('ROLE_ADMIN');

    if (!isAdmin) {
      const event = await this.prisma.event.findUnique({ where: { id: eventId } });
      if (!event || event.createdById !== user.id) {
        throw new ForbiddenException('You do not have access to this event');
      }
    }

    return this.checkInService.getCheckInStats(eventId);
  }

  @Roles('ROLE_ADMIN', 'ROLE_ORGANIZER')
  @Get('recent/:eventId')
  async getRecent(
    @Param('eventId') eventId: string,
    @Query('limit') limit: string,
    @CurrentUser() user: User,
  ) {
    const roles: string[] = (user as any).roles || [];
    const isAdmin = roles.includes('ROLE_ADMIN');

    if (!isAdmin) {
      const event = await this.prisma.event.findUnique({ where: { id: eventId } });
      if (!event || event.createdById !== user.id) {
        throw new ForbiddenException('You do not have access to this event');
      }
    }

    return this.checkInService.getRecentCheckIns(eventId, parseInt(limit) || 50);
  }
}
