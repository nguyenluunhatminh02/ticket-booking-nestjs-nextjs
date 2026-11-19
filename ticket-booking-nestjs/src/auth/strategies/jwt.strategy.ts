import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma';
import { TokenService } from '../services/token.service';
import { extractAccessToken } from '../utils/auth-cookies';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  deviceId?: string;
  type: string;
  iat: number;
  exp: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private tokenService: TokenService,
  ) {
    super({
      jwtFromRequest: (req: any) => extractAccessToken(req),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
      passReqToCallback: true,
    } as any);
  }

  async validate(req: any, payload: JwtPayload) {
    if (payload.type !== 'ACCESS') {
      throw new UnauthorizedException('Invalid token type');
    }

    const token = extractAccessToken(req);
    if (token && await this.tokenService.isTokenBlacklisted(token)) {
      throw new UnauthorizedException('Token has been revoked');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
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
      },
    });

    if (!user || !user.enabled) {
      throw new UnauthorizedException('User not found or disabled');
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles.map((ur) => ur.role.name),
      permissions: user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.name)),
      mfaEnabled: user.mfaEnabled,
      emailVerified: user.emailVerified,
      deviceId: payload.deviceId,
    };
  }
}
