import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class SeatLockService implements OnModuleInit {
  private readonly logger = new Logger(SeatLockService.name);
  private redis: Redis;

  // Lua script for atomic unlock: check ownership + delete in one operation
  private readonly unlockScript = `
    local lockKey = KEYS[1]
    local userLocksKey = KEYS[2]
    local userId = ARGV[1]
    local seatId = ARGV[2]

    local currentHolder = redis.call('GET', lockKey)
    if currentHolder ~= userId then
      return 0
    end

    redis.call('DEL', lockKey)
    redis.call('SREM', userLocksKey, seatId)
    return 1
  `;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD') || undefined,
    });
  }

  async lockSeat(eventId: string, seatId: string, userId: string): Promise<boolean> {
    const lockKey = `seat-lock:${eventId}:${seatId}`;
    const userLocksKey = `user-seat-locks:${eventId}:${userId}`;

    // Check if already locked by this user (idempotent)
    const currentHolder = await this.redis.get(lockKey);
    if (currentHolder === userId) {
      await this.redis.expire(lockKey, 300);
      return true;
    }

    // Check if locked by another user
    if (currentHolder) {
      return false;
    }

    // Check if user already has too many locks
    const currentLocks = await this.redis.scard(userLocksKey);
    if (currentLocks >= 10) {
      this.logger.warn(`User ${userId} has too many seat locks`);
      return false;
    }

    // Try to acquire lock with 5-minute TTL
    const result = await this.redis.set(lockKey, userId, 'EX', 300, 'NX');
    if (result === 'OK') {
      await this.redis.sadd(userLocksKey, seatId);
      await this.redis.expire(userLocksKey, 360); // TTL slightly longer than lock TTL
      this.logger.debug(`Seat ${seatId} locked by user ${userId}`);
      return true;
    }

    return false;
  }

  async unlockSeat(eventId: string, seatId: string, userId: string): Promise<boolean> {
    const lockKey = `seat-lock:${eventId}:${seatId}`;
    const userLocksKey = `user-seat-locks:${eventId}:${userId}`;

    // Atomic check + delete using Lua script
    const result = await this.redis.eval(
      this.unlockScript,
      2,
      lockKey,
      userLocksKey,
      userId,
      seatId,
    );

    if (result === 1) {
      this.logger.debug(`Seat ${seatId} unlocked by user ${userId}`);
      return true;
    }

    return false;
  }

  async getLockedSeats(eventId: string): Promise<Record<string, string>> {
    const pattern = `seat-lock:${eventId}:*`;
    const lockedSeats: Record<string, string> = {};

    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        const values = await this.redis.mget(...keys);
        keys.forEach((key, index) => {
          const seatId = key.split(':')[2];
          if (values[index]) {
            lockedSeats[seatId] = values[index] as string;
          }
        });
      }
    } while (cursor !== '0');

    return lockedSeats;
  }

  async releaseAllUserLocks(eventId: string, userId: string): Promise<void> {
    const userLocksKey = `user-seat-locks:${eventId}:${userId}`;
    const seatIds = await this.redis.smembers(userLocksKey);

    for (const seatId of seatIds) {
      await this.unlockSeat(eventId, seatId, userId);
    }

    await this.redis.del(userLocksKey);
  }
}
