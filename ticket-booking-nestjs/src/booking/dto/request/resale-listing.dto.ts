import { IsNotEmpty, IsNumber, Min } from 'class-validator';
import { IsUuidLike } from '../../../common/decorators/is-uuid-like.decorator';

export class ResaleListingDto {
  @IsNotEmpty()
  @IsUuidLike()
  ticketId: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  askingPrice: number;
}
