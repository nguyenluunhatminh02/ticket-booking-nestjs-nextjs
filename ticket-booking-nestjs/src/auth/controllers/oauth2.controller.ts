import {
  Controller,
  Get,
  Delete,
  Param,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { Public, CurrentUser } from '../../common/decorators';
import { AuthenticationService } from '../services/auth.service';
import { ApiResponseDto } from '../dto/response.dto';
import { setAuthCookies, decodeJwtExpMs } from '../utils/auth-cookies';

@ApiTags('OAuth2')
@Controller('auth/oauth2')
export class OAuth2Controller {
  constructor(
    private prisma: PrismaService,
    private authService: AuthenticationService,
    private configService: ConfigService,
  ) {}

  @Public()
  @Get('providers')
  @ApiOperation({ summary: 'List available OAuth2 providers' })
  getProviders() {
    const providers = [
      { name: 'google', authUrl: '/api/v1/auth/oauth2/authorize/google' },
      { name: 'github', authUrl: '/api/v1/auth/oauth2/authorize/github' },
    ];
    return ApiResponseDto.success(providers);
  }

  @Get('connected-accounts')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List connected OAuth2 accounts' })
  async getConnectedAccounts(@CurrentUser() user: any) {
    const accounts = await this.prisma.oAuthAccount.findMany({
      where: { userId: user.id },
      select: { id: true, provider: true, email: true, name: true, imageUrl: true, createdAt: true },
    });
    return ApiResponseDto.success(
      accounts.map((a) => ({
        id: a.id,
        provider: a.provider,
        email: a.email,
        name: a.name,
        imageUrl: a.imageUrl,
        connectedAt: a.createdAt,
      })),
    );
  }

  @Delete('connected-accounts/:provider')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect OAuth2 provider' })
  async disconnectProvider(@CurrentUser() user: any, @Param('provider') provider: string) {
    await this.prisma.oAuthAccount.deleteMany({
      where: { userId: user.id, provider },
    });
    return ApiResponseDto.success(null, `${provider} disconnected`);
  }

  @Public()
  @Get('authorize/google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Start Google OAuth2 flow' })
  authorizeGoogle() {}

  @Public()
  @Get('authorize/github')
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'Start GitHub OAuth2 flow' })
  authorizeGithub() {}

  @Public()
  @Get('callback/google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth2 callback' })
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    await this.handleCallback('google', req, res);
  }

  @Public()
  @Get('callback/github')
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'GitHub OAuth2 callback' })
  async githubCallback(@Req() req: Request, @Res() res: Response) {
    await this.handleCallback('github', req, res);
  }

  private async handleCallback(provider: string, req: Request, res: Response) {
    const frontend = this.configService.get<string>('APP_FRONTEND_URL', 'http://localhost:3000');
    try {
      const oauthUser = (req as any).user;
      if (!oauthUser?.email) throw new Error('OAuth authentication failed');

      const result = await this.authService.processOAuthLogin(
        provider,
        {
          providerId: oauthUser.providerId,
          email: oauthUser.email,
          firstName: oauthUser.firstName,
          lastName: oauthUser.lastName,
          picture: oauthUser.picture,
          accessToken: oauthUser.accessToken,
          refreshToken: oauthUser.refreshToken,
        },
        req,
      );

      if (result.accessToken && result.refreshToken) {
        const refreshTtl = (decodeJwtExpMs(result.refreshToken) ?? Date.now() + 604800000) - Date.now();
        setAuthCookies(res, result.accessToken, result.refreshToken, result.expiresIn ?? 900000, refreshTtl);
      }
      res.redirect(`${frontend}/oauth2/redirect`);
    } catch (e: any) {
      res.redirect(`${frontend}/oauth2/redirect?error=${encodeURIComponent(e?.message || 'OAuth login failed')}`);
    }
  }
}
