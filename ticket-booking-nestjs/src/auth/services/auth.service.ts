import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { Request } from 'express';
import { PrismaService } from '../../prisma';
import { LoginDto, RegisterDto } from '../dto';
import { AuthResponseDto, UserInfoDto } from '../dto/response.dto';
import { TokenService } from './token.service';
import { PasswordService } from './password.service';
import { DeviceService } from './device.service';
import { MfaService } from './mfa.service';
import { EmailService } from './email.service';
import { LoginAttemptService } from './login-attempt.service';
import { AuditLogService } from './audit-log.service';
import {
  BadCredentialsException,
  ResourceAlreadyExistsException,
  ResourceNotFoundException,
  InvalidTokenException,
  EmailNotVerifiedException,
  PasswordValidationException,
} from '../../common/exceptions';

// Common include for user with roles and permissions
const userWithRolesInclude = {
  roles: {
    include: {
      role: {
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      },
    },
  },
} as const;

const userWithRolesOnlyInclude = {
  roles: { include: { role: true } },
} as const;

@Injectable()
export class AuthenticationService {
  private readonly logger = new Logger(AuthenticationService.name);

  constructor(
    private prisma: PrismaService,
    private tokenService: TokenService,
    private passwordService: PasswordService,
    private deviceService: DeviceService,
    private mfaService: MfaService,
    private emailService: EmailService,
    private loginAttemptService: LoginAttemptService,
    private auditLogService: AuditLogService,
  ) {}

  private isAccountNonLocked(user: { accountLocked: boolean; lockedUntil: Date | null }): boolean {
    return !user.accountLocked || (user.lockedUntil != null && user.lockedUntil < new Date());
  }

