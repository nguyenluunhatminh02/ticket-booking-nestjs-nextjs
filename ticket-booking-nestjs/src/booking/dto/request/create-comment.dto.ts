import { IsNotEmpty, IsString, IsOptional, IsInt, Min, Max, IsUUID, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(2000)
  content: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsString()
  parentId?: string;
}
