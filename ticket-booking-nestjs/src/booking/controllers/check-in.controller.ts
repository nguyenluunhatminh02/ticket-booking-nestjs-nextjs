import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { CheckInService } from '../services/check-in.service';
import { CheckInDto } from '../dto';
import { CurrentUser, Roles } from '../../common/decorators';
import { User } from '../../auth/entities/user.entity';

@Controller('check-in')
export class CheckInController {
  constructor(private readonly checkInService: CheckInService) {}

  @Roles('ROLE_ADMIN', 'ROLE_ORGANIZER')
  @Post()
  async checkIn(@Body() dto: CheckInDto, @CurrentUser() user: User) {
    return this.checkInService.checkIn(dto, user);
  }

  @Roles('ROLE_ADMIN', 'ROLE_ORGANIZER')
  @Get('event/:eventId')
  async getCheckInsByEvent(
    @Param('eventId') eventId: string,
    @Query('page', new DefaultValuePipe(0), ParseIntPipe) page: number,
    @Query('size', new DefaultValuePipe(20), ParseIntPipe) size: number,
  ) {
    return this.checkInService.getCheckInsByEvent(eventId, page, size);
  }

  @Roles('ROLE_ADMIN', 'ROLE_ORGANIZER')
  @Get('event/:eventId/count')
  async getCheckInCount(@Param('eventId') eventId: string) {
    return this.checkInService.getCheckInCount(eventId);
  }
}
