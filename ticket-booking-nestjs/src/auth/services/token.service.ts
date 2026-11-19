import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly redis: Redis;
  private readonly accessTokenExpiration: number;
  private readonly refreshTokenExpiration: number;
  private readonly rememberMeExpiration: number;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.redis = new Redis({
      host: configService.get('REDIS_HOST', 'localhost'),
      port: configService.get('REDIS_PORT', 6379),
      password: configService.get('REDIS_PASSWORD'),
    });
    this.accessTokenExpiration = configService.get('JWT_ACCESS_TOKEN_EXPIRATION', 900000);
    this.refreshTokenExpiration = configService.get('JWT_REFRESH_TOKEN_EXPIRATION', 604800000);
    this.rememberMeExpiration = 28 * 24 * 60 * 60 * 1000;
  }

  generateAccessToken(user: { id: string; email: string; roles: string[] }, deviceId?: string): string {
    return this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        roles: user.roles,
        deviceId,
        type: 'ACCESS',
        jti: uuidv4(),
      },
      { expiresIn: Math.floor(this.accessTokenExpiration / 1000) },
    );
  }

  generateRefreshToken(
    user: { id: string; email: string; roles: string[] },
    deviceId?: string,
    rememberMe = false,
  ): string {
    const expiration = rememberMe ? this.rememberMeExpiration : this.refreshTokenExpiration;
    return this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        roles: user.roles,
        deviceId,
        type: 'REFRESH',
        jti: uuidv4(),
      },
      { expiresIn: Math.floor(expiration / 1000) },
    );
  }

  generateMfaToken(userId: string): string {
    return this.jwtService.sign(
      {
        sub: userId,
        type: 'MFA_PENDING',
        jti: uuidv4(),
      },
      { expiresIn: 300 }, // 5 minutes
    );
  }

  async storeRefreshToken(userId: string, deviceId: string, refreshToken: string): Promise<void> {
    const decoded = this.jwtService.decode(refreshToken) as any;
    const key = `refresh:${userId}:${deviceId}`;
    const ttl = decoded?.exp
      ? Math.max(1, decoded.exp - Math.floor(Date.now() / 1000))
      : Math.floor(this.refreshTokenExpiration / 1000);
    await this.redis.set(key, decoded.jti, 'EX', ttl);
  }

  async validateRefreshToken(userId: string, deviceId: string, refreshToken: string): Promise<boolean> {
    try {
      const decoded = this.jwtService.verify(refreshToken) as any;
      if (decoded.type !== 'REFRESH' || decoded.sub !== userId) return false;

      const key = `refresh:${userId}:${deviceId}`;
      const storedJti = await this.redis.get(key);
      return storedJti === decoded.jti;
    } catch {
      return false;
    }
  }

  async blacklistToken(token: string): Promise<void> {
    try {
      const decoded = this.jwtService.decode(token) as any;
      if (!decoded || !decoded.jti) return;
      const ttl = Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
      if (ttl > 0) {
        await this.redis.set(`blacklist:${decoded.jti}`, '1', 'EX', ttl);
      }
    } catch (e) {
      this.logger.warn(`Failed to blacklist token: ${e.message}`);
    }
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const decoded = this.jwtService.decode(token) as any;
      if (!decoded || !decoded.jti) return false;
      const result = await this.redis.get(`blacklist:${decoded.jti}`);
      return result !== null;
    } catch {
      return false;
    }
  }

  async revokeDeviceSession(userId: string, deviceId: string): Promise<void> {
    await this.redis.del(`refresh:${userId}:${deviceId}`);
    await this.prisma.userDevice.updateMany({
      where: { userId, deviceId },
      data: { active: false },
    });
  }

  async revokeAllSessions(userId: string): Promise<void> {
    const pattern = `refresh:${userId}:*`;
    const keys = await this.scanKeys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
    await this.prisma.userDevice.updateMany({
      where: { userId },
      data: { active: false },
    });
  }

  async revokeOtherSessions(userId: string, currentDeviceId: string): Promise<void> {
    const pattern = `refresh:${userId}:*`;
    const keys = await this.scanKeys(pattern);
    const otherKeys = keys.filter((k) => !k.endsWith(`:${currentDeviceId}`));
    if (otherKeys.length > 0) {
      await this.redis.del(...otherKeys);
    }
    await this.prisma.userDevice.updateMany({
      where: { userId, deviceId: { not: currentDeviceId } },
      data: { active: false },
    });
  }

  async getActiveSessionCount(userId: string): Promise<number> {
    const pattern = `refresh:${userId}:*`;
    const keys = await this.scanKeys(pattern);
    return keys.length;
  }

  async getActiveDeviceIds(userId: string): Promise<string[]> {
    const pattern = `refresh:${userId}:*`;
    const keys = await this.scanKeys(pattern);
    return keys.map((k) => k.split(':').pop()!);
  }

  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [next, batch] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      keys.push(...batch);
    } while (cursor !== '0');
    return keys;
  }

  getAccessTokenExpirationMs(): number {
    return this.accessTokenExpiration;
  }

  verifyToken(token: string): any {
    return this.jwtService.verify(token);
  }

  decodeToken(token: string): any {
    return this.jwtService.decode(token);
  }
}
