import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  MaxLength,
  Matches,
} from 'class-validator';
import { DiscountType } from '../../entities/enums';
import { IsUuidLike } from '../../../common/decorators/is-uuid-like.decorator';

export class CreateCouponDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  @Matches(/^[A-Za-z0-9_-]+$/)
  code: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsNotEmpty()
  @IsEnum(DiscountType)
  discountType: DiscountType;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  discountValue: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsesPerUser?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minPurchaseAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  maxDiscountAmount?: number;

  @IsOptional()
  @IsUuidLike()
  eventId?: string;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;
}
