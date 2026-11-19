import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  DefaultValuePipe,
  ParseIntPipe,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { TicketService } from '../services/ticket.service';
import { CurrentUser, Roles } from '../../common/decorators';
import { User } from '../../auth/entities/user.entity';

@Controller('tickets')
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Get('my')
  async getMyTickets(
    @CurrentUser() user: User,
    @Query('page', new DefaultValuePipe(0), ParseIntPipe) page: number,
    @Query('size', new DefaultValuePipe(20), ParseIntPipe) size: number,
  ) {
    return this.ticketService.getMyTickets(user.id, page, size);
  }

  @Roles('ROLE_ADMIN', 'ROLE_ORGANIZER')
  @Get('event/:eventId')
  async getTicketsByEvent(
    @Param('eventId') eventId: string,
    @Query('page', new DefaultValuePipe(0), ParseIntPipe) page: number,
    @Query('size', new DefaultValuePipe(20), ParseIntPipe) size: number,
  ) {
    return this.ticketService.getTicketsByEvent(eventId, page, size);
  }

  @Get(':ticketCode')
  async getTicketByCode(@Param('ticketCode') ticketCode: string, @CurrentUser() user: User) {
    const roles: string[] = (user as any).roles || [];
    const privileged = roles.includes('ROLE_ADMIN') || roles.includes('ROLE_ORGANIZER');
    return this.ticketService.getTicketByCode(ticketCode, privileged ? undefined : user.id);
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
    @Res() res: Response,
  ) {
    const buffer = await this.ticketService.getQrCode(ticketCode, user.id);
    res.set({ 'Content-Type': 'image/png' });
    res.send(buffer);
  }

  @Get(':ticketCode/dynamic-qr')
  async getDynamicQr(
    @Param('ticketCode') ticketCode: string,
    @CurrentUser() user: User,
  ) {
    return this.ticketService.getDynamicQr(ticketCode, user.id);
  }
}
