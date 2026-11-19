import { IsEmail, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({ example: 'Password123!' })
  @IsNotEmpty({ message: 'Password is required' })
  password: string;

  @ApiProperty({ required: false })
  @IsOptional()
  deviceId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  deviceName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  deviceType?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean = false;
}
