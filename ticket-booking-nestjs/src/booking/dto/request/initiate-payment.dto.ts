import { IsNotEmpty, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaymentProvider } from '../../entities/enums';
import { IsUuidLike } from '../../../common/decorators/is-uuid-like.decorator';

export class InitiatePaymentDto {
  @IsNotEmpty()
  @IsUuidLike()
  reservationId: string;

  @IsNotEmpty()
  @IsEnum(PaymentProvider)
  provider: PaymentProvider;

  /** Stable token for retrying one checkout initiation API call safely. */
  @IsOptional()
  @IsString()
  attemptToken?: string;
}
