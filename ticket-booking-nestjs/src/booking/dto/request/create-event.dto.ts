import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsBoolean,
  IsPositive,
  IsInt,
} from 'class-validator';
import { EventCategory } from '../../entities/enums';
import { IsUuidLike } from '../../../common/decorators/is-uuid-like.decorator';

export class CreateEventDto {
  @IsNotEmpty()
  @IsUuidLike()
  venueId: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  artistName?: string;

  @IsNotEmpty()
  @IsEnum(EventCategory)
  category: EventCategory;

  @IsNotEmpty()
  @IsDateString()
  eventDate: string;

  @IsOptional()
  @IsDateString()
  doorsOpenAt?: string;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  maxTicketsPerUser?: number;

  @IsOptional()
  @IsBoolean()
  queueEnabled?: boolean;
}
