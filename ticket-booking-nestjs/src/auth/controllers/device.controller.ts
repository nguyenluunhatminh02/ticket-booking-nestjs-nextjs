import {
  Controller,
  Get,
  Delete,
  Post,
  Put,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DeviceService } from '../services/device.service';
import { TokenService } from '../services/token.service';
import { ApiResponseDto } from '../dto/response.dto';
import { RenameDeviceDto } from '../dto/auth.dto';

@ApiTags('Devices')
@ApiBearerAuth()
@Controller('devices')
export class DeviceController {
  constructor(
    private deviceService: DeviceService,
    private tokenService: TokenService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all active devices' })
  async getDevices(@CurrentUser() user: any) {
    const devices = await this.deviceService.getActiveDevices(user.id);
    return ApiResponseDto.success(devices);
  }

  @Delete(':deviceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove device and invalidate session' })
  async removeDevice(@CurrentUser() user: any, @Param('deviceId') deviceId: string) {
    await this.deviceService.deactivateDevice(user.id, deviceId);
    await this.tokenService.revokeDeviceSession(user.id, deviceId);
    return ApiResponseDto.success(null, 'Device removed');
  }

  @Delete('others')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove all other devices' })
  async removeOtherDevices(@CurrentUser() user: any) {
    const currentDeviceId = user.deviceId;
    await this.deviceService.deactivateOtherDevices(user.id, currentDeviceId);
    await this.tokenService.revokeOtherSessions(user.id, currentDeviceId);
    return ApiResponseDto.success(null, 'Other devices removed');
  }

  @Post(':deviceId/trust')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trust a device (skip MFA)' })
  async trustDevice(@CurrentUser() user: any, @Param('deviceId') deviceId: string) {
    await this.deviceService.trustDevice(user.id, deviceId);
    return ApiResponseDto.success(null, 'Device trusted');
  }

  @Delete(':deviceId/trust')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Untrust a device' })
  async untrustDevice(@CurrentUser() user: any, @Param('deviceId') deviceId: string) {
    await this.deviceService.untrustDevice(user.id, deviceId);
    return ApiResponseDto.success(null, 'Device untrusted');
  }

  @Put(':deviceId/name')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rename a device' })
  async renameDevice(
    @CurrentUser() user: any,
    @Param('deviceId') deviceId: string,
    @Body() dto: RenameDeviceDto,
  ) {
    await this.deviceService.renameDevice(user.id, deviceId, dto.newName);
    return ApiResponseDto.success(null, 'Device renamed');
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Get active sessions summary' })
  async getActiveSessions(@CurrentUser() user: any) {
    const sessionCount = await this.tokenService.getActiveSessionCount(user.id);
    const devices = await this.deviceService.getActiveDevices(user.id);
    return ApiResponseDto.success({
      totalActiveSessions: sessionCount,
      devices,
      currentDeviceId: user.deviceId,
    });
  }
}
