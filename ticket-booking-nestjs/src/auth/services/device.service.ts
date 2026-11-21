import { Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import * as UAParser from 'ua-parser-js';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma';
import { TokenService } from './token.service';
import { DeviceLimitExceededException, ResourceNotFoundException } from '../../common/exceptions';

@Injectable()
export class DeviceService {
  private readonly logger = new Logger(DeviceService.name);

  constructor(
    private prisma: PrismaService,
    private tokenService: TokenService,
  ) {}

  async registerDevice(
    userId: string,
    deviceId: string | undefined,
    deviceName: string | undefined,
    deviceType: string | undefined,
    req: Request,
  ) {
    const effectiveDeviceId = deviceId || uuidv4();
    const userAgent = req.headers['user-agent'] || '';
    const parser = new UAParser.UAParser(userAgent);
    const browser = parser.getBrowser();
    const os = parser.getOS();
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';

    const existing = await this.prisma.userDevice.findUnique({
      where: { deviceId: effectiveDeviceId },
    });

    if (existing && existing.userId === userId) {
      return this.prisma.userDevice.update({
        where: { id: existing.id },
        data: {
          lastActiveAt: new Date(),
          active: true,
          ipAddress: ip,
          userAgent,
        },
      });
    }

    // Check device limit
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const activeCount = await this.prisma.userDevice.count({
      where: { userId, active: true },
    });

    if (activeCount >= (user?.maxDevices || 3)) {
      throw new DeviceLimitExceededException(
        `Maximum ${user?.maxDevices || 3} devices allowed`,
      );
    }

    return this.prisma.userDevice.create({
      data: {
        userId,
        deviceId: effectiveDeviceId,
        deviceName: deviceName || `${browser.name || 'Unknown'} on ${os.name || 'Unknown'}`,
        deviceType: deviceType || 'WEB',
        browser: browser.name,
        browserVersion: browser.version,
        operatingSystem: os.name,
        osVersion: os.version,
        ipAddress: ip,
        userAgent,
        active: true,
        lastActiveAt: new Date(),
      },
    });
  }

  async getActiveDevices(userId: string) {
    return this.prisma.userDevice.findMany({
      where: { userId, active: true },
      orderBy: { lastActiveAt: 'desc' },
    });
  }

  async deactivateDevice(userId: string, deviceId: string): Promise<void> {
    await this.prisma.userDevice.updateMany({
      where: { userId, deviceId },
      // Clear trust as well: an inactive device must never bypass MFA.
      data: { active: false, trusted: false },
    });
    await this.tokenService.revokeDeviceSession(userId, deviceId);
  }

  async deactivateAllDevices(userId: string): Promise<void> {
    await this.prisma.userDevice.updateMany({
      where: { userId },
      data: { active: false },
    });
    await this.tokenService.revokeAllSessions(userId);
  }

  async deactivateOtherDevices(userId: string, currentDeviceId: string): Promise<void> {
    await this.prisma.userDevice.updateMany({
      where: { userId, deviceId: { not: currentDeviceId } },
      data: { active: false },
    });
    await this.tokenService.revokeOtherSessions(userId, currentDeviceId);
  }

  async trustDevice(userId: string, deviceId: string): Promise<void> {
    const result = await this.prisma.userDevice.updateMany({
      where: { userId, deviceId },
      data: { trusted: true },
    });
    if (result.count === 0) {
      throw new ResourceNotFoundException('Device', deviceId);
    }
  }

  async isDeviceTrusted(userId: string, deviceId: string): Promise<boolean> {
    const device = await this.prisma.userDevice.findFirst({
      // An inactive/deactivated device must never be treated as trusted.
      where: { userId, deviceId, active: true },
    });
    return device?.trusted || false;
  }

  async untrustDevice(userId: string, deviceId: string): Promise<void> {
    await this.prisma.userDevice.updateMany({
      where: { userId, deviceId },
      data: { trusted: false },
    });
  }

  async renameDevice(userId: string, deviceId: string, newName: string): Promise<void> {
    const result = await this.prisma.userDevice.updateMany({
      where: { userId, deviceId },
      data: { deviceName: newName },
    });
    if (result.count === 0) {
      throw new ResourceNotFoundException('Device', deviceId);
    }
  }
}
