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
import { Public, Roles } from '../../common/decorators';
import { VenueService } from '../services/venue.service';
import { CreateVenueDto } from '../dto';

@Controller('venues')
export class VenueController {
  constructor(private readonly venueService: VenueService) {}

  @Public()
  @Get()
  async listVenues(
    @Query('city') city?: string,
    @Query('country') country?: string,
  ) {
    return this.venueService.listVenues(city, country);
  }

  @Public()
  @Get(':venueId')
  async getVenue(@Param('venueId') venueId: string) {
    return this.venueService.getVenue(venueId);
  }

  @Roles('ROLE_ADMIN', 'ROLE_ORGANIZER')
  @Post()
  async createVenue(@Body() dto: CreateVenueDto) {
    return this.venueService.createVenue(dto);
  }
}
