import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
import { AuditKind } from "@prisma/client";

export class CreateAuditDto {
  @IsString()
  workId!: string;

  @IsString()
  phaseId!: string;

  @IsString()
  disciplineId!: string;

  @IsString()
  auditPhaseId!: string;

  @IsString()
  title!: string;

  @IsDateString()
  startDate!: string;

  @IsString()
  auditorId!: string;

  @IsOptional()
  @IsDateString()
  plannedStartDate?: string;

  @IsOptional()
  @IsDateString()
  plannedEndDate?: string;

  @IsOptional()
  @IsEnum(AuditKind)
  kind?: AuditKind;

  @IsOptional()
  @IsString()
  parentAuditId?: string;
}

