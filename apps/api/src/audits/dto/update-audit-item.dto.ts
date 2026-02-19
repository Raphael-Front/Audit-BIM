import { StatusItemAuditoria } from '@bim-audit/db';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateAuditItemDto {
  @IsOptional()
  @IsEnum(StatusItemAuditoria)
  status?: StatusItemAuditoria;

  @IsOptional()
  @IsString()
  evidenceText?: string | null;

  @IsOptional()
  @IsString()
  construflowRef?: string | null;

  @IsOptional()
  @IsDateString()
  nextReviewAt?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  pointsObtained?: number | null;
}
