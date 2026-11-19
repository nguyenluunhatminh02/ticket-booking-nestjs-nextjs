import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Redis-backed temporary seat locking service.
 *
 * When a user selects a seat on the seat map, it is "locked" for 5 minutes.
 * This prevents other users from selecting the same seat while someone is
 * in the process of completing their booking.
 *
 * Redis key patterns:
 * - seat:lock:{eventId}:{seatId} → userId (TTL 5 min)
 * - seat:locks:{eventId} → SET of seatIds currently locked
 * - seat:user:{eventId}:{userId} → SET of seatIds locked by this user
 */
@Injectable()
export class SeatLockService {
  private readonly logger = new Logger(SeatLockService.name);
  private readonly redis: Redis;
  private readonly LOCK_TTL = 300; // 5 minutes in seconds
  private readonly MAX_LOCKS_PER_USER = 10;

  constructor(private configService: ConfigService) {
    this.redis = new Redis({
      host: configService.get('REDIS_HOST', 'localhost'),
      port: configService.get<number>('REDIS_PORT', 6379),
      password: configService.get('REDIS_PASSWORD'),
    });
  }

  async lockSeat(eventId: string, seatId: string, userId: string): Promise<boolean> {
    const lockKey = this.lockKey(eventId, seatId);
    const userLocksKey = this.userLocksKey(eventId, userId);

    try {
      // Check if already locked by this user (idempotent)
      const currentHolder = await this.redis.get(lockKey);
      if (currentHolder === userId) {
        await this.redis.expire(lockKey, this.LOCK_TTL);
        return true;
      }

      // Check if locked by another user
      if (currentHolder) {
        return false;
      }

      // Check per-user limit
      const userLockCount = await this.redis.scard(userLocksKey);
      if (userLockCount >= this.MAX_LOCKS_PER_USER) {
        this.logger.warn(`User ${userId} exceeded max seat locks for event ${eventId}`);
        return false;
      }

      // Atomic set-if-absent with TTL
      const acquired = await this.redis.set(lockKey, userId, 'EX', this.LOCK_TTL, 'NX');
      if (acquired === 'OK') {
        await this.redis.sadd(userLocksKey, seatId);
        await this.redis.expire(userLocksKey, this.LOCK_TTL + 60);

        const eventLocksKey = this.eventLocksKey(eventId);
        await this.redis.sadd(eventLocksKey, seatId);
        await this.redis.expire(eventLocksKey, this.LOCK_TTL + 60);

        this.logger.debug(`Seat ${seatId} locked by user ${userId} for event ${eventId}`);
        return true;
      }

      return false;
    } catch (e) {
      this.logger.error(`Failed to lock seat ${seatId} for user ${userId}: ${e.message}`);
      return false;
    }
  }

  async unlockSeat(eventId: string, seatId: string, userId: string): Promise<boolean> {
    const lockKey = this.lockKey(eventId, seatId);

    try {
      const currentHolder = await this.redis.get(lockKey);
      if (currentHolder !== userId) {
        return false;
      }

      await this.redis.del(lockKey);
      await this.redis.srem(this.userLocksKey(eventId, userId), seatId);
      await this.redis.srem(this.eventLocksKey(eventId), seatId);

      this.logger.debug(`Seat ${seatId} unlocked by user ${userId} for event ${eventId}`);
      return true;
    } catch (e) {
      this.logger.error(`Failed to unlock seat ${seatId} for user ${userId}: ${e.message}`);
      return false;
    }
  }

  async releaseAllUserLocks(eventId: string, userId: string): Promise<void> {
    const userLocksKey = this.userLocksKey(eventId, userId);

    try {
      const seatIds = await this.redis.smembers(userLocksKey);
      for (const seatId of seatIds) {
        const lockKey = this.lockKey(eventId, seatId);
        const holder = await this.redis.get(lockKey);
        if (holder === userId) {
          await this.redis.del(lockKey);
          await this.redis.srem(this.eventLocksKey(eventId), seatId);
        }
      }
      await this.redis.del(userLocksKey);
      this.logger.log(`Released all seat locks for user ${userId} on event ${eventId}`);
    } catch (e) {
      this.logger.error(`Failed to release locks for user ${userId} on event ${eventId}: ${e.message}`);
    }
  }

  async getLockedSeats(eventId: string): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    const eventLocksKey = this.eventLocksKey(eventId);

    try {
      const lockedSeatIds = await this.redis.smembers(eventLocksKey);
      for (const seatId of lockedSeatIds) {
        const holder = await this.redis.get(this.lockKey(eventId, seatId));
        if (holder) {
          result[seatId] = holder;
        } else {
          // Lock expired, clean up set
          await this.redis.srem(eventLocksKey, seatId);
        }
      }
    } catch (e) {
      this.logger.error(`Failed to get locked seats for event ${eventId}: ${e.message}`);
    }

    return result;
  }

  private lockKey(eventId: string, seatId: string): string {
    return `seat:lock:${eventId}:${seatId}`;
  }

  private userLocksKey(eventId: string, userId: string): string {
    return `seat:user:${eventId}:${userId}`;
  }

  private eventLocksKey(eventId: string): string {
    return `seat:locks:${eventId}`;
  }
}
