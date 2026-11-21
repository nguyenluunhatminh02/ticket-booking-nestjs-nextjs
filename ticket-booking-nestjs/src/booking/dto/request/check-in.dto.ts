import { IsNotEmpty, IsString, IsOptional, IsNumber } from 'class-validator';

export class CheckInDto {
  @IsNotEmpty()
  @IsString()
  ticketCode: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  deviceInfo?: string;

  /** Mandatory rotating QR code, verified against the locked ticket. */
  @IsNotEmpty()
  @IsString()
  qrCode: string;
}