  async login(dto: LoginDto, req: Request): Promise<AuthResponseDto> {
    const ipAddress = req.ip || req.socket?.remoteAddress || 'unknown';

    await this.loginAttemptService.checkBruteForce(dto.email, ipAddress);

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: userWithRolesInclude,
    });

    if (!user || !user.passwordHash) {
      await this.loginAttemptService.recordFailedLogin(dto.email, ipAddress, 'User not found');
      throw new BadCredentialsException();
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      await this.loginAttemptService.recordFailedLogin(dto.email, ipAddress, 'Invalid password');
      throw new BadCredentialsException();
    }

    if (!user.emailVerified) {
      throw new EmailNotVerifiedException();
    }

    if (!this.isAccountNonLocked(user)) {
      throw new BadCredentialsException('Account is locked');
    }

    if (user.mfaEnabled) {
      const deviceTrusted = dto.deviceId
        ? await this.deviceService.isDeviceTrusted(user.id, dto.deviceId)
        : false;

      if (!deviceTrusted) {
        const mfaToken = this.tokenService.generateMfaToken(user.id);
        await this.loginAttemptService.recordSuccessfulLogin(dto.email, ipAddress, user.id);
        return AuthResponseDto.mfaRequired(mfaToken);
      }
    }

    const device = await this.deviceService.registerDevice(
      user.id,
      dto.deviceId,
      dto.deviceName,
      dto.deviceType,
      req,
    );

    const userInfo = this.buildUserInfo(user);
    const tokenUser = { id: user.id, email: user.email, roles: userInfo.roles };
    const accessToken = this.tokenService.generateAccessToken(tokenUser, device.deviceId);
    const refreshToken = this.tokenService.generateRefreshToken(tokenUser, device.deviceId, dto.rememberMe);

    await this.tokenService.storeRefreshToken(user.id, device.deviceId, refreshToken);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.loginAttemptService.recordSuccessfulLogin(dto.email, ipAddress, user.id);
    await this.auditLogService.log(user.id, 'LOGIN', 'User logged in', ipAddress);

    return AuthResponseDto.of(
      accessToken,
      refreshToken,
      this.tokenService.getAccessTokenExpirationMs(),
      userInfo,
    );
  }

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    if (dto.password !== dto.confirmPassword) {
      throw new PasswordValidationException(['Passwords do not match']);
    }

    const violations = this.passwordService.validatePassword(dto.password);
    if (violations.length > 0) {
      throw new PasswordValidationException(violations);
    }

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ResourceAlreadyExistsException('User', dto.email);
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    let userRole = await this.prisma.role.findUnique({ where: { name: 'ROLE_USER' } });
    if (!userRole) {
      userRole = await this.prisma.role.create({
        data: { name: 'ROLE_USER', description: 'Default user role' },
      });
    }

    const savedUser = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phoneNumber: dto.phoneNumber,
        enabled: true,
        emailVerified: false,
        roles: {
          create: { roleId: userRole.id },
        },
      },
      include: userWithRolesOnlyInclude,
    });

    await this.passwordService.savePasswordHistory(savedUser.id, passwordHash);

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    await this.prisma.verificationToken.create({
      data: {
        tokenHash,
        type: 'EMAIL_VERIFICATION',
        userId: savedUser.id,
        expiresAt: new Date(Date.now() + 86400000),
        used: false,
      },
    });

    try {
      await this.emailService.sendVerificationEmail(savedUser.email!, savedUser.firstName ?? '', rawToken);
    } catch (e) {
      this.logger.error('Failed to send verification email during registration', e.stack);
    }
    await this.auditLogService.log(savedUser.id, 'REGISTER', 'User registered');

    return {
      user: this.buildUserInfo(savedUser),
      mfaRequired: false,
    };
  }

  async verifyMfa(mfaToken: string, totpCode: string, deviceId: string, deviceName: string, deviceType: string, req: Request): Promise<AuthResponseDto> {
    const decoded = this.tokenService.verifyToken(mfaToken);
    if (decoded.type !== 'MFA_PENDING') {
      throw new InvalidTokenException('Invalid MFA token');
    }

    const userId = decoded.sub;
    const isValid = await this.mfaService.verifyTotp(userId, totpCode);
    if (!isValid) {
      throw new BadCredentialsException('Invalid TOTP code');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: userWithRolesInclude,
    });
    if (!user) throw new ResourceNotFoundException('User');

    const device = await this.deviceService.registerDevice(userId, deviceId, deviceName, deviceType, req);

    const userInfo = this.buildUserInfo(user);
    const tokenUser = { id: user.id, email: user.email, roles: userInfo.roles };
    const accessToken = this.tokenService.generateAccessToken(tokenUser, device.deviceId);
    const refreshToken = this.tokenService.generateRefreshToken(tokenUser, device.deviceId);

    await this.tokenService.storeRefreshToken(user.id, device.deviceId, refreshToken);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return AuthResponseDto.of(
      accessToken,
      refreshToken,
      this.tokenService.getAccessTokenExpirationMs(),
      userInfo,
    );
  }

  async refreshToken(refreshTokenStr: string, deviceId?: string): Promise<AuthResponseDto> {
    let decoded: any;
    try {
      decoded = this.tokenService.verifyToken(refreshTokenStr);
    } catch {
      throw new InvalidTokenException('Invalid refresh token');
    }

    if (decoded.type !== 'REFRESH') {
      throw new InvalidTokenException('Invalid token type');
    }

    const userId = decoded.sub;
    const tokenDeviceId = decoded.deviceId;
    if (!tokenDeviceId) {
      throw new InvalidTokenException('Invalid device context in token');
    }

    const isValid = await this.tokenService.validateRefreshToken(userId, tokenDeviceId, refreshTokenStr);
    if (!isValid) {
      throw new InvalidTokenException('Refresh token has been revoked');
    }

    await this.tokenService.blacklistToken(refreshTokenStr);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: userWithRolesOnlyInclude,
    });
    if (!user || !user.enabled) {
      throw new InvalidTokenException('User not found or disabled');
    }

    const userInfo = this.buildUserInfo(user);
    const tokenUser = { id: user.id, email: user.email, roles: userInfo.roles };

    const newAccessToken = this.tokenService.generateAccessToken(tokenUser, tokenDeviceId);
    const newRefreshToken = this.tokenService.generateRefreshToken(tokenUser, tokenDeviceId);

    await this.tokenService.storeRefreshToken(user.id, tokenDeviceId, newRefreshToken);

    return AuthResponseDto.of(
      newAccessToken,
      newRefreshToken,
      this.tokenService.getAccessTokenExpirationMs(),
      userInfo,
    );
  }

  async logout(accessToken: string, deviceId?: string): Promise<void> {
    const decoded = this.tokenService.decodeToken(accessToken);
    if (decoded) {
      await this.tokenService.blacklistToken(accessToken);
      const userId = decoded.sub;
      const tokenDeviceId = deviceId || decoded.deviceId;
      if (userId && tokenDeviceId) {
        await this.tokenService.revokeDeviceSession(userId, tokenDeviceId);
      }
      await this.auditLogService.log(userId, 'LOGOUT', 'User logged out');
    }
  }

  async logoutAll(userId: string, accessToken: string): Promise<void> {
    await this.tokenService.blacklistToken(accessToken);
    await this.tokenService.revokeAllSessions(userId);
    await this.auditLogService.log(userId, 'LOGOUT_ALL', 'User logged out from all devices');
  }

  async verifyEmail(token: string): Promise<void> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const verificationToken = await this.prisma.verificationToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!verificationToken || verificationToken.used || verificationToken.type !== 'EMAIL_VERIFICATION' || new Date() > verificationToken.expiresAt) {
      throw new InvalidTokenException('Invalid or expired verification token');
    }

    await this.prisma.verificationToken.update({
      where: { id: verificationToken.id },
      data: { used: true },
    });

    await this.prisma.user.update({
      where: { id: verificationToken.user.id },
      data: { emailVerified: true, emailVerifiedAt: new Date() },
    });

    await this.auditLogService.log(verificationToken.user.id, 'EMAIL_VERIFIED', 'Email verified');
  }

  async resendVerificationEmail(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;
    if (user.emailVerified) return;

    await this.prisma.verificationToken.updateMany({
      where: { userId: user.id, type: 'EMAIL_VERIFICATION', used: false },
      data: { used: true },
    });

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    await this.prisma.verificationToken.create({
      data: {
        tokenHash,
        type: 'EMAIL_VERIFICATION',
        userId: user.id,
        expiresAt: new Date(Date.now() + 86400000),
        used: false,
      },
    });

    try {
      await this.emailService.sendVerificationEmail(user.email!, user.firstName ?? '', rawToken);
    } catch (e) {
      this.logger.error('Failed to send verification email', e.stack);
    }
  }

  async deactivateAccount(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ResourceNotFoundException('User');

    const isValid = await bcrypt.compare(password, user.passwordHash!);
    if (!isValid) throw new BadCredentialsException('Invalid password');

    await this.prisma.user.update({
      where: { id: userId },
      data: { enabled: false },
    });
    await this.tokenService.revokeAllSessions(userId);
    await this.auditLogService.log(userId, 'ACCOUNT_DEACTIVATED', 'Account deactivated');
  }

  async updateProfile(userId: string, updates: { firstName?: string; lastName?: string; phoneNumber?: string; username?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: userWithRolesOnlyInclude,
    });
    if (!user) throw new ResourceNotFoundException('User');

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(updates.firstName !== undefined && { firstName: updates.firstName }),
        ...(updates.lastName !== undefined && { lastName: updates.lastName }),
        ...(updates.phoneNumber !== undefined && { phoneNumber: updates.phoneNumber }),
        ...(updates.username !== undefined && { username: updates.username }),
      },
      include: userWithRolesOnlyInclude,
    });
  }

  async processOAuthLogin(
    provider: string,
    profile: {
      providerId: string;
      email: string;
      firstName: string;
      lastName: string;
      picture?: string;
      accessToken?: string;
      refreshToken?: string;
    },
    req: Request,
  ): Promise<AuthResponseDto> {
    const oauthAccount = await this.prisma.oAuthAccount.findFirst({
      where: { provider, providerUserId: profile.providerId },
      include: { user: { include: userWithRolesOnlyInclude } },
    });

    let user: any;

    if (oauthAccount) {
      user = oauthAccount.user;
      await this.prisma.oAuthAccount.update({
        where: { id: oauthAccount.id },
        data: {
          accessToken: profile.accessToken || '',
          refreshToken: profile.refreshToken || '',
        },
      });
    } else {
      user = await this.prisma.user.findUnique({
        where: { email: profile.email },
        include: userWithRolesOnlyInclude,
      });

      if (user && user.passwordHash) {
        throw new BadCredentialsException(
          'An account with this email already exists. Log in with your password, then link this provider from your profile.',
        );
      }

      if (!user) {
        let userRole = await this.prisma.role.findUnique({ where: { name: 'ROLE_USER' } });
        if (!userRole) {
          userRole = await this.prisma.role.create({
            data: { name: 'ROLE_USER', description: 'Default user role' },
          });
        }

        user = await this.prisma.user.create({
          data: {
            email: profile.email,
            firstName: profile.firstName,
            lastName: profile.lastName,
            profilePicture: profile.picture,
            enabled: true,
            emailVerified: true,
            emailVerifiedAt: new Date(),
            roles: {
              create: { roleId: userRole.id },
            },
          },
          include: userWithRolesOnlyInclude,
        });
      }

      await this.prisma.oAuthAccount.create({
        data: {
          userId: user.id,
          provider,
          providerUserId: profile.providerId,
          email: profile.email,
          name: `${profile.firstName} ${profile.lastName}`,
          imageUrl: profile.picture,
          accessToken: profile.accessToken,
          refreshToken: profile.refreshToken,
        },
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const userInfo = this.buildUserInfo(user);
    const tokenUser = { id: user.id, email: user.email, roles: userInfo.roles };
    const deviceId = `oauth-${provider}`;
    const accessToken = this.tokenService.generateAccessToken(tokenUser, deviceId);
    const refreshToken = this.tokenService.generateRefreshToken(tokenUser, deviceId);

    await this.tokenService.storeRefreshToken(user.id, deviceId, refreshToken);

    return AuthResponseDto.of(
      accessToken,
      refreshToken,
      this.tokenService.getAccessTokenExpirationMs(),
      userInfo,
    );
  }

  private buildUserInfo(user: any): UserInfoDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePicture: user.profilePicture,
      roles: user.roles?.map((ur: any) => ur.role?.name || ur.name) || [],
      mfaEnabled: user.mfaEnabled,
    };
  }
}
