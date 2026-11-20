import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { v4 as uuidv4 } from 'uuid';
import { QueueStatus } from '../entities/enums';
import { QueuePositionResponseDto } from '../dto/response/queue-position-response.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class QueueService {
  constructor(private prisma: PrismaService) {}

  async joinQueue(eventId: string, user: any): Promise<QueuePositionResponseDto> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    // Check for existing active entry
    const existing = await this.prisma.queueEntry.findFirst({
      where: { eventId, userId: user.id, status: QueueStatus.WAITING },
    });
    if (existing) return this.toResponse(existing, event);

    const activeExisting = await this.prisma.queueEntry.findFirst({
      where: { eventId, userId: user.id, status: QueueStatus.ACTIVE },
    });
    if (activeExisting) return this.toResponse(activeExisting, event);

    // Use SERIALIZABLE transaction to get atomic position
    return this.prisma.$transaction(
      async (tx) => {
        const totalInQueue = await tx.queueEntry.count({
          where: { eventId, status: { in: [QueueStatus.WAITING, QueueStatus.ACTIVE] } },
        });
        const position = totalInQueue + 1;

        const saved = await tx.queueEntry.create({
          data: {
            userId: user.id,
            eventId,
            queueToken: uuidv4(),
            position,
            status: position <= 100 ? QueueStatus.ACTIVE : QueueStatus.WAITING,
            joinedAt: new Date(),
            activatedAt: position <= 100 ? new Date() : undefined,
            expiresAt: position <= 100 ? new Date(Date.now() + 10 * 60 * 1000) : undefined,
          },
        });
        return this.toResponse(saved, event);
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async getQueuePosition(queueToken: string, userId: string): Promise<QueuePositionResponseDto> {
    const entry = await this.prisma.queueEntry.findFirst({
      where: { queueToken },
      include: { event: true },
    });
    if (!entry) throw new NotFoundException('Queue entry not found');
    if (entry.userId !== userId) throw new BadRequestException('Not authorized');
    const totalInQueue = await this.prisma.queueEntry.count({
      where: { eventId: entry.eventId, status: { in: [QueueStatus.WAITING, QueueStatus.ACTIVE] } },
    });
    const resp = this.toResponse(entry, (entry as any).event);
    resp.totalInQueue = totalInQueue;
    return resp;
  }

  async leaveQueue(queueToken: string, userId: string): Promise<void> {
    const entry = await this.prisma.queueEntry.findFirst({ where: { queueToken } });
    if (!entry) throw new NotFoundException('Queue entry not found');
    if (entry.userId !== userId) throw new BadRequestException('Not authorized');
    await this.prisma.queueEntry.update({
      where: { id: entry.id },
      data: { status: QueueStatus.EXPIRED },
    });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async promoteWaitingEntries(): Promise<void> {
    // Step 1: Expire ACTIVE entries that have passed their expiresAt
    const expired = await this.prisma.queueEntry.updateMany({
      where: {
        status: QueueStatus.ACTIVE,
        expiresAt: { lt: new Date() },
      },
      data: { status: QueueStatus.EXPIRED },
    });
    if (expired.count > 0) {
      console.log(`[Queue] Expired ${expired.count} ACTIVE entries`);
    }

    // Step 2: Promote WAITING entries to fill slots
    const events = await this.prisma.queueEntry.groupBy({
      by: ['eventId'],
      where: { status: QueueStatus.WAITING },
    });
    for (const { eventId } of events) {
      const activeCount = await this.prisma.queueEntry.count({
        where: { eventId, status: QueueStatus.ACTIVE },
      });
      const slots = 100 - activeCount;
      if (slots <= 0) continue;
      const waiting = await this.prisma.queueEntry.findMany({
        where: { eventId, status: QueueStatus.WAITING },
        orderBy: { position: 'asc' },
        take: slots,
      });
      for (const entry of waiting) {
        await this.prisma.queueEntry.update({
          where: { id: entry.id },
          data: {
            status: QueueStatus.ACTIVE,
            activatedAt: new Date(),
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          },
        });
      }
    }
  }

  private toResponse(entry: any, event?: any): QueuePositionResponseDto {
    const estimatedWait =
      entry.status === QueueStatus.ACTIVE
        ? 0
        : Math.ceil(((entry.position || 1) / 100) * 5);
    return {
      id: entry.id,
      eventId: entry.eventId,
      eventName: event?.name ?? null,
      queueToken: entry.queueToken,
      position: entry.position,
      totalInQueue: entry.position,
      status: entry.status,
      estimatedWaitMinutes: estimatedWait,
      activatedAt: entry.activatedAt,
      expiresAt: entry.expiresAt,
      joinedAt: entry.joinedAt,
    };
  }
}
