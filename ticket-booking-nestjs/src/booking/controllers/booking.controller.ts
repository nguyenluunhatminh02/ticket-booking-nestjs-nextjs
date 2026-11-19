import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ReservationService } from '../services/reservation.service';
import { ReserveTicketsDto } from '../dto';
import { CurrentUser } from '../../common/decorators';
import { User } from '../../auth/entities/user.entity';

@Controller('bookings')
export class BookingController {
  constructor(private readonly reservationService: ReservationService) {}

  @Get()
  async getMyReservations(@CurrentUser() user: User) {
    return this.reservationService.getUserReservations(user.id);
  }

  @Get(':reservationId')
  async getReservation(
    @Param('reservationId') reservationId: string,
    @CurrentUser() user: User,
  ) {
    return this.reservationService.getReservation(reservationId, user.id);
  }

  @Post('reserve')
  async reserveTickets(@Body() dto: ReserveTicketsDto, @CurrentUser() user: User) {
    return this.reservationService.reserveTickets(dto, user);
  }

  @Post(':reservationId/cancel')
  async cancelReservation(
    @Param('reservationId') reservationId: string,
    @CurrentUser() user: User,
  ) {
    return this.reservationService.cancelReservation(reservationId, user.id);
  }
}
