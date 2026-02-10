import { AuditItemSeverity, AuditItemStatus } from "@prisma/client";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";

export class UpdateAuditItemDto {
  @IsOptional()
  @IsEnum(AuditItemStatus)
  status?: AuditItemStatus;

  @IsOptional()
  @IsEnum(AuditItemSeverity)
  severity?: AuditItemSeverity | null;

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

