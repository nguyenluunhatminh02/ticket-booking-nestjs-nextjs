import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private prisma: PrismaService) {}

  async log(
    userId: string | null,
    action: string,
    details?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: userId ?? undefined,
          action,
          details,
          ipAddress,
          userAgent,
          success: true,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create audit log: ${error.message}`);
    }
  }

  async logWithResource(
    userId: string | null,
    action: string,
    resourceType: string,
    resourceId: string,
    details?: string,
    ipAddress?: string,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: userId ?? undefined,
          action,
          resourceType,
          resourceId,
          details,
          ipAddress,
          success: true,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create audit log: ${error.message}`);
    }
  }

  async getSecurityEvents(userId: string, page: number, size: number) {
    const [items, totalElements] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: page * size,
        take: size,
      }),
      this.prisma.auditLog.count({ where: { userId } }),
    ]);
    const totalPages = Math.ceil(totalElements / size);
    return {
      content: items.map((item) => ({
        id: item.id,
        action: item.action,
        resourceType: item.resourceType,
        resourceId: item.resourceId,
        ipAddress: item.ipAddress,
        details: item.details,
        success: item.success,
        createdAt: item.createdAt,
      })),
      totalElements,
      totalPages,
      size,
      number: page,
      first: page === 0,
      last: page >= totalPages - 1,
    };
  }
}
