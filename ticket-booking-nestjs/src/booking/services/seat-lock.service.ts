import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class SeatLockService implements OnModuleInit {
  private readonly logger = new Logger(SeatLockService.name);
  private redis: Redis;

  // Lua script for atomic unlock: check ownership + delete in one operation.
  // Stored lock values are JSON { userId, socketId? } for new locks; plain
  // userId values from older callers remain valid (socketId is optional).
  private readonly unlockScript = `
    local lockKey = KEYS[1]
    local userLocksKey = KEYS[2]
    local userId = ARGV[1]
    local seatId = ARGV[2]
    local socketId = ARGV[3]

    local currentHolder = redis.call('GET', lockKey)
    if not currentHolder then
      return 0
    end

    local storedUserId = currentHolder
    local storedSocketId = ''
    if string.sub(currentHolder, 1, 1) == '{' then
      local ok, decoded = pcall(cjson.decode, currentHolder)
      if ok and decoded then
        storedUserId = decoded.userId or ''
        storedSocketId = decoded.socketId or ''
      else
        return 0
      end
    end

    if storedUserId ~= userId then
      return 0
    end
    -- A socket-scoped release must match the socket that acquired the lock.
    -- User-scoped releases (socketId == '') keep the legacy behavior.
    if socketId ~= '' and storedSocketId ~= socketId then
      return 0
    end

    redis.call('DEL', lockKey)
    redis.call('SREM', userLocksKey, seatId)
    return 1
  `;

  // Refresh a lock with the same atomicity as acquire: verify exact ownership
  // (userId AND socketId for socket-scoped locks) before extending the TTL.
  // A legacy, user-scoped lock can only be refreshed by a user-scoped caller.
  private readonly refreshScript = `
    local lockKey = KEYS[1]
    local userId = ARGV[1]
    local seatId = ARGV[2]
    local socketId = ARGV[3]
    local holderValue = ARGV[4]
    local ttlSeconds = ARGV[5]

    local currentHolder = redis.call('GET', lockKey)
    if not currentHolder then
      return 0
    end

    local storedUserId = currentHolder
    local storedSocketId = ''
    if string.sub(currentHolder, 1, 1) == '{' then
      local ok, decoded = pcall(cjson.decode, currentHolder)
      if ok and decoded then
        storedUserId = decoded.userId or ''
        storedSocketId = decoded.socketId or ''
      else
        return 0
      end
    end

    if storedUserId ~= userId or storedSocketId ~= socketId then
      return 0
    end

    redis.call('SET', lockKey, holderValue, 'EX', ttlSeconds)
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

  private parseHolder(value: string | null): { userId: string; socketId: string } | null {
    if (!value) return null;
    if (value.startsWith('{')) {
      try {
        const parsed = JSON.parse(value);
        return {
          userId: String(parsed.userId || ''),
          socketId: String(parsed.socketId || ''),
        };
      } catch {
        return null;
      }
    }
    // Legacy lock value written before socket ownership was introduced.
    return { userId: value, socketId: '' };
  }

  private serializeHolder(userId: string, socketId?: string): string {
    return socketId ? JSON.stringify({ userId, socketId }) : userId;
  }

  async lockSeat(
    eventId: string,
    seatId: string,
    userId: string,
    socketId?: string,
  ): Promise<boolean> {
    const lockKey = `seat-lock:${eventId}:${seatId}`;
    const userLocksKey = `user-seat-locks:${eventId}:${userId}`;
    const holderValue = this.serializeHolder(userId, socketId);

    // Existing locks are only refreshed when the exact owner matches. A new
    // socket from the same user must wait for the old lock to expire or be
    // released; it cannot silently take over another tab's lock. The ownership
    // check and TTL extension are atomic so a concurrent release cannot slip
    // between the read and the write.
    const refreshed = await this.redis.eval(
      this.refreshScript,
      1,
      lockKey,
      userId,
      seatId,
      socketId || '',
      holderValue,
      300,
    );
    if (refreshed === 1) {
      return true;
    }

    // Any existing holder blocks a fresh acquisition until its TTL expires or
    // an authorized release runs.
    if (await this.redis.exists(lockKey)) {
      return false;
    }

    // Check if user already has too many locks
    const currentLocks = await this.redis.scard(userLocksKey);
    if (currentLocks >= 10) {
      this.logger.warn(`User ${userId} has too many seat locks`);
      return false;
    }

    // Try to acquire lock with 5-minute TTL
    const result = await this.redis.set(lockKey, holderValue, 'EX', 300, 'NX');
    if (result === 'OK') {
      await this.redis.sadd(userLocksKey, seatId);
      await this.redis.expire(userLocksKey, 360); // TTL slightly longer than lock TTL
      this.logger.debug(`Seat ${seatId} locked by user ${userId}`);
      return true;
    }

    return false;
  }

  /**
   * Atomically releases a seat lock, optionally verifying socket ownership.
   * Omitting socketId keeps the historic user-level unlock behavior (used by
   * the reservation flow); passing it prevents one socket from releasing a
   * lock acquired by another socket of the same user.
   */
  async releaseLock(
    eventId: string,
    seatId: string,
    userId: string,
    socketId?: string,
  ): Promise<boolean> {
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
      socketId || '',
    );

    if (result === 1) {
      this.logger.debug(`Seat ${seatId} unlocked by user ${userId}`);
      return true;
    }

    return false;
  }

  async unlockSeat(
    eventId: string,
    seatId: string,
    userId: string,
    socketId?: string,
  ): Promise<boolean> {
    return this.releaseLock(eventId, seatId, userId, socketId);
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
          const holder = this.parseHolder(values[index] as string | null);
          if (holder?.userId) {
            // Preserve the public response contract: map seatId -> userId.
            lockedSeats[seatId] = holder.userId;
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
