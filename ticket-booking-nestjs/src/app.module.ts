import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { PrismaModule } from './prisma';
import { AuthModule } from './auth/auth.module';
import { BookingModule } from './booking/booking.module';
import { MlModule } from './ml/ml.module';

@Module({
  imports: [
    // Global config
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Prisma (global)
    PrismaModule,

    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const ttlSeconds = Number(config.get('RATE_LIMIT_TTL', config.get('THROTTLE_TTL', 60)));
        const limit = Number(config.get('RATE_LIMIT_MAX', config.get('THROTTLE_LIMIT', 100)));
        return {
          throttlers: [{ ttl: ttlSeconds * 1000, limit }],
        };
      },
    }),

    // Scheduled tasks
    ScheduleModule.forRoot(),

    // Serve uploaded files
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
      serveStaticOptions: { index: false, dotfiles: 'deny' },
    }),

    // Feature modules
    AuthModule,
    BookingModule,
    MlModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
