import { IsNotEmpty, IsString } from 'class-validator';
import { IsUuidLike } from '../../../common/decorators/is-uuid-like.decorator';

export class ApplyCouponDto {
  @IsNotEmpty()
  @IsUuidLike()
  reservationId: string;

  @IsNotEmpty()
  @IsString()
  couponCode: string;
}
