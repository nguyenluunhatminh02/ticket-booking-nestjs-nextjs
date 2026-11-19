import { IsEmail, IsNotEmpty, IsOptional, Length, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'John' })
  @IsNotEmpty({ message: 'First name is required' })
  @Length(2, 50)
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsNotEmpty({ message: 'Last name is required' })
  @Length(2, 50)
  lastName: string;

  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({ example: 'Password123!' })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Password123!' })
  @IsNotEmpty({ message: 'Password confirmation is required' })
  confirmPassword: string;

  @ApiProperty({ required: false })
  @IsOptional()
  phoneNumber?: string;
}
