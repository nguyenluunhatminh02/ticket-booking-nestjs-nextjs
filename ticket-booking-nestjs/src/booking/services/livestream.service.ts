import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../prisma/prisma.service';
import { Event, Ticket } from '../entities';
import { TicketStatus } from '../entities/enums';
import { LivestreamTokenResponseDto } from '../dto/response/livestream-response.dto';

@Injectable()
export class LivestreamService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async getLivestreamToken(eventId: string, userId: string): Promise<LivestreamTokenResponseDto> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    // Verify user has valid ticket
    const hasAccess = await this.checkAccess(eventId, userId);
    if (!hasAccess) {
      throw new ForbiddenException('You need a valid ticket to access the livestream');
    }

    // Mux signed playback IDs require an RS256 JWT. A plain base64 JSON blob
    // is forgeable and must never be used for access control.
    const tokenId = this.configService.get<string>('MUX_TOKEN_ID');
    const tokenSecret = this.configService.get<string>('MUX_TOKEN_SECRET');
    if (!tokenId || !tokenSecret || tokenSecret.startsWith('your-')) {
      throw new BadRequestException('Mux playback is not configured');
    }

    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = jwt.sign(
      {
        sub: `${eventId}:${userId}`,
        aud: 'v',
        exp,
        kid: tokenId,
      },
      tokenSecret.replace(/\\n/g, '\n'),
      { algorithm: 'RS256', keyid: tokenId },
    );

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
