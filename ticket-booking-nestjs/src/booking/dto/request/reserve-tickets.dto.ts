import { IsNotEmpty, IsOptional, IsArray, Min, IsInt } from 'class-validator';
import { IsUuidLike, IsUuidLikeArray } from '../../../common/decorators/is-uuid-like.decorator';

export class ReserveTicketsDto {
  @IsNotEmpty()
  @IsUuidLike()
  eventId: string;

  @IsNotEmpty()
  @IsUuidLike()
  tierId: string;

  @IsOptional()
  @IsArray()
  @IsUuidLikeArray()
  seatIds?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number = 1;
}
