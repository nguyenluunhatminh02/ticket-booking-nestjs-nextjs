import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventStatus, TicketStatus } from '../entities/enums';
import { CreateCommentDto } from '../dto';
import { CommentResponseDto } from '../dto/response/comment-response.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CommentService {
  constructor(private prisma: PrismaService) {}

  async canUserComment(
    eventId: string,
    userId: string,
  ): Promise<{ canComment: boolean; reason?: string }> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    if (event.status !== EventStatus.COMPLETED) {
      return { canComment: false, reason: 'Event is not completed yet' };
    }

    const ticket = await this.prisma.ticket.findFirst({
      where: { eventId, userId, status: { in: [TicketStatus.VALID, TicketStatus.USED] } },
    });
    if (!ticket) {
      return { canComment: false, reason: 'You must have a valid ticket to comment' };
    }

    return { canComment: true };
  }

  async createComment(
    eventId: string,
    dto: CreateCommentDto,
    user: any,
  ): Promise<CommentResponseDto> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    // Determine badge
    let badgeType: string | null = null;
    let badgeLabel: string | null = null;
    const ticket = await this.prisma.ticket.findFirst({
      where: { eventId, userId: user.id },
      include: { tier: true },
    });
    if (ticket?.tier) {
      const tierName = ticket.tier.name.toUpperCase();
      if (tierName.includes('VIP') && tierName.includes('V')) {
        badgeType = 'VVIP';
        badgeLabel = 'VVIP';
      } else if (tierName.includes('VIP')) {
        badgeType = 'VIP';
        badgeLabel = 'VIP';
      } else {
        badgeType = 'ATTENDEE';
        badgeLabel = 'Attendee';
      }
    }

    const saved = await this.prisma.comment.create({
      data: {
        eventId,
        userId: user.id,
        content: dto.content,
        rating: dto.rating,
        parentId: dto.parentId,
        badgeType,
        badgeLabel,
      },
    });
    return this.toResponse(saved, user);
  }

  async updateComment(
    eventId: string,
    commentId: string,
    content: string,
    userId: string,
  ): Promise<CommentResponseDto> {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, eventId },
      include: { user: true },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.userId !== userId) throw new BadRequestException('Not authorized');

    const saved = await this.prisma.comment.update({
      where: { id: comment.id },
      data: { content, edited: true },
    });
    return this.toResponse(saved, comment.user);
  }

  async deleteComment(eventId: string, commentId: string, userId: string): Promise<void> {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, eventId },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.userId !== userId) throw new BadRequestException('Not authorized');
    await this.prisma.comment.delete({ where: { id: commentId } });
  }

  async getCommentsByEvent(
    eventId: string,
    page = 0,
    size = 20,
  ): Promise<{ content: CommentResponseDto[]; totalElements: number; totalPages: number }> {
    const where = { eventId, parentId: null };
    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        include: { user: true, replies: { include: { user: true } } },
        orderBy: { createdAt: 'desc' },
        skip: page * size,
        take: size,
      }),
      this.prisma.comment.count({ where }),
    ]);
    return {
      content: comments.map((c) => this.toResponse(c, c.user)),
      totalElements: total,
      totalPages: Math.ceil(total / size),
    };
  }

  async getAverageRating(eventId: string): Promise<{ averageRating: number; totalRatings: number }> {
    const result = await this.prisma.comment.aggregate({
      _avg: { rating: true },
      _count: { rating: true },
      where: { eventId, rating: { not: null } },
    });
    return {
      averageRating: result._avg.rating ? Number(result._avg.rating) : 0,
      totalRatings: result._count.rating,
    };
  }

  private toResponse(c: any, user?: any): CommentResponseDto {
    return {
      id: c.id,
      userId: c.userId,
      userName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : null,
      userAvatarUrl: user?.profilePicture ?? null,
      content: c.content,
      rating: c.rating,
      badgeType: c.badgeType,
      badgeLabel: c.badgeLabel,
      edited: c.edited,
      replies: c.replies?.map((r: any) => this.toResponse(r, r.user)) ?? [],
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }
}

