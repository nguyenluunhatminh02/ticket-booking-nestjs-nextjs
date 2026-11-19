import { IsNotEmpty, IsOptional, IsBoolean, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty()
  @IsNotEmpty({ message: 'Current password is required' })
  currentPassword: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(8)
  newPassword: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'Password confirmation is required' })
  confirmPassword: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  logoutAllDevices?: boolean = false;
}
