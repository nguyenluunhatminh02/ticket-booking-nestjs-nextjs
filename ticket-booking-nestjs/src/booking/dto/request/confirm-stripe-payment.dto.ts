import { IsNotEmpty, IsString } from 'class-validator';
import { IsUuidLike } from '../../../common/decorators/is-uuid-like.decorator';

export class ConfirmStripePaymentDto {
  @IsNotEmpty()
  @IsString()
  paymentIntentId: string;

  @IsNotEmpty()
  @IsUuidLike()
  reservationId: string;
}
