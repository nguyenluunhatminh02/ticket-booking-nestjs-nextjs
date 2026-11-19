import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

// Services
import {
  AuthenticationService,
  TokenService,
  PasswordService,
  EmailService,
  DeviceService,
  MfaService,
  LoginAttemptService,
  AuditLogService,
} from './services';

// Controllers
import {
  AuthController,
  UserController,
  DeviceController,
  MfaController,
  OAuth2Controller,
} from './controllers';

// Strategies & Guards
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { GithubStrategy } from './strategies/github.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET environment variable is required');
        }
        return {
          secret,
          signOptions: {
            expiresIn: config.get<number>('JWT_ACCESS_EXPIRATION_SEC', 900),
          },
        };
      },
    }),
  ],
  controllers: [
    AuthController,
    UserController,
    DeviceController,
    MfaController,
    OAuth2Controller,
  ],
  providers: [
    // Services
    AuthenticationService,
    TokenService,
    PasswordService,
    EmailService,
    DeviceService,
    MfaService,
    LoginAttemptService,
    AuditLogService,
    // Strategies
    JwtStrategy,
    GoogleStrategy,
    GithubStrategy,
    // Guards
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [
    AuthenticationService,
    TokenService,
    JwtAuthGuard,
  ],
})
export class AuthModule {}
