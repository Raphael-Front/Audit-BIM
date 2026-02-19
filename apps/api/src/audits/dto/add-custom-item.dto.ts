import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AddCustomItemDto {
  @IsString()
  description!: string;

  @IsString()
  disciplineId!: string;

  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  weight?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxPoints?: number | null;
}
