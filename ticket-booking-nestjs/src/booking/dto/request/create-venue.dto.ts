import { IsNotEmpty, IsString, IsOptional, IsNumber, IsPositive, IsInt } from 'class-validator';

export class CreateVenueDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsNotEmpty()
  @IsString()
  city: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsNotEmpty()
  @IsString()
  country: string;

  @IsOptional()
  @IsString()
  zipCode?: string;

  @IsNotEmpty()
  @IsInt()
  @IsPositive()
  capacity: number;

  @IsOptional()
  @IsString()
  seatMapConfig?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;
}
