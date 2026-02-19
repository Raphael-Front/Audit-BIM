import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateAuditPhaseDto {
  @IsString()
  name!: string;

  @IsString()
  label!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
