import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma';
import { AccountLockedException, RateLimitExceededException } from '../../common/exceptions';
import { EmailService } from './email.service';

@Injectable()
export class LoginAttemptService {
  private readonly logger = new Logger(LoginAttemptService.name);
  private readonly redis: Redis;
  private readonly maxAttempts: number;
  private readonly lockoutDuration: number; // minutes

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {
    this.redis = new Redis({
      host: configService.get('REDIS_HOST', 'localhost'),
      port: configService.get('REDIS_PORT', 6379),
      password: configService.get('REDIS_PASSWORD'),
    });
    this.maxAttempts = configService.get('MAX_LOGIN_ATTEMPTS', 5);
    this.lockoutDuration = configService.get('LOCKOUT_DURATION_MINUTES', 30);
  }

  async checkBruteForce(email: string, ipAddress: string): Promise<void> {
    if (await this.isAccountLocked(email)) {
      const remaining = await this.getAccountLockRemainingMinutes(email);
      throw new AccountLockedException(
        `Account is locked. Try again in ${remaining} minutes.`,
      );
    }

    if (await this.isIpRateLimited(ipAddress)) {
      throw new RateLimitExceededException('Too many login attempts from this IP');
    }
  }

  async recordFailedLogin(email: string, ipAddress: string, reason?: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    await this.prisma.loginAttempt.create({
      data: {
        userId: user?.id,
        email,
        ipAddress,
        success: false,
        failureReason: reason || 'Invalid credentials',
        attemptedAt: new Date(),
      },
    });

    const attemptKey = `login_attempts:${email}`;
    const ipKey = `ip_attempts:${ipAddress}`;

    const attempts = await this.redis.incr(attemptKey);
    await this.redis.expire(attemptKey, this.lockoutDuration * 60);
    await this.redis.incr(ipKey);
    await this.redis.expire(ipKey, 3600);

    if (attempts >= this.maxAttempts) {
      const acquired = await this.redis.set(`account_lock_guard:${email}`, '1', 'EX', 5, 'NX');
      if (acquired) {
        await this.lockAccount(email);
      }
    }
  }

  async recordSuccessfulLogin(email: string, ipAddress: string, userId?: string): Promise<void> {
    await this.redis.del(`login_attempts:${email}`);

    await this.prisma.loginAttempt.create({
      data: {
        userId,
        email,
        ipAddress,
        success: true,
        attemptedAt: new Date(),
      },
    });
  }

  private async lockAccount(email: string): Promise<void> {
    const lockUntil = new Date(Date.now() + this.lockoutDuration * 60 * 1000);

    await this.redis.set(
      `account_lock:${email}`,
      lockUntil.toISOString(),
      'EX',
      this.lockoutDuration * 60,
    );

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { accountLocked: true, lockedUntil: lockUntil },
      });
      await this.emailService.sendAccountLockedEmail(user.email!, user.firstName ?? '', this.lockoutDuration);
    }

    this.logger.warn(`Account locked for email: ${email}`);
  }

  async isAccountLocked(email: string): Promise<boolean> {
    const lockUntil = await this.redis.get(`account_lock:${email}`);
    if (!lockUntil) return false;
    return new Date(lockUntil) > new Date();
  }

  async getAccountLockRemainingMinutes(email: string): Promise<number> {
    const lockUntil = await this.redis.get(`account_lock:${email}`);
    if (!lockUntil) return 0;
    const remaining = new Date(lockUntil).getTime() - Date.now();
    return Math.max(0, Math.ceil(remaining / 60000));
  }

  async unlockAccount(email: string): Promise<void> {
    await this.redis.del(`account_lock:${email}`);
    await this.redis.del(`login_attempts:${email}`);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { accountLocked: false, lockedUntil: null },
      });
    }
  }

  async isIpRateLimited(ipAddress: string): Promise<boolean> {
    const attempts = await this.redis.get(`ip_attempts:${ipAddress}`);
    return parseInt(attempts || '0') > 50;
  }

  async getLoginHistory(userId: string, since: Date, page: number, size: number) {
    const [items, totalElements] = await Promise.all([
      this.prisma.loginAttempt.findMany({
        where: { userId, attemptedAt: { gte: since } },
        orderBy: { attemptedAt: 'desc' },
        skip: page * size,
        take: size,
      }),
      this.prisma.loginAttempt.count({
        where: { userId, attemptedAt: { gte: since } },
      }),
    ]);
    const totalPages = Math.ceil(totalElements / size);
    return {
      content: items.map((item) => ({
        id: item.id,
        email: item.email,
        ipAddress: item.ipAddress,
        deviceInfo: item.deviceInfo,
        success: item.success,
        failureReason: item.failureReason,
        attemptedAt: item.attemptedAt,
      })),
      totalElements,
      totalPages,
      size,
      number: page,
      first: page === 0,
      last: page >= totalPages - 1,
    };
  }
}
