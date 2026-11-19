import { IsEmail, IsNotEmpty, MinLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsNotEmpty({ message: 'Token is required' })
  token: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(8)
  newPassword: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'Password confirmation is required' })
  confirmPassword: string;
}

export class RefreshTokenDto {
  @ApiProperty({ required: false, description: 'Optional when refresh_token cookie is present' })
  @IsOptional()
  refreshToken?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  deviceId?: string;
}

export class ResendVerificationDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;
}

export class MfaVerifyDto {
  @ApiProperty()
  @IsNotEmpty({ message: 'MFA token is required' })
  mfaToken: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'TOTP code is required' })
  totpCode: string;

  @ApiProperty({ required: false })
  @IsOptional()
  deviceId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  deviceName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  deviceType?: string;
}

export class MfaSetupConfirmDto {
  @ApiProperty()
  @IsNotEmpty()
  secret: string;

  @ApiProperty()
  @IsNotEmpty()
  totpCode: string;
}

export class RenameDeviceDto {
  @ApiProperty()
  @IsNotEmpty({ message: 'Device name is required' })
  newName: string;
}

export class DeactivateAccountDto {
  @ApiProperty()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;

  @ApiProperty({ required: false })
  @IsOptional()
  reason?: string;
}

export class UpdateProfileDto {
  @ApiProperty({ required: false })
  @IsOptional()
  firstName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  lastName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  phoneNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  username?: string;
}
