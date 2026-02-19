import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateChecklistItemDto {
  @IsString()
  categoryId!: string;

  @IsString()
  disciplineId!: string;

  @IsString()
  auditPhaseId!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  weight?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxPoints?: number;
}
