import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { randomBytes, createHash, createCipheriv, createDecipheriv } from 'crypto';
import { PrismaService } from '../../prisma';
import { MfaSetupResponseDto } from '../dto/response.dto';
import { MfaException, ResourceNotFoundException } from '../../common/exceptions';

@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);
  private readonly issuer = 'TicketBooking';
  private readonly backupCodeCount = 10;
  private readonly encryptionKey: Buffer;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    if (!jwtSecret) throw new Error('JWT_SECRET is required for MFA encryption');
    this.encryptionKey = createHash('sha256').update(jwtSecret).digest();
  }

  private encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  private decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      return ciphertext;
    }
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = Buffer.from(parts[2], 'hex');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
  }

  async setupMfa(userId: string): Promise<MfaSetupResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ResourceNotFoundException('User');

    // Remove existing unverified secret
    await this.prisma.mfaSecret.deleteMany({ where: { userId, verified: false } });

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(user.email, this.issuer, secret);
    const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);
    const backupCodes = this.generateBackupCodes();
    const hashedBackupCodes = backupCodes.map((code) =>
      createHash('sha256').update(code).digest('hex'),
    );

    await this.prisma.mfaSecret.create({
      data: {
        userId,
        secretEncrypted: this.encrypt(secret),
        enabled: false,
        verified: false,
        backupCodes: JSON.stringify(hashedBackupCodes),
      },
    });

    return {
      secret,
      qrCodeUrl,
      backupCodes,
    };
  }

  async confirmMfaSetup(userId: string, secret: string, totpCode: string): Promise<void> {
    const isValid = authenticator.verify({ token: totpCode, secret });
    if (!isValid) {
      throw new MfaException('Invalid TOTP code');
    }

    const mfaSecret = await this.prisma.mfaSecret.findUnique({ where: { userId } });
    if (!mfaSecret || this.decrypt(mfaSecret.secretEncrypted) !== secret) {
      throw new MfaException('Invalid MFA setup');
    }

    await this.prisma.mfaSecret.update({
      where: { id: mfaSecret.id },
      data: { enabled: true, verified: true, verifiedAt: new Date() },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });
  }

  async verifyTotp(userId: string, totpCode: string): Promise<boolean> {
    const mfaSecret = await this.prisma.mfaSecret.findFirst({ where: { userId, enabled: true } });
    if (!mfaSecret) return false;

    const isValid = authenticator.verify({
      token: totpCode,
      secret: this.decrypt(mfaSecret.secretEncrypted),
    });
    if (isValid) return true;

    return this.consumeBackupCode(mfaSecret, totpCode);
  }

  private async consumeBackupCode(mfaSecret: { id: string; backupCodes: string | null }, code: string): Promise<boolean> {
    if (!mfaSecret.backupCodes) return false;

    const codes: string[] = JSON.parse(mfaSecret.backupCodes);
    const codeHash = createHash('sha256').update(code).digest('hex');
    const foundIndex = codes.indexOf(codeHash);

    if (foundIndex === -1) return false;

    codes.splice(foundIndex, 1);
    await this.prisma.mfaSecret.update({
      where: { id: mfaSecret.id },
      data: { backupCodes: JSON.stringify(codes) },
    });
    return true;
  }

  async regenerateBackupCodes(userId: string, totpCode: string): Promise<string[]> {
    const isValid = await this.verifyTotp(userId, totpCode);
    if (!isValid) throw new MfaException('Invalid TOTP code');

    const mfaSecret = await this.prisma.mfaSecret.findFirst({ where: { userId, enabled: true } });
    if (!mfaSecret) throw new MfaException('MFA not enabled');

    const backupCodes = this.generateBackupCodes();
    const hashedBackupCodes = backupCodes.map((code) =>
      createHash('sha256').update(code).digest('hex'),
    );
    await this.prisma.mfaSecret.update({
      where: { id: mfaSecret.id },
      data: { backupCodes: JSON.stringify(hashedBackupCodes) },
    });

    return backupCodes;
  }

  async disableMfa(userId: string, totpCode: string): Promise<void> {
    const isValid = await this.verifyTotp(userId, totpCode);
    if (!isValid) throw new MfaException('Invalid TOTP code');

    await this.prisma.mfaSecret.deleteMany({ where: { userId } });
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false },
    });
  }

  async isMfaEnabled(userId: string): Promise<boolean> {
    const mfaSecret = await this.prisma.mfaSecret.findFirst({
      where: { userId, enabled: true },
    });
    return !!mfaSecret;
  }

  async getRemainingBackupCodeCount(userId: string): Promise<number> {
    const mfaSecret = await this.prisma.mfaSecret.findFirst({
      where: { userId, enabled: true },
    });
    if (!mfaSecret?.backupCodes) return 0;
    const codes: string[] = JSON.parse(mfaSecret.backupCodes);
    return codes.length;
  }

  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < this.backupCodeCount; i++) {
      codes.push(randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }
}
