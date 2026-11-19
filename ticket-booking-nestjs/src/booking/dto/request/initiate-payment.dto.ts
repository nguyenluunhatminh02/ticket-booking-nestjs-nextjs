import { IsNotEmpty, IsEnum } from 'class-validator';
import { PaymentProvider } from '../../entities/enums';
import { IsUuidLike } from '../../../common/decorators/is-uuid-like.decorator';

export class InitiatePaymentDto {
  @IsNotEmpty()
  @IsUuidLike()
  reservationId: string;

  @IsNotEmpty()
  @IsEnum(PaymentProvider)
  provider: PaymentProvider;
}
