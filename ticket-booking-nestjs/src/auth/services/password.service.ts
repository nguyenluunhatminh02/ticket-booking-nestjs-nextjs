import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma';
import { TokenService } from './token.service';
import { EmailService } from './email.service';
import {
  PasswordValidationException,
  InvalidTokenException,
  BadCredentialsException,
} from '../../common/exceptions';
import { createHash, randomBytes } from 'crypto';

@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);
  private readonly passwordHistorySize: number;

  constructor(
    private prisma: PrismaService,
    private tokenService: TokenService,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {
    this.passwordHistorySize = 5;
  }

  validatePassword(password: string): string[] {
    const violations: string[] = [];
    if (password.length < 8) violations.push('Password must be at least 8 characters');
    if (password.length > 100) violations.push('Password must be at most 100 characters');
    if (!/[A-Z]/.test(password)) violations.push('Password must contain at least one uppercase letter');
    if (!/[a-z]/.test(password)) violations.push('Password must contain at least one lowercase letter');
    if (!/[0-9]/.test(password)) violations.push('Password must contain at least one digit');
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      violations.push('Password must contain at least one special character');
    }
    return violations;
  }

  async isPasswordReused(userId: string, rawPassword: string): Promise<boolean> {
    const history = await this.prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: this.passwordHistorySize,
    });

    for (const entry of history) {
      if (await bcrypt.compare(rawPassword, entry.passwordHash)) {
        return true;
      }
    }
    return false;
  }

  async savePasswordHistory(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.passwordHistory.create({
      data: { userId, passwordHash },
    });

    // Clean old records
    const records = await this.prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (records.length > this.passwordHistorySize) {
      const toDelete = records.slice(this.passwordHistorySize).map((r) => r.id);
      await this.prisma.passwordHistory.deleteMany({
        where: { id: { in: toDelete } },
      });
    }
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      this.logger.debug(`Password reset requested for non-existent email: ${email}`);
      return;
    }

    // Invalidate old tokens
    await this.prisma.verificationToken.updateMany({
      where: { userId: user.id, type: 'PASSWORD_RESET', used: false },
      data: { used: true },
    });

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    await this.prisma.verificationToken.create({
      data: {
        tokenHash,
        type: 'PASSWORD_RESET',
        userId: user.id,
        expiresAt: new Date(Date.now() + 3600000),
        used: false,
      },
    });

    try {
      await this.emailService.sendPasswordResetEmail(user.email!, user.firstName ?? '', rawToken);
    } catch (e) {
      this.logger.error('Failed to send password reset email', e.stack);
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const verificationToken = await this.prisma.verificationToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!verificationToken || verificationToken.used || verificationToken.type !== 'PASSWORD_RESET' || new Date() > verificationToken.expiresAt) {
      throw new InvalidTokenException('Invalid or expired reset token');
    }

    const violations = this.validatePassword(newPassword);
    if (violations.length > 0) {
      throw new PasswordValidationException(violations);
    }

    const user = verificationToken.user;

    if (await this.isPasswordReused(user.id, newPassword)) {
      throw new PasswordValidationException(['Password has been used recently']);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashedPassword, passwordChangedAt: new Date() },
    });

    await this.savePasswordHistory(user.id, hashedPassword);

    await this.prisma.verificationToken.update({
      where: { id: verificationToken.id },
      data: { used: true },
    });

    await this.tokenService.revokeAllSessions(user.id);

    await this.emailService.sendPasswordChangedEmail(user.email!, user.firstName ?? '');
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    currentDeviceId?: string,
    logoutAllDevices = false,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadCredentialsException('User not found');

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash!);
    if (!isValid) throw new BadCredentialsException('Current password is incorrect');

    const violations = this.validatePassword(newPassword);
    if (violations.length > 0) {
      throw new PasswordValidationException(violations);
    }

    if (await this.isPasswordReused(userId, newPassword)) {
      throw new PasswordValidationException(['Password has been used recently']);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedPassword, passwordChangedAt: new Date() },
    });

    await this.savePasswordHistory(userId, hashedPassword);

    if (logoutAllDevices && currentDeviceId) {
      await this.tokenService.revokeOtherSessions(userId, currentDeviceId);
    }

    await this.emailService.sendPasswordChangedEmail(user.email!, user.firstName ?? '');
  }
}
