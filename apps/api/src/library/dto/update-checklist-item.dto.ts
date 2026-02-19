import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateChecklistItemDto {
  @IsOptional()
  @IsString()
  auditPhaseId?: string;

  @IsOptional()
  @IsString()
  code?: string | null;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  weight?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxPoints?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
