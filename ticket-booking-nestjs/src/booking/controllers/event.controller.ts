import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { Public } from '../../common/decorators';
import { EventService } from '../services/event.service';
import { CreateEventDto, CreateTicketTierDto } from '../dto';
import { CurrentUser, Roles } from '../../common/decorators';
import { User } from '../../auth/entities/user.entity';

@Controller('events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Public()
  @Get()
  async listEvents(
    @Query('page', new DefaultValuePipe(0), ParseIntPipe) page: number,
    @Query('size', new DefaultValuePipe(20), ParseIntPipe) size: number,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('city') city?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const statuses = status ? status.split(',') : undefined;
    return this.eventService.listEvents(statuses, category as any, city, dateFrom, dateTo, page, size);
  }

  @Public()
  @Get('search')
  async searchEvents(@Query('q') query: string) {
    return this.eventService.searchEvents(query || '');
  }

  @Public()
  @Get(':eventId')
  async getEvent(@Param('eventId') eventId: string) {
    return this.eventService.getEvent(eventId);
  }

  @Public()
  @Get(':eventId/seats')
  async getSeatMap(@Param('eventId') eventId: string) {
    return this.eventService.getSeatMap(eventId);
  }

  @Roles('ROLE_ADMIN', 'ROLE_ORGANIZER')
  @Post()
  async createEvent(@Body() dto: CreateEventDto, @CurrentUser() user: User) {
    return this.eventService.createEvent(dto, user);
  }

  @Roles('ROLE_ADMIN', 'ROLE_ORGANIZER')
  @Put(':eventId')
  async updateEvent(
    @Param('eventId') eventId: string,
    @Body() dto: Partial<CreateEventDto>,
    @CurrentUser() user: User,
  ) {
    return this.eventService.updateEvent(eventId, dto, user);
  }

  @Roles('ROLE_ADMIN', 'ROLE_ORGANIZER')
  @Post(':eventId/publish')
  async publishEvent(@Param('eventId') eventId: string, @CurrentUser() user: User) {
    return this.eventService.publishEvent(eventId, user);
  }

  @Roles('ROLE_ADMIN', 'ROLE_ORGANIZER')
  @Post(':eventId/cancel')
  async cancelEvent(@Param('eventId') eventId: string, @CurrentUser() user: User) {
    return this.eventService.cancelEvent(eventId, user);
  }

  @Roles('ROLE_ADMIN', 'ROLE_ORGANIZER')
  @Post(':eventId/tiers')
  async addTicketTier(
    @Param('eventId') eventId: string,
    @Body() dto: CreateTicketTierDto,
    @CurrentUser() user: User,
  ) {
    return this.eventService.addTicketTier(eventId, dto, user);
  }
}
