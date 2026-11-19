import {
  Controller,
  Get,
  Post,
  Param,
} from '@nestjs/common';
import { QueueService } from '../services/queue.service';
import { CurrentUser } from '../../common/decorators';
import { User } from '../../auth/entities/user.entity';

@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Post('join/:eventId')
  async joinQueue(@Param('eventId') eventId: string, @CurrentUser() user: User) {
    return this.queueService.joinQueue(eventId, user);
  }

  @Get('position/:queueToken')
  async getPosition(@Param('queueToken') queueToken: string, @CurrentUser() user: User) {
    return this.queueService.getQueuePosition(queueToken, user.id);
  }

  @Post('leave/:queueToken')
  async leaveQueue(@Param('queueToken') queueToken: string, @CurrentUser() user: User) {
    await this.queueService.leaveQueue(queueToken, user.id);
    return { message: 'Left queue' };
  }
}
