import { IsNotEmpty, IsString, IsOptional, IsNumber, IsPositive, IsInt } from 'class-validator';

export class CreateTicketTierDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  price: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsNotEmpty()
  @IsInt()
  @IsPositive()
  totalQuantity: number;

  @IsOptional()
  @IsInt()
  maxPerUser?: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
