import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  ForbiddenException,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { CurrentUser, Roles } from '../../common/decorators';
import { User } from '../../auth/entities/user.entity';
import { CheckInService } from '../services/check-in.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CheckInDto } from '../dto';

@Controller('check-in')
export class CheckInController {
  constructor(
    private readonly checkInService: CheckInService,
    private readonly prisma: PrismaService,
  ) {}

  @Roles('ROLE_ADMIN', 'ROLE_ORGANIZER')
  @Post()
  async checkIn(
    @Body() dto: CheckInDto,
    @CurrentUser() user: User,
  ) {
    const roles: string[] = (user as any).roles || [];
    const isAdmin = roles.includes('ROLE_ADMIN');

    if (!isAdmin) {
      const ticket = await this.prisma.ticket.findUnique({
        where: { ticketCode: dto.ticketCode },
        include: { event: true },
      });
      if (!ticket || ticket.event.createdById !== user.id) {
        throw new ForbiddenException('You do not have access to check in this ticket');
      }
    }

    return this.checkInService.checkIn(dto, user);
  }

  @Roles('ROLE_ADMIN', 'ROLE_ORGANIZER')
  @Get('event/:eventId')
  async getCheckInsByEvent(
    @Param('eventId') eventId: string,
    @Query('page', new DefaultValuePipe(0), ParseIntPipe) page: number,
    @Query('size', new DefaultValuePipe(50), ParseIntPipe) size: number,
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

    return this.checkInService.getCheckInsByEvent(eventId, page, size);
  }

  @Roles('ROLE_ADMIN', 'ROLE_ORGANIZER')
  @Get('event/:eventId/count')
  async getCheckInCount(
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

    return this.checkInService.getCheckInCount(eventId);
  }
}
