import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Prisma 7.x exports PrismaClient as const + type, making class extension
// lose type info for model delegates. We use declaration merging to fix this.
@Injectable()
export class PrismaService extends (PrismaClient as any) implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
    super({
      adapter,
      log: process.env.DB_LOGGING === 'true'
        ? [{ emit: 'event', level: 'query' }]
        : [],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma connected to database');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma disconnected from database');
  }
}

// Declaration merging: add all PrismaClient model delegates to PrismaService
export interface PrismaService extends PrismaClient {}
