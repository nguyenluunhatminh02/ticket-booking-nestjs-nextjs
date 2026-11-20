import { Injectable, NotFoundException, BadRequestException, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { QueueStatus } from '../entities/enums';
import { QueuePositionResponseDto } from '../dto/response/queue-position-response.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private redis: Redis | null = null;
  private readonly releaseLeaderLockScript = `
    if redis.call('GET', KEYS[1]) == ARGV[1] then
      return redis.call('DEL', KEYS[1])
    end
    return 0
  `;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  private getRedis(): Redis {
    if (!this.redis) {
      this.redis = new Redis({
        host: this.configService.get('REDIS_HOST', 'localhost'),
        port: this.configService.get<number>('REDIS_PORT', 6379),
        password: this.configService.get('REDIS_PASSWORD') || undefined,
      });
    }
    return this.redis;
  }

  onModuleDestroy() {
    this.redis?.disconnect();
  }

  /**
   * Acquire a short-lived leader lock without changing cron schedules.
   * Returns the token on success, false when another instance holds the lock
   * (skip the cron), or null when Redis is unavailable (fail open: all cron
   * writes below remain idempotent/state-based).
   */
  private async acquireLeaderLock(
    key: string,
    ttlMs: number,
  ): Promise<string | false | null> {
    const token = uuidv4();
    try {
      const acquired = await this.getRedis().set(key, token, 'PX', ttlMs, 'NX');
      return acquired === 'OK' ? token : false;
    } catch (err) {
      this.logger.warn(`Leader lock ${key} unavailable: ${err.message}`);
      return null;
    }
  }

  private async releaseLeaderLock(key: string, token: string): Promise<void> {
    try {
      await this.getRedis().eval(this.releaseLeaderLockScript, 1, key, token);
    } catch (err) {
      this.logger.warn(`Failed to release leader lock ${key}: ${err.message}`);
    }
  }

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
    const lockKey = 'cron:queue:promote-waiting';
    const token = await this.acquireLeaderLock(lockKey, 55_000);
    if (token === false) return;
    if (token === null) {
      this.logger.warn(
        'Redis unavailable for queue promotion lock; running idempotent cleanup anyway',
      );
    }

    try {
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
    } finally {
      if (typeof token === 'string') {
        await this.releaseLeaderLock(lockKey, token);
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
