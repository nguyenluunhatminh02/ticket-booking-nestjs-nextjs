import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { Public } from '../../common/decorators';
import { OrganizerService } from '../services/organizer.service';
import { CreateOrganizerDto } from '../dto';
import { CurrentUser, Roles } from '../../common/decorators';
import { User } from '../../auth/entities/user.entity';

@Controller('organizers')
export class OrganizerController {
  constructor(private readonly organizerService: OrganizerService) {}

  @Public()
  @Get()
  async listOrganizers(
    @Query('search') search?: string,
    @Query('page', new DefaultValuePipe(0), ParseIntPipe) page?: number,
    @Query('size', new DefaultValuePipe(20), ParseIntPipe) size?: number,
  ) {
    return this.organizerService.listOrganizers(search, page, size);
  }

  @Public()
  @Get(':id')
  async getOrganizer(@Param('id') id: string) {
    return this.organizerService.getOrganizer(id);
  }

  @Roles('ROLE_ADMIN', 'ROLE_ORGANIZER')
  @Post()
  async createOrganizer(@Body() dto: CreateOrganizerDto, @CurrentUser() user: User) {
    return this.organizerService.createOrganizer(dto, user);
  }

  @Post(':organizerId/follow')
  async followOrganizer(
    @Param('organizerId') organizerId: string,
    @CurrentUser() user: User,
  ) {
    return this.organizerService.followOrganizer(organizerId, user);
  }

  @Delete(':organizerId/follow')
  async unfollowOrganizer(
    @Param('organizerId') organizerId: string,
    @CurrentUser() user: User,
  ) {
    return this.organizerService.unfollowOrganizer(organizerId, user);
  }
}
