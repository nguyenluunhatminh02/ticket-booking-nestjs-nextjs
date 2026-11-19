import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  DefaultValuePipe,
  ParseIntPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { Public, CurrentUser } from '../../common/decorators';
import { AuthenticationService } from '../services/auth.service';
import { PasswordService } from '../services/password.service';
import { LoginAttemptService } from '../services/login-attempt.service';
import { AuditLogService } from '../services/audit-log.service';
import {
  LoginDto,
  RegisterDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  RefreshTokenDto,
  ResendVerificationDto,
  MfaVerifyDto,
} from '../dto';
import { ApiResponseDto, AuthResponseDto } from '../dto/response.dto';
import {
  setAuthCookies,
  clearAuthCookies,
  extractAccessToken,
  extractRefreshToken,
  decodeJwtExpMs,
} from '../utils/auth-cookies';

function issueCookies(res: Response, result: AuthResponseDto): AuthResponseDto {
  const { accessToken, refreshToken, ...safe } = result;
  if (accessToken && refreshToken) {
    const refreshTtl = (decodeJwtExpMs(refreshToken) ?? Date.now() + 604800000) - Date.now();
    setAuthCookies(res, accessToken, refreshToken, result.expiresIn ?? 900000, refreshTtl);
  }
  return safe as AuthResponseDto;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthenticationService,
    private passwordService: PasswordService,
    private loginAttemptService: LoginAttemptService,
    private auditLogService: AuditLogService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, req);
    return ApiResponseDto.success(issueCookies(res, result));
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return ApiResponseDto.success(result, 'Registration successful. Please verify your email.');
  }

  @Public()
  @Post('verify-mfa')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify MFA code' })
  async verifyMfa(
    @Body() dto: MfaVerifyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyMfa(
      dto.mfaToken,
      dto.totpCode,
      dto.deviceId || '',
      dto.deviceName || '',
      dto.deviceType || '',
      req,
    );
    return ApiResponseDto.success(issueCookies(res, result));
  }

  @Public()
  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token (refresh_token cookie or body)' })
  async refreshToken(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = dto.refreshToken ?? extractRefreshToken(req);
    if (!token) throw new UnauthorizedException('Refresh token missing');
    const result = await this.authService.refreshToken(token, dto.deviceId);
    return ApiResponseDto.success(issueCookies(res, result));
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout current device' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: any,
  ) {
    const token = extractAccessToken(req);
    await this.authService.logout(token ?? '', user?.deviceId);
    clearAuthCookies(res);
    return ApiResponseDto.success(null, 'Logged out successfully');
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout all devices' })
  async logoutAll(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: any,
  ) {
    const token = extractAccessToken(req);
    await this.authService.logoutAll(user.id, token ?? '');
    clearAuthCookies(res);
    return ApiResponseDto.success(null, 'Logged out from all devices');
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Verify email address' })
  async verifyEmail(@Body('token') token: string) {
    await this.authService.verifyEmail(token);
    return ApiResponseDto.success(null, 'Email verified successfully');
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset email' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.passwordService.forgotPassword(dto.email);
    return ApiResponseDto.success(null, 'If the email exists, a password reset link will be sent.');
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.passwordService.resetPassword(dto.token, dto.newPassword);
    return ApiResponseDto.success(null, 'Password reset successfully');
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password' })
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.passwordService.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
      user.deviceId,
      dto.logoutAllDevices,
    );
    if (dto.logoutAllDevices) clearAuthCookies(res);
    return ApiResponseDto.success(null, 'Password changed successfully');
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend email verification' })
  async resendVerification(@Body() dto: ResendVerificationDto) {
    await this.authService.resendVerificationEmail(dto.email);
    return ApiResponseDto.success(null, 'If the email exists, a verification link will be sent.');
  }

  @Get('login-history')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get login history' })
  async loginHistory(
    @CurrentUser() user: any,
    @Query('page', new DefaultValuePipe(0), ParseIntPipe) page: number,
    @Query('size', new DefaultValuePipe(20), ParseIntPipe) size: number,
  ) {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days
    const result = await this.loginAttemptService.getLoginHistory(user.id, since, page, size);
    return ApiResponseDto.success(result);
  }

  @Get('security-events')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get security events' })
  async securityEvents(
    @CurrentUser() user: any,
    @Query('page', new DefaultValuePipe(0), ParseIntPipe) page: number,
    @Query('size', new DefaultValuePipe(20), ParseIntPipe) size: number,
  ) {
    const result = await this.auditLogService.getSecurityEvents(user.id, page, size);
    return ApiResponseDto.success(result);
  }
}
