import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MfaService } from '../services/mfa.service';
import { ApiResponseDto } from '../dto/response.dto';
import { MfaSetupConfirmDto } from '../dto/auth.dto';

@ApiTags('MFA')
@ApiBearerAuth()
@Controller('mfa')
export class MfaController {
  constructor(private mfaService: MfaService) {}

  @Post('setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initialize MFA setup' })
  async setupMfa(@CurrentUser() user: any) {
    const result = await this.mfaService.setupMfa(user.id);
    return ApiResponseDto.success(result);
  }

  @Post('setup/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm MFA setup with TOTP code' })
  async confirmSetup(@CurrentUser() user: any, @Body() dto: MfaSetupConfirmDto) {
    await this.mfaService.confirmMfaSetup(user.id, dto.secret, dto.totpCode);
    return ApiResponseDto.success(null, 'MFA setup confirmed');
  }

  @Delete('disable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable MFA' })
  async disableMfa(@CurrentUser() user: any, @Query('totpCode') totpCode: string) {
    await this.mfaService.disableMfa(user.id, totpCode);
    return ApiResponseDto.success(null, 'MFA disabled');
  }

  @Get('status')
  @ApiOperation({ summary: 'Check MFA status' })
  async getStatus(@CurrentUser() user: any) {
    const enabled = await this.mfaService.isMfaEnabled(user.id);
    return ApiResponseDto.success(enabled);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify TOTP code' })
  async verify(@CurrentUser() user: any, @Query('totpCode') totpCode: string) {
    const valid = await this.mfaService.verifyTotp(user.id, totpCode);
    return ApiResponseDto.success(valid);
  }

  @Post('backup-codes/regenerate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Regenerate backup codes' })
  async regenerateBackupCodes(@CurrentUser() user: any, @Query('totpCode') totpCode: string) {
    const codes = await this.mfaService.regenerateBackupCodes(user.id, totpCode);
    return ApiResponseDto.success(codes);
  }

  @Get('backup-codes/count')
  @ApiOperation({ summary: 'Get remaining backup code count' })
  async getBackupCodeCount(@CurrentUser() user: any) {
    const count = await this.mfaService.getRemainingBackupCodeCount(user.id);
    return ApiResponseDto.success(count);
  }
}
