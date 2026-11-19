import {
  Controller,
  Get,
  Param,
} from '@nestjs/common';
import { LivestreamService } from '../services/livestream.service';
import { CurrentUser } from '../../common/decorators';
import { User } from '../../auth/entities/user.entity';

@Controller('livestream')
export class LivestreamController {
  constructor(private readonly livestreamService: LivestreamService) {}

  @Get(':eventId/token')
  async getToken(
    @Param('eventId') eventId: string,
    @CurrentUser() user: User,
  ) {
    return this.livestreamService.getLivestreamToken(eventId, user.id);
  }

  @Get(':eventId/access')
  async checkAccess(
    @Param('eventId') eventId: string,
    @CurrentUser() user: User,
  ) {
    const hasAccess = await this.livestreamService.checkAccess(eventId, user.id);
    return { hasAccess, eventId };
  }
}
