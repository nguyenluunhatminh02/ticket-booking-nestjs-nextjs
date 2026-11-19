import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Event, Ticket } from '../entities';
import { TicketStatus } from '../entities/enums';
import { LivestreamTokenResponseDto } from '../dto/response/livestream-response.dto';

@Injectable()
export class LivestreamService {
  constructor(
    private prisma: PrismaService,
  ) {}

  async getLivestreamToken(eventId: string, userId: string): Promise<LivestreamTokenResponseDto> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    // Verify user has valid ticket
    const hasAccess = await this.checkAccess(eventId, userId);
    if (!hasAccess) {
      throw new ForbiddenException('You need a valid ticket to access the livestream');
    }

    // Generate placeholder tokens (would use Mux or similar in production)
    const token = Buffer.from(
      JSON.stringify({ eventId, userId, exp: Date.now() + 3600000 }),
    ).toString('base64');

    return {
      playbackId: event.muxPlaybackId || `placeholder-${eventId}`,
      playbackToken: token,
      thumbnailToken: token,
      storyboardToken: token,
      eventName: event.name,
      expiresInSeconds: 3600,
    };
  }

  async checkAccess(eventId: string, userId: string): Promise<boolean> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { eventId, userId, status: TicketStatus.VALID },
    });
    return !!ticket;
  }

  async getStreamStatus(eventId: string): Promise<{ isLive: boolean; viewerCount: number }> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    return {
      isLive: !!event.streamingUrl,
      viewerCount: 0, // Would come from Mux or WebSocket tracking
    };
  }
}
